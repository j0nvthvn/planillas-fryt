-- ============================================================
-- Tests pgTAP de 20260921000000_dias_cerrados.sql: marcar un día en
-- que el local no abrió, los triggers que sostienen la invariante,
-- el estado nuevo de v_resumen_dia y lo que reporta resumen_periodo.
--
-- Misma precondición que fase1.test.sql (seed_test.sql + todas las
-- migraciones). Todo corre en una transacción que se revierte, así
-- que las fechas que se crean acá no ensucian los otros archivos.
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

-- El seed vive en septiembre de 2026; estas fechas libres no chocan.
\set libre '2026-09-10'
\set libre2 '2026-09-11'

-- ============================================================
-- 1. Marcar un día sin jornada
-- ============================================================
select pg_temp.como(:'duena');

select lives_ok(
  format($$ select marcar_dia_cerrado(%L, true, 'Feriado') $$, :'libre'),
  'la dueña marca un día en que el local no abrió');

select is((select cerrado from jornadas where fecha = :'libre'), true,
  'la jornada se creó con la marca puesta');
select is((select motivo_cierre from jornadas where fecha = :'libre'), 'Feriado',
  'guarda el motivo');
select is((select cerrado_por from jornadas where fecha = :'libre'), :'duena'::uuid,
  'deja registrado quién lo marcó');
select isnt((select cerrado_en from jornadas where fecha = :'libre'), null,
  'y cuándo');

select is((select estado from v_resumen_dia where fecha = :'libre'), 'cerrado',
  'v_resumen_dia lo expone como estado "cerrado"');
select is((select turnos from v_resumen_dia where fecha = :'libre'), 0,
  'sin turnos');
select is((select neto from v_resumen_dia where fecha = :'libre'), 0::numeric,
  'y en cero, no nulo');

-- ============================================================
-- 2. El motivo es opcional y se sanea
-- ============================================================
select lives_ok(
  format($$ select marcar_dia_cerrado(%L, true, '   ') $$, :'libre2'),
  'un motivo en blanco es válido');
select is((select motivo_cierre from jornadas where fecha = :'libre2'), null,
  '…y queda en null, no en cadena vacía');
select throws_ok(
  format($$ select marcar_dia_cerrado(%L, true, %L) $$, :'libre2', repeat('x', 61)),
  '23514', null,
  'un motivo de más de 60 caracteres viola el CHECK');

-- ============================================================
-- 3. Quitar la marca
-- ============================================================
select lives_ok(
  format($$ select marcar_dia_cerrado(%L, false) $$, :'libre2'),
  'la dueña quita la marca');
select results_eq(
  format($$ select cerrado, motivo_cierre, cerrado_en, cerrado_por from jornadas where fecha = %L $$, :'libre2'),
  $$ values (false, null::text, null::timestamptz, null::uuid) $$,
  'quitar la marca limpia los cuatro campos');
select is((select estado from v_resumen_dia where fecha = :'libre2'), 'sin_registro',
  'y el día vuelve a estar sin registro');

-- ============================================================
-- 4. Un día con turnos no se puede marcar
-- ============================================================
select throws_ok(
  $$ select marcar_dia_cerrado('2026-09-08', true, 'Feriado') $$,
  '23514', null,
  'no se marca un día que ya tiene turnos registrados');
select is((select cerrado from jornadas where fecha = '2026-09-08'), false,
  'y el día queda como estaba');

-- El trigger cubre también el UPDATE directo, saltándose el RPC.
select throws_ok(
  format($$ update jornadas set cerrado = true where id = %L $$, :'j1'),
  '23514', null,
  'el trigger rechaza marcar por UPDATE directo un día con turnos');

-- ============================================================
-- 5. No se registran turnos en un día marcado
-- ============================================================
select throws_ok(
  format($$ select guardar_turno(jsonb_build_object(
              'fecha', %L, 'modo', 'completo',
              'ventas', jsonb_build_object('efectivo', 1000))) $$, :'libre'),
  '23514', null,
  'guardar_turno se niega a escribir en un día marcado');

select pg_temp.como_postgres();
select throws_ok(
  format($$ insert into turnos (jornada_id, tipo, fondo_inicial)
            select id, 'mañana', 0 from jornadas where fecha = %L $$, :'libre'),
  '23514', null,
  'ni un insert directo en turnos');

-- Restaurar desde la papelera es un update de deleted_at: misma regla.
insert into turnos (id, jornada_id, tipo, usuario_id, fondo_inicial, deleted_at)
select '20000000-0000-4000-8000-000000000099', id, 'tarde', :'duena', 0, now()
from jornadas where fecha = :'libre';
select lives_ok(
  $$ update turnos set fondo_inicial = 1 where id = '20000000-0000-4000-8000-000000000099' $$,
  'un turno en la papelera no estorba: se puede seguir editando');
select throws_ok(
  $$ update turnos set deleted_at = null where id = '20000000-0000-4000-8000-000000000099' $$,
  '23514', null,
  'pero no restaurarlo a un día marcado');
delete from turnos where id = '20000000-0000-4000-8000-000000000099';

-- ============================================================
-- 6. Permisos
-- ============================================================
select pg_temp.como(:'local');
select throws_ok(
  $$ select marcar_dia_cerrado('2026-09-12', true, 'Feriado') $$,
  '42501', null,
  'un trabajador no puede marcar un día');
select pg_temp.como(:'duena');

-- ============================================================
-- 7. Fechas futuras
-- ============================================================
select throws_ok(
  $$ select marcar_dia_cerrado((now() at time zone 'America/Santiago')::date + 1, true, 'Vacaciones') $$,
  '22023', null,
  'no se marca un día que todavía no pasa');

-- ============================================================
-- 8. resumen_periodo
-- ============================================================
select is(
  (select (resumen_periodo('2026-09-08', '2026-09-14')->'totales'->>'dias_cerrados')::int), 1,
  'resumen_periodo cuenta el día sin abrir');
select is(
  (select (resumen_periodo('2026-09-08', '2026-09-14')->'totales'->>'dias_con_registro')::int), 4,
  'y no lo cuenta como día con registro');
select is(
  (select (resumen_periodo('2026-09-08', '2026-09-14')->>'dias_periodo')::int), 7,
  'informa los días del calendario del período');
select is(
  (select (resumen_periodo('2026-09-08', '2026-09-14')->'totales'->>'total_ventas')::numeric), 1440000::numeric,
  'los totales del período no cambian');

-- ============================================================
-- 9. verificar_integridad()
-- ============================================================
select is(
  (select cantidad from verificar_integridad() where chequeo = 'día sin abrir con turnos activos'),
  null::bigint,
  'con datos sanos no hay días marcados con turnos');

-- Se fuerza la inconsistencia saltándose los triggers, como haría un bug.
select pg_temp.como_postgres();
alter table jornadas disable trigger jornada_cerrada_sin_turnos;
update jornadas set cerrado = true where id = :'j1';
alter table jornadas enable trigger jornada_cerrada_sin_turnos;
select pg_temp.como(:'duena');
select is(
  (select severidad from verificar_integridad() where chequeo = 'día sin abrir con turnos activos'),
  'error',
  'verificar_integridad() detecta un día marcado que tiene turnos');
select is((select estado from v_resumen_dia where fecha = '2026-09-08'), 'completo',
  'y la vista sigue mostrando el estado real: la marca no esconde el dinero');
select pg_temp.como_postgres();
alter table jornadas disable trigger jornada_cerrada_sin_turnos;
update jornadas set cerrado = false where id = :'j1';
alter table jornadas enable trigger jornada_cerrada_sin_turnos;
select pg_temp.como(:'duena');

-- El aviso del olvido mira los últimos 45 días, así que su cantidad
-- depende de la fecha en que corran los tests; basta con que exista.
select is(
  (select severidad from verificar_integridad()
   where chequeo = 'día sin registro ni marca (últimos 45 días)'),
  'aviso',
  'los días sin registro ni marca quedan como aviso, no como error');

select pg_temp.como_postgres();
select * from finish();
rollback;
