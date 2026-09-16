-- ============================================================
-- 20260916000200_totales_vistas.sql  (Fase 1.3 del plan v2)
-- Una sola definición de los totales de un turno, en la base:
--   turno_totales(id)  → total_ventas, prov_efectivo, prov_transferencia,
--                        total_proveedores, neto, efectivo_neto,
--                        efectivo_esperado
--   v_turnos           → un turno por fila con todo lo que muestran las
--                        pantallas (fecha, modo, trabajador, ventas por
--                        método, totales, último cierre)
--   v_resumen_dia      → un día por fila (estado, sumas)
--   resumen_periodo()  → lo que necesita Análisis en una sola llamada
-- cerrar_turno / corregir_turno pasan a usar turno_totales (misma
-- firma y mismo resultado que antes).
--
-- Hasta ahora estos cálculos estaban repetidos en ~9 lugares (Hoy,
-- Resumen, Análisis, CSV, dos edge functions, dos funciones SQL) con
-- diferencias entre sí (p. ej. "Caja" con o sin fondo inicial).
--
-- Fórmulas:
--   neto              = total_ventas − total_proveedores (todos los métodos)
--   efectivo_neto     = ventas.efectivo − proveedores en efectivo
--                       (lo que el turno "generó" en billetes; sirve para
--                        sumar períodos sin contar el fondo varias veces)
--   efectivo_esperado = fondo_inicial + efectivo_neto
--                       (lo que debe haber físicamente en el cajón al
--                        cerrar ese turno; es lo que se compara con el
--                        conteo y lo que ya usaba cerrar_turno)
-- ============================================================

-- ------------------------------------------------------------
-- turno_totales
-- ------------------------------------------------------------
create or replace function public.turno_totales(p_turno_id uuid)
returns table (
  total_ventas numeric,
  prov_efectivo numeric,
  prov_transferencia numeric,
  total_proveedores numeric,
  neto numeric,
  efectivo_neto numeric,
  efectivo_esperado numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with v as (
    select coalesce(v.efectivo, 0) as efectivo,
           coalesce(v.efectivo, 0) + coalesce(v.getnet, 0) + coalesce(v.mercadopago, 0)
             + coalesce(v.edenred, 0) + coalesce(v.amipass, 0) + coalesce(v.transferencia, 0) as total
    from public.turnos t
    left join public.ventas_turno v on v.turno_id = t.id
    where t.id = p_turno_id
  ),
  p as (
    select coalesce(sum(monto) filter (where forma_pago = 'efectivo'), 0) as ef,
           coalesce(sum(monto) filter (where forma_pago = 'transferencia'), 0) as tr
    from public.proveedores_turno
    where turno_id = p_turno_id
  )
  select v.total,
         p.ef,
         p.tr,
         p.ef + p.tr,
         v.total - (p.ef + p.tr),
         v.efectivo - p.ef,
         coalesce((select fondo_inicial from public.turnos where id = p_turno_id), 0) + v.efectivo - p.ef
  from v, p;
$$;

-- ------------------------------------------------------------
-- v_turnos
-- ------------------------------------------------------------
-- security_invoker: aplica el RLS de las tablas base al usuario que
-- consulta (turnos/ventas/proveedores son legibles por cualquier
-- autenticado; usuarios solo por el dueño → usuario_nombre puede venir
-- null para la cuenta del local; la v2 muestra trabajador_nombre).
create or replace view public.v_turnos
with (security_invoker = true)
as
select
  t.id,
  t.jornada_id,
  j.fecha,
  t.tipo,
  -- "completo" = día registrado como un solo turno (mañana + turno único).
  case when j.es_turno_unico and t.tipo = 'mañana' then 'completo' else t.tipo end as modo,
  j.es_turno_unico,
  t.is_draft,
  coalesce(t.fondo_inicial, 0) as fondo_inicial,
  t.usuario_id,
  u.nombre as usuario_nombre,
  t.trabajador_id,
  tr.nombre as trabajador_nombre,
  t.creado_en,
  t.updated_at,
  coalesce(v.efectivo, 0)      as efectivo,
  coalesce(v.getnet, 0)        as getnet,
  coalesce(v.mercadopago, 0)   as mercadopago,
  coalesce(v.edenred, 0)       as edenred,
  coalesce(v.amipass, 0)       as amipass,
  coalesce(v.transferencia, 0) as transferencia,
  tt.total_ventas,
  tt.prov_efectivo,
  tt.prov_transferencia,
  tt.total_proveedores,
  tt.neto,
  tt.efectivo_neto,
  tt.efectivo_esperado,
  coalesce(c.cantidad_cierres, 0) as cantidad_cierres,
  coalesce(c.corregido, false)    as corregido,
  c.ultimo_cierre_en,
  c.efectivo_contado,
  -- Diferencia contra el esperado ACTUAL: si una corrección cambió las
  -- ventas en efectivo después del conteo, la diferencia se recalcula
  -- (la que quedó guardada en turno_cierres es la de ese momento).
  case when c.efectivo_contado is not null then c.efectivo_contado - tt.efectivo_esperado end as diferencia_efectivo
from public.turnos t
join public.jornadas j on j.id = t.jornada_id
left join public.ventas_turno v on v.turno_id = t.id
left join public.usuarios u on u.id = t.usuario_id
left join public.trabajadores tr on tr.id = t.trabajador_id
cross join lateral public.turno_totales(t.id) tt
left join lateral (
  select count(*)::int as cantidad_cierres,
         bool_or(es_correccion) as corregido,
         max(cerrado_en) as ultimo_cierre_en,
         -- Último conteo físico registrado (una corrección sin conteo no
         -- lo borra: el cajón se contó una vez, al cierre original).
         (array_agg(efectivo_contado order by cerrado_en desc)
            filter (where efectivo_contado is not null))[1] as efectivo_contado
  from public.turno_cierres tc
  where tc.turno_id = t.id
) c on true
where t.deleted_at is null;

-- ------------------------------------------------------------
-- v_resumen_dia
-- ------------------------------------------------------------
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
  max(t.updated_at)                     as updated_at
from public.jornadas j
cross join cfg
left join public.v_turnos t on t.jornada_id = j.id
group by j.id, j.fecha, j.es_turno_unico, cfg.dias_unicos;

-- ------------------------------------------------------------
-- resumen_periodo: todo lo de Análisis en una llamada
-- ------------------------------------------------------------
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
           count(*) filter (where tiene_borrador)::int as dias_con_borrador
    from dias
  ),
  tot_ant as (
    select coalesce(sum(total_ventas), 0)      as total_ventas,
           coalesce(sum(total_proveedores), 0) as total_proveedores,
           coalesce(sum(neto), 0)              as neto,
           coalesce(sum(efectivo_neto), 0)     as efectivo_neto,
           count(*) filter (where turnos > 0)::int as dias_con_registro
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
    'dias', (select coalesce(jsonb_agg(to_jsonb(d) order by d.fecha), '[]'::jsonb) from dias d),
    'totales', (select to_jsonb(tot) from tot),
    'anterior', (select to_jsonb(tot_ant) from tot_ant),
    'top_proveedores', (select coalesce(jsonb_agg(to_jsonb(top)), '[]'::jsonb) from top)
  );
$$;

revoke execute on function public.resumen_periodo(date, date) from public, anon;
grant execute on function public.resumen_periodo(date, date) to authenticated;
revoke execute on function public.turno_totales(uuid) from public, anon;
grant execute on function public.turno_totales(uuid) to authenticated;

-- ------------------------------------------------------------
-- cerrar_turno / corregir_turno sobre turno_totales
-- (misma firma, mismo snapshot, mismos permisos que la baseline)
-- ------------------------------------------------------------
create or replace function public._snapshot_turno(p_turno_id uuid)
returns table (ventas_snapshot jsonb, proveedores_snapshot jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select jsonb_build_object(
       'efectivo', v.efectivo, 'getnet', v.getnet, 'mercadopago', v.mercadopago,
       'edenred', v.edenred, 'amipass', v.amipass, 'transferencia', v.transferencia)
     from public.ventas_turno v where v.turno_id = p_turno_id),
    (select coalesce(jsonb_agg(jsonb_build_object(
       'nombre', nombre, 'monto', monto, 'forma_pago', forma_pago) order by creado_en), '[]'::jsonb)
     from public.proveedores_turno where turno_id = p_turno_id);
$$;

revoke execute on function public._snapshot_turno(uuid) from public, anon, authenticated;

create or replace function public.cerrar_turno(p_turno_id uuid, p_efectivo_contado numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos%rowtype;
  v_snap record;
  v_tot record;
  v_cierre_id uuid;
begin
  select * into v_turno from public.turnos where id = p_turno_id;
  if v_turno.id is null then
    raise exception 'El turno % no existe', p_turno_id;
  end if;

  if not (v_turno.usuario_id = auth.uid() or public.es_dueno()) then
    raise exception 'No tienes permiso para cerrar este turno';
  end if;

  if not exists (select 1 from public.ventas_turno where turno_id = p_turno_id) then
    raise exception 'El turno no tiene ventas registradas todavía';
  end if;

  select * into v_snap from public._snapshot_turno(p_turno_id);
  select * into v_tot from public.turno_totales(p_turno_id);

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id,
    efectivo_esperado, efectivo_contado, diferencia_efectivo
  ) values (
    p_turno_id, auth.uid(), v_snap.ventas_snapshot, v_snap.proveedores_snapshot,
    v_tot.total_ventas, v_tot.total_proveedores, false, null,
    v_tot.efectivo_esperado, p_efectivo_contado,
    case when p_efectivo_contado is not null then p_efectivo_contado - v_tot.efectivo_esperado end
  ) returning id into v_cierre_id;

  update public.turnos set is_draft = false where id = p_turno_id;

  return v_cierre_id;
end;
$$;

create or replace function public.corregir_turno(p_turno_id uuid, p_efectivo_contado numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap record;
  v_tot record;
  v_ultimo_cierre_id uuid;
  v_cierre_id uuid;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede registrar una corrección';
  end if;

  if not exists (select 1 from public.turnos where id = p_turno_id) then
    raise exception 'El turno % no existe', p_turno_id;
  end if;

  select id into v_ultimo_cierre_id
    from public.turno_cierres
    where turno_id = p_turno_id
    order by cerrado_en desc
    limit 1;

  if v_ultimo_cierre_id is null then
    raise exception 'Este turno no tiene un cierre previo que corregir';
  end if;

  select * into v_snap from public._snapshot_turno(p_turno_id);
  select * into v_tot from public.turno_totales(p_turno_id);

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id,
    efectivo_esperado, efectivo_contado, diferencia_efectivo
  ) values (
    p_turno_id, auth.uid(), v_snap.ventas_snapshot, v_snap.proveedores_snapshot,
    v_tot.total_ventas, v_tot.total_proveedores, true, v_ultimo_cierre_id,
    v_tot.efectivo_esperado, p_efectivo_contado,
    case when p_efectivo_contado is not null then p_efectivo_contado - v_tot.efectivo_esperado end
  ) returning id into v_cierre_id;

  return v_cierre_id;
end;
$$;
