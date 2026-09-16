-- ============================================================
-- 20260916000000_proveedores_catalogo.sql  (Fase 1.1 del plan v2)
-- Los proveedores pasan a tener identidad: `proveedores_turno` apunta
-- al catálogo (`proveedores_frecuentes`) por id, y el nombre se
-- normaliza (sin mayúsculas/tildes/símbolos) para que "PF", "Pf" y
-- "P.F." sean el mismo proveedor. Hasta ahora el nombre era texto
-- libre y ya había 4 duplicados en producción.
--
-- Compatible con la app actual, que sigue escribiendo solo `nombre`:
--   - INSERT en proveedores_turno con nombre → el trigger busca/crea el
--     proveedor en el catálogo, guarda su id y deja el nombre canónico.
--   - UPDATE de nombre (editar un proveedor del turno) → se vincula al
--     proveedor existente con ese nombre, o conserva el id si no existe.
--   - Upsert de nombres nuevos en proveedores_frecuentes (guardarTurno)
--     → si ya existe con otra grafía, se ignora en silencio.
--   - Renombrar en Proveedores.jsx → el trigger propaga el nombre a
--     todos los turnos (antes eran dos escrituras sin transacción).
--   - Eliminar del catálogo → los turnos conservan el nombre
--     (proveedor_id queda null) en vez de fallar por la FK.
-- Los snapshots en turno_cierres conservan el nombre tal como se
-- escribió en su momento: son la fotografía inmutable del cierre.
-- ============================================================

-- ------------------------------------------------------------
-- Normalización
-- ------------------------------------------------------------
create or replace function public.norm_nombre(p text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select lower(regexp_replace(
    translate(btrim(p), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUnN'),
    '[^a-zA-Z0-9]', '', 'g'
  ));
$$;

-- La usan la columna generada nombre_norm y el índice de trabajadores:
-- se evalúa con los privilegios de quien escribe la fila.
grant execute on function public.norm_nombre(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Saneo previo (datos): deja una sola fila por nombre normalizado en
-- el catálogo, prefiriendo la grafía más usada en los turnos (luego la
-- que tiene logo, luego la más antigua), y lleva los turnos a esa
-- grafía. Idempotente.
-- ------------------------------------------------------------
with ranked as (
  select pf.id,
         row_number() over (
           partition by public.norm_nombre(pf.nombre)
           order by (select count(*) from public.proveedores_turno pt where pt.nombre = pf.nombre) desc,
                    (pf.imagen_url is not null) desc,
                    pf.creado_en
         ) as rn
  from public.proveedores_frecuentes pf
)
delete from public.proveedores_frecuentes
where id in (select id from ranked where rn > 1);

-- Nombres usados en turnos que no estaban en el catálogo.
insert into public.proveedores_frecuentes (nombre)
select distinct on (public.norm_nombre(pt.nombre)) btrim(pt.nombre)
from public.proveedores_turno pt
where not exists (
  select 1 from public.proveedores_frecuentes pf
  where public.norm_nombre(pf.nombre) = public.norm_nombre(pt.nombre)
)
order by public.norm_nombre(pt.nombre), pt.creado_en;

-- ------------------------------------------------------------
-- Catálogo: columna normalizada única + activo
-- ------------------------------------------------------------
alter table public.proveedores_frecuentes
  add column if not exists nombre_norm text
    generated always as (public.norm_nombre(nombre)) stored;

create unique index if not exists proveedores_frecuentes_nombre_norm_key
  on public.proveedores_frecuentes (nombre_norm);

alter table public.proveedores_frecuentes
  add column if not exists activo boolean not null default true;

-- ------------------------------------------------------------
-- proveedores_turno.proveedor_id + backfill
-- ------------------------------------------------------------
alter table public.proveedores_turno
  add column if not exists proveedor_id uuid
    references public.proveedores_frecuentes(id) on delete set null;

create index if not exists idx_proveedores_turno_proveedor_id
  on public.proveedores_turno (proveedor_id);

-- Los triggers todavía no existen, así que este UPDATE no dispara nada.
update public.proveedores_turno pt
set proveedor_id = pf.id,
    nombre = pf.nombre
from public.proveedores_frecuentes pf
where pf.nombre_norm = public.norm_nombre(pt.nombre)
  and (pt.proveedor_id is distinct from pf.id or pt.nombre <> pf.nombre);

-- ------------------------------------------------------------
-- Trigger: vincular cada fila de proveedores_turno con el catálogo
-- ------------------------------------------------------------
create or replace function public.proveedores_turno_vincular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
  v_por_id boolean;
begin
  -- ¿La escritura viene con id (v2) o solo con nombre (app actual)?
  if tg_op = 'INSERT' then
    v_por_id := new.proveedor_id is not null;
  else
    -- proveedor_id pasó a NULL sin cambiar el nombre: es el ON DELETE SET
    -- NULL de la FK (se eliminó el proveedor del catálogo) o un desvínculo
    -- explícito. La fila conserva su nombre y queda sin catálogo.
    if new.proveedor_id is null and old.proveedor_id is not null
       and new.nombre is not distinct from old.nombre then
      return new;
    end if;
    v_por_id := new.proveedor_id is not null and new.proveedor_id is distinct from old.proveedor_id;
    -- Nada relevante cambió: no tocar.
    if not v_por_id and new.nombre is not distinct from old.nombre then
      return new;
    end if;
  end if;

  if v_por_id then
    select id, nombre into v_id, v_nombre
      from public.proveedores_frecuentes where id = new.proveedor_id;
    if v_id is null then
      raise exception 'El proveedor % no existe en el catálogo', new.proveedor_id
        using errcode = 'foreign_key_violation';
    end if;
    new.nombre := v_nombre;
    return new;
  end if;

  -- Por nombre: buscar en el catálogo.
  new.nombre := btrim(new.nombre);
  select id, nombre into v_id, v_nombre
    from public.proveedores_frecuentes
    where nombre_norm = public.norm_nombre(new.nombre);

  if v_id is not null then
    new.proveedor_id := v_id;
    new.nombre := v_nombre;                 -- grafía canónica
  elsif tg_op = 'INSERT' then
    insert into public.proveedores_frecuentes (nombre)
      values (new.nombre) returning id into v_id;
    new.proveedor_id := v_id;
  end if;
  -- UPDATE a un nombre que no está en el catálogo: se conserva el
  -- proveedor_id anterior y el nombre nuevo tal cual (la app actual
  -- renombra primero los turnos y después el catálogo; al llegar la
  -- segunda escritura ambos quedan alineados).
  return new;
end;
$$;

revoke execute on function public.proveedores_turno_vincular() from public, anon, authenticated;

drop trigger if exists proveedores_turno_vincular on public.proveedores_turno;
create trigger proveedores_turno_vincular
  before insert or update of nombre, proveedor_id on public.proveedores_turno
  for each row execute function public.proveedores_turno_vincular();

-- ------------------------------------------------------------
-- Trigger: el catálogo no acepta grafías duplicadas
-- ------------------------------------------------------------
-- La app actual hace `upsert(..., onConflict: 'nombre', ignoreDuplicates)`
-- con el nombre tal como lo escribió el usuario: "pf" no choca con "PF"
-- por la constraint de `nombre`, pero sí por nombre_norm. Se descarta
-- en silencio (return null) en vez de lanzar error, para que registrar
-- un turno nunca falle por esto.
create or replace function public.proveedores_frecuentes_sin_duplicados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.nombre := btrim(new.nombre);
  if exists (
    select 1 from public.proveedores_frecuentes
    where nombre_norm = public.norm_nombre(new.nombre)
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.proveedores_frecuentes_sin_duplicados() from public, anon, authenticated;

drop trigger if exists proveedores_frecuentes_sin_duplicados on public.proveedores_frecuentes;
create trigger proveedores_frecuentes_sin_duplicados
  before insert on public.proveedores_frecuentes
  for each row execute function public.proveedores_frecuentes_sin_duplicados();

-- ------------------------------------------------------------
-- Trigger: renombrar en el catálogo propaga a los turnos
-- ------------------------------------------------------------
create or replace function public.proveedores_frecuentes_propagar_nombre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre then
    update public.proveedores_turno
      set nombre = new.nombre
      where proveedor_id = new.id and nombre is distinct from new.nombre;
  end if;
  return new;
end;
$$;

revoke execute on function public.proveedores_frecuentes_propagar_nombre() from public, anon, authenticated;

drop trigger if exists proveedores_frecuentes_propagar_nombre on public.proveedores_frecuentes;
create trigger proveedores_frecuentes_propagar_nombre
  after update of nombre on public.proveedores_frecuentes
  for each row execute function public.proveedores_frecuentes_propagar_nombre();

-- ------------------------------------------------------------
-- RPC: fusionar dos proveedores (solo dueño)
-- ------------------------------------------------------------
create or replace function public.fusionar_proveedores(p_origen uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_destino text;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede fusionar proveedores';
  end if;
  if p_origen = p_destino then
    raise exception 'Origen y destino son el mismo proveedor';
  end if;
  select nombre into v_nombre_destino from public.proveedores_frecuentes where id = p_destino;
  if v_nombre_destino is null then
    raise exception 'El proveedor destino no existe';
  end if;

  update public.proveedores_turno
    set proveedor_id = p_destino, nombre = v_nombre_destino
    where proveedor_id = p_origen;

  -- El destino hereda el logo si no tenía.
  update public.proveedores_frecuentes d
    set imagen_url = coalesce(d.imagen_url, o.imagen_url)
    from public.proveedores_frecuentes o
    where d.id = p_destino and o.id = p_origen;

  delete from public.proveedores_frecuentes where id = p_origen;
end;
$$;

revoke execute on function public.fusionar_proveedores(uuid, uuid) from public, anon;
grant execute on function public.fusionar_proveedores(uuid, uuid) to authenticated;
