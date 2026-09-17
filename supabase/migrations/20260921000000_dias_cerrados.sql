-- ============================================================
-- 20260921000000_dias_cerrados.sql
-- Días en que el local no abrió (domingo libre, feriado, vacaciones).
--
-- Hasta ahora una fecha solo existía si alguien guardaba un turno:
-- jornadas se crea de forma perezosa en guardar_turno(). Un día
-- cerrado no dejaba ninguna fila, así que desaparecía del Historial y
-- del gráfico de Análisis, y en los correos se veía como "Sin
-- registro", igual que un día que alguien olvidó registrar.
--
-- Esta migración agrega la marca y la hace cumplir:
--   jornadas.cerrado / motivo_cierre / cerrado_en / cerrado_por
--   marcar_dia_cerrado(fecha, cerrado, motivo)   ← la única puerta
--   triggers que impiden turnos en un día marcado y marcar un día
--     que tiene turnos (incluye restaurar desde la papelera)
--   v_resumen_dia.estado gana 'cerrado'
--   resumen_periodo() gana dias_cerrados y dias_periodo
--   verificar_integridad() gana un error y un aviso
--
-- En la base la columna se llama `cerrado` porque es la palabra del
-- dominio; en la interfaz siempre se dice "No abrió", porque ahí
-- "cerrado" ya significa un turno cerrado.
--
-- Aditiva: la app actual (select *) sigue funcionando. Para volver
-- atrás basta recrear la vista y resumen_periodo desde
-- 20260916000200_totales_vistas.sql y borrar los triggers; las
-- columnas quedan sin uso.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas
-- ------------------------------------------------------------
alter table public.jornadas
  add column if not exists cerrado boolean not null default false,
  add column if not exists motivo_cierre text,
  add column if not exists cerrado_en timestamptz,
  add column if not exists cerrado_por uuid references public.usuarios(id);

comment on column public.jornadas.cerrado is
  'El local no abrió ese día. En la interfaz se muestra como "No abrió".';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jornadas_motivo_cierre_largo') then
    alter table public.jornadas
      add constraint jornadas_motivo_cierre_largo
      check (motivo_cierre is null or length(btrim(motivo_cierre)) between 1 and 60);
  end if;
end $$;

-- El filtro "No abrió" del Historial.
create index if not exists jornadas_cerrado_idx on public.jornadas (fecha) where cerrado;

-- ------------------------------------------------------------
-- 2. v_resumen_dia: estado 'cerrado' y las columnas nuevas al final
-- ------------------------------------------------------------
-- Las columnas nuevas van DESPUÉS de updated_at: create or replace
-- exige conservar nombre, tipo y orden de las existentes, y un drop
-- view perdería los grants de 20260915000010_grants_api.sql.
-- La marca NO gana a los turnos: si un día marcado tuviera plata
-- registrada, manda el estado real y verificar_integridad() lo grita.
-- Una marca nunca puede esconder dinero.
create or replace view public.v_resumen_dia
with (security_invoker = true)
as
with cfg as (
  select coalesce((select valor from public.configuracion where clave = 'dias_turno_unico'), '[0]'::jsonb) as dias_unicos
)
select
  j.id as jornada_id,
  j.fecha,
  j.es_turno_unico,
  -- Día de turno único por configuración (domingos por defecto) o marcado a mano.
  (cfg.dias_unicos @> to_jsonb(extract(dow from j.fecha)::int)) as dia_unico_config,
  (j.es_turno_unico or cfg.dias_unicos @> to_jsonb(extract(dow from j.fecha)::int)) as es_dia_unico,
  count(t.id)::int                                   as turnos,
  coalesce(bool_or(t.is_draft), false)               as tiene_borrador,
  coalesce(bool_or(t.tipo = 'mañana'), false)        as tiene_manana,
  coalesce(bool_or(t.tipo = 'tarde'), false)         as tiene_tarde,
  coalesce(bool_or(t.corregido), false)              as corregido,
  coalesce(bool_or(t.efectivo_contado is not null), false) as con_conteo,
  coalesce(bool_or(t.diferencia_efectivo is not null and t.diferencia_efectivo <> 0), false) as con_descuadre,
  case
    when count(t.id) = 0 and j.cerrado then 'cerrado'
    when count(t.id) = 0 then 'sin_registro'
    when bool_or(t.is_draft) then 'borrador'
    when j.es_turno_unico
      or cfg.dias_unicos @> to_jsonb(extract(dow from j.fecha)::int)
      or (bool_or(t.tipo = 'mañana') and bool_or(t.tipo = 'tarde')) then 'completo'
    else 'parcial'
  end as estado,
  coalesce(sum(t.efectivo), 0)          as efectivo,
  coalesce(sum(t.getnet), 0)            as getnet,
  coalesce(sum(t.mercadopago), 0)       as mercadopago,
  coalesce(sum(t.edenred), 0)           as edenred,
  coalesce(sum(t.amipass), 0)           as amipass,
  coalesce(sum(t.transferencia), 0)     as transferencia,
  coalesce(sum(t.total_ventas), 0)      as total_ventas,
  coalesce(sum(t.prov_efectivo), 0)     as prov_efectivo,
  coalesce(sum(t.prov_transferencia), 0) as prov_transferencia,
  coalesce(sum(t.total_proveedores), 0) as total_proveedores,
  coalesce(sum(t.neto), 0)              as neto,
  coalesce(sum(t.efectivo_neto), 0)     as efectivo_neto,
  coalesce(sum(t.efectivo_esperado), 0) as efectivo_esperado,
  max(t.updated_at)                     as updated_at,
  -- Columnas nuevas, siempre al final.
  j.cerrado,
  j.motivo_cierre,
  j.cerrado_en,
  j.cerrado_por
from public.jornadas j
cross join cfg
left join public.v_turnos t on t.jornada_id = j.id
group by j.id, j.fecha, j.es_turno_unico, cfg.dias_unicos,
         j.cerrado, j.motivo_cierre, j.cerrado_en, j.cerrado_por;

-- ------------------------------------------------------------
-- 3. resumen_periodo(): dias_cerrados y dias_periodo
-- ------------------------------------------------------------
-- dias_con_registro NO cambia (sigue siendo turnos > 0): lo usan los
-- KPI de Análisis, el reporte, los correos y la condición de "no
-- enviar correo", y sus números están validados contra la app antigua.
create or replace function public.resumen_periodo(p_desde date, p_hasta date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with dias as (
    select * from public.v_resumen_dia
    where fecha between p_desde and p_hasta
  ),
  ant as (
    select * from public.v_resumen_dia
    where fecha between p_desde - (p_hasta - p_desde + 1) and p_desde - 1
  ),
  tot as (
    select coalesce(sum(total_ventas), 0)      as total_ventas,
           coalesce(sum(total_proveedores), 0) as total_proveedores,
           coalesce(sum(prov_efectivo), 0)     as prov_efectivo,
           coalesce(sum(prov_transferencia), 0) as prov_transferencia,
           coalesce(sum(neto), 0)              as neto,
           coalesce(sum(efectivo_neto), 0)     as efectivo_neto,
           coalesce(sum(efectivo), 0)          as efectivo,
           coalesce(sum(getnet), 0)            as getnet,
           coalesce(sum(mercadopago), 0)       as mercadopago,
           coalesce(sum(edenred), 0)           as edenred,
           coalesce(sum(amipass), 0)           as amipass,
           coalesce(sum(transferencia), 0)     as transferencia,
           count(*) filter (where turnos > 0)::int as dias_con_registro,
           count(*) filter (where tiene_borrador)::int as dias_con_borrador,
           count(*) filter (where cerrado)::int as dias_cerrados
    from dias
  ),
  tot_ant as (
    select coalesce(sum(total_ventas), 0)      as total_ventas,
           coalesce(sum(total_proveedores), 0) as total_proveedores,
           coalesce(sum(neto), 0)              as neto,
           coalesce(sum(efectivo_neto), 0)     as efectivo_neto,
           count(*) filter (where turnos > 0)::int as dias_con_registro,
           count(*) filter (where cerrado)::int as dias_cerrados
    from ant
  ),
  top as (
    select pt.proveedor_id,
           coalesce(pf.nombre, pt.nombre) as nombre,
           pf.imagen_url,
           sum(pt.monto) as monto,
           count(*)::int as compras
    from public.proveedores_turno pt
    join public.turnos t on t.id = pt.turno_id and t.deleted_at is null
    join public.jornadas j on j.id = t.jornada_id
    left join public.proveedores_frecuentes pf on pf.id = pt.proveedor_id
    where j.fecha between p_desde and p_hasta
    group by pt.proveedor_id, coalesce(pf.nombre, pt.nombre), pf.imagen_url
    order by monto desc
    limit 5
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    -- Días del calendario en el rango: el denominador de los correos.
    'dias_periodo', (p_hasta - p_desde + 1),
    'dias', (select coalesce(jsonb_agg(to_jsonb(d) order by d.fecha), '[]'::jsonb) from dias d),
    'totales', (select to_jsonb(tot) from tot),
    'anterior', (select to_jsonb(tot_ant) from tot_ant),
    'top_proveedores', (select coalesce(jsonb_agg(to_jsonb(top)), '[]'::jsonb) from top)
  );
$$;

revoke execute on function public.resumen_periodo(date, date) from public, anon;
grant execute on function public.resumen_periodo(date, date) to authenticated;

-- ------------------------------------------------------------
-- 4. Triggers: un día marcado y un turno activo no pueden coexistir
-- ------------------------------------------------------------
-- El RPC valida, pero la política "jornadas: dueño puede actualizar"
-- permite marcar el día con un PATCH directo, y restaurar un turno
-- desde la papelera (update turnos set deleted_at = null) esquivaría
-- cualquier guarda que viviera solo en guardar_turno(). Los triggers
-- cierran las dos puertas de una vez, y dan el mismo mensaje legible
-- que el RPC (mensajeDeError lo muestra tal cual en el toast).
create or replace function public.turno_en_dia_cerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
begin
  if new.deleted_at is not null then
    return new;  -- un turno en la papelera no ocupa el día
  end if;
  select j.fecha into v_fecha
  from public.jornadas j
  where j.id = new.jornada_id and j.cerrado;
  if found then
    raise exception 'El % está marcado como día sin abrir; quita la marca para registrar un turno', v_fecha
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists turno_en_dia_cerrado on public.turnos;
create trigger turno_en_dia_cerrado
  before insert or update on public.turnos
  for each row execute function public.turno_en_dia_cerrado();

create or replace function public.jornada_cerrada_sin_turnos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cerrado and not coalesce(old.cerrado, false)
     and exists (select 1 from public.turnos t where t.jornada_id = new.id and t.deleted_at is null) then
    raise exception 'El % ya tiene turnos registrados; elimínalos antes de marcarlo como día sin abrir', new.fecha
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists jornada_cerrada_sin_turnos on public.jornadas;
create trigger jornada_cerrada_sin_turnos
  before update on public.jornadas
  for each row execute function public.jornada_cerrada_sin_turnos();

revoke execute on function public.turno_en_dia_cerrado() from public, anon, authenticated;
revoke execute on function public.jornada_cerrada_sin_turnos() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. marcar_dia_cerrado(): la puerta de la app
-- ------------------------------------------------------------
-- Un día a la vez y nunca a futuro. El motivo es opcional (máx. 60).
-- La guarda de permisos deja pasar a postgres sin JWT, como
-- verificar_integridad(), para poder corregir datos por MCP.
create or replace function public.marcar_dia_cerrado(
  p_fecha date,
  p_cerrado boolean default true,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Santiago')::date;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_fila jsonb;
begin
  if auth.uid() is not null and not public.es_dueno() then
    raise exception 'solo la dueña puede marcar un día sin abrir'
      using errcode = 'insufficient_privilege';
  end if;
  if p_fecha is null then
    raise exception 'Falta la fecha' using errcode = 'invalid_parameter_value';
  end if;
  if p_fecha > v_hoy then
    raise exception 'Todavía no se puede marcar un día que no ha pasado'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.jornadas (fecha) values (p_fecha) on conflict (fecha) do nothing;
  -- Serializa contra guardar_turno, que bloquea la misma fila.
  perform 1 from public.jornadas where fecha = p_fecha for update;

  if p_cerrado and exists (
    select 1 from public.turnos t
    join public.jornadas j on j.id = t.jornada_id
    where j.fecha = p_fecha and t.deleted_at is null
  ) then
    raise exception 'El % ya tiene turnos registrados; elimínalos antes de marcarlo como día sin abrir', p_fecha
      using errcode = 'check_violation';
  end if;

  update public.jornadas set
    cerrado       = p_cerrado,
    motivo_cierre = case when p_cerrado then v_motivo end,
    cerrado_en    = case when p_cerrado then now() end,
    cerrado_por   = case when p_cerrado then auth.uid() end
  where fecha = p_fecha;

  select to_jsonb(v) into v_fila from public.v_resumen_dia v where v.fecha = p_fecha;
  return v_fila;
end;
$$;

revoke execute on function public.marcar_dia_cerrado(date, boolean, text) from public, anon;
grant execute on function public.marcar_dia_cerrado(date, boolean, text) to authenticated;

-- ------------------------------------------------------------
-- 6. verificar_integridad(): un error y un aviso nuevos
-- ------------------------------------------------------------
-- Copia de 20260918000000_integridad.sql con dos reglas al final:
--   error  'día sin abrir con turnos activos'  (la invariante)
--   aviso  'día sin registro ni marca'         (el olvido, que hasta
--          ahora no se veía en ninguna parte)
-- El aviso mira solo los últimos 45 días y salta ayer y hoy: la dueña
-- cierra tarde, y sin ventana traería los ~125 días de enero a abril
-- de 2026, cuando el uso todavía era disparejo.
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
    select t.*, j.fecha, j.es_turno_unico, j.cerrado
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
    select 'error', 'día sin abrir con turnos activos',
           a.fecha::text
    from activos a
    where a.cerrado

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

    union all
    -- Ni turnos ni marca: o se olvidó registrar, o el local no abrió y
    -- falta marcarlo. Ayer queda fuera porque puede cerrarse hoy.
    select 'aviso', 'día sin registro ni marca (últimos 45 días)',
           d.fecha::date::text
    from generate_series(v_hoy - 45, v_hoy - 2, interval '1 day') d(fecha)
    where not exists (
      select 1 from jornadas j
      join turnos t on t.jornada_id = j.id and t.deleted_at is null
      where j.fecha = d.fecha::date
    )
    and not exists (select 1 from jornadas j where j.fecha = d.fecha::date and j.cerrado)
  )
  select h.sev, h.regla, count(*), min(h.ej)
  from hallazgos h
  group by h.sev, h.regla
  order by h.sev, h.regla;
end;
$$;

revoke execute on function public.verificar_integridad() from public, anon;
grant execute on function public.verificar_integridad() to authenticated, service_role;
