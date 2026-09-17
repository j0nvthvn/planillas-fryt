-- ============================================================
-- Tests pgTAP de los correos (20260920000000_correos_preferencias):
-- destinatarios, programación por hora de Chile, sin duplicados, RLS.
-- Misma precondición que fase1.test.sql. Sin secretos en Vault:
-- invocar_edge_function solo deja un WARNING, así que nada sale.
-- ============================================================
\set ON_ERROR_STOP on
\set QUIET on
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
set client_min_messages = error;

select * from no_plan();

create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.como_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

\set duena '00000000-0000-4000-8000-000000000001'
\set local '00000000-0000-4000-8000-000000000002'

-- ============================================================
-- 1. Destinatarios
-- ============================================================
select is(
  (select count(*)::int from correo_destinatarios where usuario_id = :'duena' and cierre and semanal and mensual and not diario),
  1, 'la dueña queda sembrada con cierre, semanal y mensual (diario apagado)');
select is(
  (select count(*)::int from correo_destinatarios where usuario_id = :'local'),
  0, 'el trabajador no recibe correos');

insert into correo_destinatarios (email, nombre) values ('  Contador@Ejemplo.CL ', ' Contador ');
select is((select nombre from correo_destinatarios where email = 'contador@ejemplo.cl'), 'Contador',
  'el correo se guarda en minúsculas y sin espacios');
select throws_ok($$insert into correo_destinatarios (email) values ('no-es-correo')$$, '23514', null,
  'un correo inválido se rechaza');
select throws_ok($$insert into correo_destinatarios (email) values ('CONTADOR@ejemplo.cl')$$, '23505', null,
  'no se repite un correo');

-- Un dueño nuevo entra solo.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000009', 'nuevo@test.local');
insert into usuarios (id, nombre, email, rol) values ('00000000-0000-4000-8000-000000000009', 'Nuevo', 'nuevo@test.local', 'dueño');
select is((select count(*)::int from correo_destinatarios where email = 'nuevo@test.local'), 1,
  'un dueño nuevo queda como destinatario');

-- RLS
select pg_temp.como(:'local');
select is((select count(*)::int from correo_destinatarios), 0, 'el trabajador no ve los destinatarios');
select throws_ok($$insert into correo_destinatarios (email) values ('x@y.cl')$$, '42501', null,
  'el trabajador no agrega destinatarios');
select throws_ok($$select enviar_correo_prueba('semanal')$$, '42501', null,
  'el trabajador no manda pruebas');
select pg_temp.como(:'duena');
select ok((select count(*) from correo_destinatarios) >= 3, 'la dueña ve los destinatarios');
delete from correo_destinatarios where usuario_id = :'duena';
select is((select count(*)::int from correo_destinatarios where usuario_id = :'duena'), 1,
  'una cuenta no se borra desde la lista (se desactiva)');
delete from correo_destinatarios where email = 'contador@ejemplo.cl';
select is((select count(*)::int from correo_destinatarios where email = 'contador@ejemplo.cl'), 0,
  'un correo suelto sí se borra');
select throws_matching($$select enviar_correo_prueba('semanal')$$, 'no están configurados',
  'sin Vault, la prueba avisa en vez de fallar callada');
select pg_temp.como_postgres();
select ok(not has_table_privilege('authenticated', 'public.correos_enviados', 'SELECT'),
  'correos_enviados no se expone a la API');

-- ============================================================
-- 2. Programación (hora de Chile, una vez por período)
-- ============================================================
update configuracion set valor = 'true'::jsonb where clave = 'notificaciones_activas';
delete from correos_enviados;

-- Invierno (UTC−4): lunes 6 jul 2026, 12:10 UTC = 08:10 en Chile.
select is(programar_resumenes('2026-07-06 12:10+00'), array['semanal'],
  'invierno, lunes 08:00: semanal (diario apagado para todos)');
select is(programar_resumenes('2026-07-06 11:10+00'), '{}'::text[],
  'invierno, 07:10 en Chile: nada');

-- Verano (UTC−3, desde principios de septiembre): lunes 21 sept, 11:10 UTC = 08:10.
select is(programar_resumenes('2026-09-21 11:10+00'), array['semanal'],
  'verano, lunes 08:00: semanal');
select is(programar_resumenes('2026-09-21 11:40+00'), '{}'::text[],
  'la misma hora no vuelve a mandar');
select is((select periodo from correos_enviados where tipo = 'semanal' and periodo > '2026-09-01'), '2026-09-14'::date,
  'el semanal cubre la semana anterior (desde el lunes 14)');
select is(programar_resumenes('2026-09-21 12:10+00'), '{}'::text[],
  'verano, 12:10 UTC ya son las 09:10: nada');

update correo_destinatarios set diario = true where usuario_id = :'duena';
-- Jueves 1 oct 2026: 11:05 UTC = 08:05.
select is(programar_resumenes('2026-10-01 11:05+00'), array['diario', 'mensual'],
  'día 1 a las 08:00: diario y mensual');
select is((select periodo from correos_enviados where tipo = 'mensual'), '2026-09-01'::date,
  'el mensual cubre septiembre');

select is(programar_resumenes('2026-12-15 11:05+00'), array['diario'],
  'diciembre: diario a las 08:00 de Chile');

update configuracion set valor = '21'::jsonb where clave = 'correos_hora';
select is(programar_resumenes('2026-12-18 00:05+00'), array['diario'],
  'la hora se configura (21:00 del 17 de diciembre)');
select ok(exists (select 1 from correos_enviados where tipo = 'diario' and periodo = '2026-12-16'),
  'a las 21:00 el diario resume el día anterior');

update configuracion set valor = 'false'::jsonb where clave = 'notificaciones_activas';
select is(programar_resumenes('2026-12-20 00:05+00'), '{}'::text[],
  'con los correos apagados no se programa nada');
update configuracion set valor = 'true'::jsonb where clave = 'notificaciones_activas';

update correo_destinatarios set activo = false;
select is(programar_resumenes('2026-12-21 00:05+00'), '{}'::text[],
  'sin destinatarios activos no se programa nada');
select is((select count(*)::int from correos_enviados where periodo = '2026-12-20'), 0,
  'y tampoco se marca como enviado');

select is((select count(*)::int from cron.job where jobname = 'resumenes' and schedule = '5 * * * *'), 1,
  'un solo cron por hora');
select is((select count(*)::int from cron.job where jobname in ('resumen-diario', 'resumen-semanal')), 0,
  'los crons antiguos ya no están');

select * from finish();
rollback;
