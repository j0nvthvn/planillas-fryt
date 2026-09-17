-- Datos reales para scripts/correos/vista-previa.ts (solo lectura).
-- Uso: psql "$URL" -qtA -v hoy=2026-09-17 -f datos-vista-previa.sql > datos.json
with p as (
  select :'hoy'::date as hoy
), r as (
  select
    hoy - 1 as dia,
    date_trunc('week', hoy)::date - 7 as sem_desde,
    date_trunc('week', hoy)::date - 1 as sem_hasta,
    (date_trunc('month', hoy) - interval '1 month')::date as mes_desde,
    (date_trunc('month', hoy)::date - 1) as mes_hasta
  from p
), c as (
  select c.*, j.fecha, j.es_turno_unico, t.tipo, t.fondo_inicial, tr.nombre as atendio
  from turno_cierres c
  join turnos t on t.id = c.turno_id
  join jornadas j on j.id = t.jornada_id
  left join trabajadores tr on tr.id = t.trabajador_id
  where not c.es_correccion
  order by c.cerrado_en desc
  limit 1
)
select jsonb_pretty(jsonb_build_object(
  'metodos', (select jsonb_agg(to_jsonb(m) order by orden) from metodos_pago m),
  'catalogo', (select jsonb_object_agg(lower(nombre), imagen_url) from proveedores_frecuentes where imagen_url is not null),
  'cierre', (select to_jsonb(c) from c),
  'diario', resumen_periodo(r.dia, r.dia),
  'diario_ant', resumen_periodo(r.dia - 1, r.dia - 1),
  'semanal', resumen_periodo(r.sem_desde, r.sem_hasta),
  'semanal_ant', resumen_periodo(r.sem_desde - 7, r.sem_hasta - 7),
  'mensual', resumen_periodo(r.mes_desde, r.mes_hasta),
  'mensual_ant', resumen_periodo((r.mes_desde - interval '1 month')::date, r.mes_desde - 1)
))
from r;
