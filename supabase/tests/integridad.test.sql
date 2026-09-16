-- ============================================================
-- Tests pgTAP de 20260918000000_integridad.sql: auditoría, cierres
-- inmutables, permisos, CHECKs y verificar_integridad().
--
-- Misma precondición que fase1.test.sql (seed_test.sql + todas las
-- migraciones). Todo corre en una transacción que se revierte.
-- ============================================================
\set ON_ERROR_STOP on
\set QUIET on
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

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
\set j1 '10000000-0000-4000-8000-000000000001'
\set t1 '20000000-0000-4000-8000-000000000001'
\set t2 '20000000-0000-4000-8000-000000000002'
\set t4 '20000000-0000-4000-8000-000000000004'

-- ============================================================
-- 1. verificar_integridad() sobre el seed
-- ============================================================
select is(
  (select array_agg(chequeo order by chequeo) from verificar_integridad() where severidad = 'error'),
  null::text[],
  'el seed no tiene errores de integridad');
select is(
  (select ejemplo from verificar_integridad() where chequeo = 'borrador de un día pasado'),
  '2026-09-14 mañana',
  'avisa el borrador del 2026-09-14');

-- Totales que no coinciden con el último cierre (edición sin corrección)
update ventas_turno set efectivo = efectivo + 1 where turno_id = :'t4';
select is(
  (select ejemplo from verificar_integridad() where chequeo = 'totales actuales distintos del último cierre'),
  '2026-09-13 mañana',
  'detecta un turno cerrado editado sin corrección');
update ventas_turno set efectivo = efectivo - 1 where turno_id = :'t4';

-- Día completo con tarde: vacía = aviso, con ventas = error
update jornadas set es_turno_unico = true where id = :'j1';
select is(
  (select severidad from verificar_integridad() where chequeo = 'día completo con turno de tarde activo'),
  'error',
  'día completo con tarde con ventas es error');
update jornadas set es_turno_unico = false where id = :'j1';

select pg_temp.como(:'local');
select throws_ok($$ select * from verificar_integridad() $$, '42501', null,
  'un trabajador no puede ejecutar verificar_integridad');
select pg_temp.como(:'duena');
select lives_ok($$ select * from verificar_integridad() $$, 'la dueña sí puede');
select pg_temp.como_postgres();

-- ============================================================
-- 2. Auditoría
-- ============================================================
delete from auditoria;

-- Reescritura sin cambios (como el autoguardado de la app actual)
select pg_temp.como(:'duena');
update proveedores_turno set monto = monto where turno_id = :'t1';
select pg_temp.como_postgres();
select is((select count(*)::int from auditoria), 0,
  'una reescritura sin cambios no se audita (aunque cambie updated_at)');

select pg_temp.como(:'duena');
update ventas_turno set getnet = 90000 where turno_id = :'t1';
select pg_temp.como_postgres();
select is(
  (select (antes->>'getnet') || '→' || (despues->>'getnet') from auditoria where tabla = 'ventas_turno'),
  '85000→90000',
  'un cambio real guarda antes y después');
select is((select usuario_id from auditoria where tabla = 'ventas_turno'), :'duena'::uuid,
  '…y quién lo hizo');

-- "Eliminar definitivamente" desde la papelera (app actual), como dueña
select pg_temp.como(:'duena');
update turnos set deleted_at = now() where id = :'t2';
delete from turnos where id = :'t2';
select pg_temp.como_postgres();
select is((select count(*)::int from turnos where id = :'t2'), 0, 'la dueña puede borrar un turno definitivamente');
select is((select count(*)::int from turno_cierres where turno_id = :'t2'), 0, '…y la cascada borra sus cierres');
select is(
  (select array_agg(tabla order by tabla) from auditoria
   where operacion = 'DELETE' and (antes->>'id' = :'t2' or antes->>'turno_id' = :'t2')),
  array['proveedores_turno', 'turno_cierres', 'turnos', 'ventas_turno'],
  'todo lo borrado queda en auditoria');
select is(
  (select (antes->>'total_ventas')::numeric from auditoria
   where tabla = 'turno_cierres' and antes->>'turno_id' = :'t2'),
  220000::numeric,
  '…con los datos para reconstruirlo');

-- Borrar una jornada entera también pasa la cascada
delete from jornadas where id = :'j1';
select ok(exists (select 1 from auditoria where tabla = 'turno_cierres' and antes->>'turno_id' = :'t1'),
  'borrar una jornada deja sus cierres en auditoria');

-- Tablas con otra clave primaria
update metodos_pago set label = label || ' ' where key = 'getnet';
select is((select registro from auditoria where tabla = 'metodos_pago'), 'getnet',
  'metodos_pago se audita por su clave');

-- Lectura y escritura
select pg_temp.como(:'local');
select is((select count(*)::int from auditoria), 0, 'un trabajador no ve la auditoría');
select throws_ok($$ insert into auditoria (tabla, operacion) values ('x', 'INSERT') $$, '42501', null,
  'nadie inserta en auditoria directamente');
select pg_temp.como(:'duena');
select ok((select count(*) from auditoria) > 0, 'la dueña ve la auditoría');
select throws_ok($$ delete from auditoria $$, '42501', null, 'ni la dueña puede borrar la auditoría');
select pg_temp.como_postgres();

-- ============================================================
-- 3. turno_cierres inmutable
-- ============================================================
select throws_ok(
  format('update turno_cierres set total_ventas = 1 where turno_id = %L', :'t4'),
  '42501', null, 'un cierre no se puede modificar (ni como postgres)');
select throws_ok(
  format('delete from turno_cierres where turno_id = %L', :'t4'),
  '42501', null, 'un cierre no se puede borrar suelto');

set local frytcontrol.permitir_cambiar_cierres = 'on';
select lives_ok(
  format('update turno_cierres set efectivo_contado = efectivo_contado where turno_id = %L', :'t4'),
  'la válvula de mantenimiento permite modificarlo');
set local frytcontrol.permitir_cambiar_cierres = 'off';

-- cerrar/corregir siguen funcionando
select pg_temp.como(:'duena');
update ventas_turno set efectivo = 210000 where turno_id = :'t4';
select lives_ok(format('select corregir_turno(%L, null)', :'t4'), 'corregir_turno sigue funcionando');
select pg_temp.como_postgres();

-- ============================================================
-- 4. Permisos y CHECKs
-- ============================================================
select ok(not has_table_privilege('authenticated', 'public.turnos', 'TRUNCATE'), 'authenticated sin TRUNCATE');
select ok(not has_table_privilege('anon', 'public.jornadas', 'TRUNCATE'), 'anon sin TRUNCATE');
select ok(not has_table_privilege('authenticated', 'public.turno_cierres', 'DELETE'), 'sin DELETE directo en cierres');
select ok(has_table_privilege('authenticated', 'public.turnos', 'DELETE'), 'DELETE en turnos se mantiene (papelera)');

select throws_ok(format('update turnos set fondo_inicial = -1 where id = %L', :'t4'), '23514', null,
  'fondo inicial negativo rechazado');

select * from finish();
rollback;
