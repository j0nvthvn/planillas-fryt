-- ============================================================
-- 20260918000000_integridad.sql
-- Integridad y trazabilidad de los datos (aditivo, compatible con la
-- app actual):
--
--   1. `auditoria`: cada cambio real (y cada borrado) en las tablas de
--      negocio queda con la fila antes/después, quién y cuándo. Un
--      "Eliminar definitivamente" de la papelera o el borrado de una
--      jornada se puede reconstruir desde aquí.
--   2. `turno_cierres` inmutable: no se actualiza nunca y solo se borra
--      en cascada al borrar su turno (queda en `auditoria`).
--   3. Permisos: fuera TRUNCATE/TRIGGER/REFERENCES para los roles de la
--      API y DELETE directo donde ninguna política lo permite.
--   4. CHECKs de montos que faltaban.
--   5. `verificar_integridad()`: reglas de consistencia que corre el
--      respaldo diario (.github/workflows/respaldo.yml).
--
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Auditoría
-- ------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  usuario_id uuid default auth.uid(),
  tabla text not null,
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  registro text,
  antes jsonb,
  despues jsonb
);

create index if not exists auditoria_tabla_registro_idx on public.auditoria (tabla, registro);
create index if not exists auditoria_en_idx on public.auditoria (en);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria: dueño puede leer" on public.auditoria;
create policy "auditoria: dueño puede leer" on public.auditoria
  for select to authenticated using (public.es_dueno());

-- Solo la escriben los triggers (security definer). Los privilegios
-- por defecto de 20260915000010 darían insert/update/delete: se quitan.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- La app actual reescribe filas sin cambios en cada autoguardado y los
  -- triggers de updated_at las "modifican": eso no es un cambio real.
  if tg_op = 'UPDATE' and (v_antes - 'updated_at') = (v_despues - 'updated_at') then
    return null;
  end if;

  insert into public.auditoria (tabla, operacion, registro, antes, despues)
  values (
    tg_table_name,
    tg_op,
    coalesce(v_despues, v_antes) ->> tg_argv[0],
    v_antes,
    v_despues
  );
  return null;
end;
$$;

revoke execute on function public.auditar() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('jornadas',               'id',    'insert or update or delete'),
      ('turnos',                 'id',    'insert or update or delete'),
      ('ventas_turno',           'id',    'update or delete'),
      ('proveedores_turno',      'id',    'update or delete'),
      ('turno_cierres',          'id',    'delete'),
      ('proveedores_frecuentes', 'id',    'update or delete'),
      ('trabajadores',           'id',    'update or delete'),
      ('metodos_pago',           'key',   'update or delete'),
      ('configuracion',          'clave', 'update or delete')
    ) as t(tabla, clave, eventos)
  loop
    execute format('drop trigger if exists auditar on public.%I', r.tabla);
    execute format(
      'create trigger auditar after %s on public.%I for each row execute function public.auditar(%L)',
      r.eventos, r.tabla, r.clave
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. turno_cierres inmutable
-- ------------------------------------------------------------
create or replace function public.turno_cierres_inmutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Válvula para mantenimiento manual como postgres:
  --   set local frytcontrol.permitir_cambiar_cierres = 'on';
  if current_setting('frytcontrol.permitir_cambiar_cierres', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'turno_cierres es inmutable: registra una corrección en vez de modificar el cierre'
      using errcode = 'insufficient_privilege';
  end if;

  -- DELETE: solo como cascada del borrado de su turno (lo lanza el
  -- trigger de la FK, así que la profundidad es mayor que 1).
  if pg_trigger_depth() <= 1 then
    raise exception 'turno_cierres es inmutable: solo se borra junto con su turno'
      using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

revoke execute on function public.turno_cierres_inmutable() from public, anon, authenticated;

drop trigger if exists turno_cierres_inmutable on public.turno_cierres;
create trigger turno_cierres_inmutable
  before update or delete on public.turno_cierres
  for each row execute function public.turno_cierres_inmutable();

-- ------------------------------------------------------------
-- 3. Permisos
-- ------------------------------------------------------------
-- TRUNCATE se salta RLS y los triggers de fila; ninguna app lo usa.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- Sin política de DELETE en estas tablas: RLS ya lo bloquea, así queda
-- explícito. Las cascadas de las FKs no dependen de este privilegio.
revoke delete on public.turno_cierres, public.ventas_turno, public.usuarios, public.logs_error
  from anon, authenticated;

-- ------------------------------------------------------------
-- 4. CHECKs de montos (sin filas que los violen en prod al 2026-09-18)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_fondo_inicial_no_negativo') then
    alter table public.turnos
      add constraint turnos_fondo_inicial_no_negativo check (fondo_inicial >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'turno_cierres_efectivo_contado_no_negativo') then
    alter table public.turno_cierres
      add constraint turno_cierres_efectivo_contado_no_negativo check (efectivo_contado >= 0) not valid;
  end if;
end $$;

alter table public.turnos validate constraint turnos_fondo_inicial_no_negativo;
alter table public.turno_cierres validate constraint turno_cierres_efectivo_contado_no_negativo;

-- ------------------------------------------------------------
-- 5. verificar_integridad()
-- ------------------------------------------------------------
-- Una fila por regla que falla. severidad 'error' = datos
-- inconsistentes; 'aviso' = algo que alguien debería revisar.
create or replace function public.verificar_integridad()
returns table (severidad text, chequeo text, cantidad bigint, ejemplo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is not null and not public.es_dueno() then
    raise exception 'solo el dueño puede verificar la integridad'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with activos as (
    select t.*, j.fecha, j.es_turno_unico
    from turnos t join jornadas j on j.id = t.jornada_id
    where t.deleted_at is null
  ),
  hallazgos as (
    select 'error' as sev, 'turno cerrado sin fila en ventas_turno' as regla,
           a.fecha::text || ' ' || a.tipo as ej
    from activos a
    where not a.is_draft
      and not exists (select 1 from ventas_turno v where v.turno_id = a.id)

    union all
    select 'error', 'totales actuales distintos del último cierre',
           a.fecha::text || ' ' || a.tipo
    from activos a
    cross join lateral (
      select c.total_ventas, c.total_proveedores
      from turno_cierres c where c.turno_id = a.id
      -- el último es el que ninguna corrección apunta (cerrado_en puede
      -- empatar si cierre y corrección van en la misma transacción)
      order by exists (select 1 from turno_cierres n where n.cierre_anterior_id = c.id), c.cerrado_en desc
      limit 1
    ) u
    cross join lateral turno_totales(a.id) x
    where not a.is_draft
      and (u.total_ventas <> x.total_ventas or u.total_proveedores <> x.total_proveedores)

    union all
    select 'error', 'corrección sin cierre anterior del mismo turno',
           c.id::text
    from turno_cierres c
    left join turno_cierres ant on ant.id = c.cierre_anterior_id
    where (c.es_correccion and c.cierre_anterior_id is null)
       or (ant.id is not null and ant.turno_id <> c.turno_id)

    union all
    select 'error', 'proveedor de turno sin enlace al catálogo',
           p.id::text
    from proveedores_turno p
    where p.proveedor_id is null

    union all
    select case when x.total_ventas = 0 and x.total_proveedores = 0 then 'aviso' else 'error' end,
           'día completo con turno de tarde activo',
           a.fecha::text
    from activos a
    cross join lateral turno_totales(a.id) x
    where a.es_turno_unico and a.tipo = 'tarde'

    union all
    select 'aviso', 'borrador de un día pasado',
           a.fecha::text || ' ' || a.tipo
    from activos a
    where a.is_draft and a.fecha < v_hoy

    union all
    select 'aviso', 'jornada con fecha futura',
           j.fecha::text
    from jornadas j
    where j.fecha > v_hoy + 1
  )
  select h.sev, h.regla, count(*), min(h.ej)
  from hallazgos h
  group by h.sev, h.regla
  order by h.sev, h.regla;
end;
$$;

revoke execute on function public.verificar_integridad() from public, anon;
grant execute on function public.verificar_integridad() to authenticated, service_role;
