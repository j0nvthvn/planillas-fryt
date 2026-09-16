-- ============================================================
-- Limpieza de datos (Fase 0.5) — NO es una migración.
-- Correr a mano, paso a paso, con la dueña al lado, en el SQL Editor
-- de Supabase. Cada bloque primero MUESTRA lo que va a tocar; el
-- UPDATE va comentado hasta que se confirme.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Proveedores con el mismo nombre escrito distinto
--    (detectados el 2026-09-15: PF/Pf, Río Maipo/Rio Maipo,
--     Nestlé Lacteos/Nestlé lacteos, Comercial GAUNE/Comercial Gaune)
-- ------------------------------------------------------------
with n as (
  select nombre,
         lower(regexp_replace(translate(nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'), '[^a-zA-Z0-9]', '', 'g')) as clave,
         count(*) as usos
  from public.proveedores_turno
  group by nombre
)
select clave, json_agg(nombre || ' (' || usos || ')' order by usos desc) as variantes
from n group by clave having count(*) > 1 order by clave;

-- Nombre canónico elegido por la dueña → reemplaza en ambas tablas.
-- Ajustar la lista y descomentar:
-- with canon(viejo, nuevo) as (values
--   ('Pf',               'PF'),
--   ('Rio Maipo',        'Río Maipo'),
--   ('Nestlé lacteos',   'Nestlé Lácteos'),
--   ('Nestlé Lacteos',   'Nestlé Lácteos'),
--   ('Comercial GAUNE',  'Comercial Gaune')
-- )
-- , upd_turnos as (
--   update public.proveedores_turno pt set nombre = c.nuevo
--   from canon c where pt.nombre = c.viejo returning pt.id
-- )
-- , del_frec as (
--   -- Borra la variante vieja del catálogo si la nueva ya existe…
--   delete from public.proveedores_frecuentes pf
--   using canon c
--   where pf.nombre = c.viejo
--     and exists (select 1 from public.proveedores_frecuentes x where x.nombre = c.nuevo)
--   returning pf.id
-- )
-- -- …o la renombra si la nueva no existía.
-- update public.proveedores_frecuentes pf set nombre = c.nuevo
-- from canon c where pf.nombre = c.viejo;

-- ------------------------------------------------------------
-- 2. Borradores de días pasados (18 al 2026-09-15)
--    Decidir uno por uno desde Historial → Editar turno: cerrar
--    ("Guardar cambios" → queda con cierre) o eliminar (papelera).
--    Esta consulta es solo para tener la lista a mano.
-- ------------------------------------------------------------
select j.fecha, t.tipo, t.updated_at::date as ultima_edicion,
       (select coalesce(efectivo+getnet+mercadopago+edenred+amipass+transferencia, 0)
          from public.ventas_turno v where v.turno_id = t.id) as ventas,
       (select coalesce(sum(monto), 0) from public.proveedores_turno p where p.turno_id = t.id) as proveedores
from public.turnos t
join public.jornadas j on j.id = t.jornada_id
where t.is_draft and t.deleted_at is null and j.fecha < current_date
order by j.fecha;

-- ------------------------------------------------------------
-- 3. Días de semana con un solo turno "mañana" que en realidad fueron
--    día completo (una persona atendió todo el día). Marcarlos como
--    turno único para que Historial/Resumen no los muestren como
--    "parcial" ni ofrezcan "Agregar tarde".
-- ------------------------------------------------------------
select j.id, j.fecha, to_char(j.fecha, 'TMDay') as dia, j.es_turno_unico,
       (t.creado_en at time zone 'America/Santiago')::time(0) as hora_registro,
       (select coalesce(efectivo+getnet+mercadopago+edenred+amipass+transferencia, 0)
          from public.ventas_turno v where v.turno_id = t.id) as ventas
from public.jornadas j
join public.turnos t on t.jornada_id = j.id and t.deleted_at is null
where extract(dow from j.fecha) <> 0            -- domingos ya son turno único por configuración
  and not j.es_turno_unico
  and t.tipo = 'mañana'
  and not exists (select 1 from public.turnos t2 where t2.jornada_id = j.id and t2.tipo = 'tarde' and t2.deleted_at is null)
order by j.fecha desc;

-- Tras revisar la lista con la dueña, marcar las fechas confirmadas:
-- update public.jornadas set es_turno_unico = true
-- where fecha in ('2026-09-07', '2026-09-04', '2026-09-02', '2026-09-01', '2026-08-26' /* … */);

-- ============================================================
-- PILOTO (Fase 3, semana A): fórmula de la app actual vs. vistas de la v2.
-- Solo lectura. Debe dar 0 en todas las columnas diff_*.
-- ============================================================
with raw as (
  select j.id as jornada_id, j.fecha,
         sum(coalesce(v.efectivo,0)+coalesce(v.getnet,0)+coalesce(v.mercadopago,0)+coalesce(v.edenred,0)+coalesce(v.amipass,0)+coalesce(v.transferencia,0)) as ventas,
         coalesce(sum(p.total),0) as prov,
         sum(coalesce(t.fondo_inicial,0)+coalesce(v.efectivo,0)-coalesce(p.ef,0)) as caja
  from public.jornadas j
  join public.turnos t on t.jornada_id = j.id and t.deleted_at is null
  left join public.ventas_turno v on v.turno_id = t.id
  left join lateral (select sum(monto) as total, sum(monto) filter (where forma_pago='efectivo') as ef from public.proveedores_turno where turno_id = t.id) p on true
  where j.fecha >= current_date - 60
  group by j.id, j.fecha
)
select count(*) as dias,
       count(*) filter (where raw.ventas <> r.total_ventas) as diff_ventas,
       count(*) filter (where raw.prov <> r.total_proveedores) as diff_prov,
       count(*) filter (where raw.ventas - raw.prov <> r.neto) as diff_neto,
       count(*) filter (where raw.caja <> r.efectivo_esperado) as diff_caja
from raw join public.v_resumen_dia r on r.jornada_id = raw.jornada_id;

-- Errores registrados por la v2 durante el piloto:
-- select created_at, mensaje, contexto, ruta from public.logs_error where contexto like 'v2:%' order by created_at desc;
