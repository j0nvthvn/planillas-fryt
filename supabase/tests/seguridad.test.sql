-- ============================================================
-- Tests pgTAP de 20260929000000_seguridad.sql: lo que cada tipo de
-- cuenta NO puede hacer (auditoría del 2026-09-28), y que el flujo
-- normal de la app sigue funcionando.
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
\set sin_perfil '00000000-0000-4000-8000-0000000000a1'
\set inactivo '00000000-0000-4000-8000-0000000000a2'
\set duena_inactiva '00000000-0000-4000-8000-0000000000a3'
\set j4 '10000000-0000-4000-8000-000000000004'
\set t5 '20000000-0000-4000-8000-000000000005'

-- Cuentas extra: una de Auth sin perfil (como la de prueba que quedó en
-- prod) y dos desactivadas, una trabajadora y una dueña.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (:'sin_perfil', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'huerfana@test.local', '', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'inactivo', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inactivo@test.local', '', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'duena_inactiva', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'exduena@test.local', '', now(), '{"provider":"email"}', '{}', now(), now());

insert into usuarios (id, nombre, email, rol, activo) values
  (:'inactivo', 'Inactivo', 'inactivo@test.local', 'trabajador', false),
  (:'duena_inactiva', 'Ex dueña', 'exduena@test.local', 'dueño', false);

-- ============================================================
-- 1. Cuenta de Auth sin perfil: no ve ni escribe nada (H3)
-- ============================================================
select pg_temp.como(:'sin_perfil');

select is((select count(*) from turnos), 0::bigint, 'sin perfil: no ve turnos');
select is((select count(*) from ventas_turno), 0::bigint, 'sin perfil: no ve ventas');
select is((select count(*) from turno_cierres), 0::bigint, 'sin perfil: no ve cierres');
select is((select count(*) from jornadas), 0::bigint, 'sin perfil: no ve jornadas');
select is((select count(*) from v_resumen_dia), 0::bigint, 'sin perfil: v_resumen_dia vacía');
select is((select count(*) from configuracion), 0::bigint, 'sin perfil: no ve la configuración');
select is((select count(*) from proveedores_frecuentes), 0::bigint, 'sin perfil: no ve el catálogo');
select throws_ok($$ insert into jornadas (fecha) values ('2026-08-01') $$,
  '42501', null, 'sin perfil: no crea jornadas');
select throws_ok($$ insert into proveedores_frecuentes (nombre) values ('Intruso') $$,
  '42501', null, 'sin perfil: no agrega proveedores');
select throws_ok($$ select guardar_turno('{"fecha":"2026-08-01","modo":"completo","ventas":{"efectivo":1}}') $$,
  '42501', null, 'sin perfil: guardar_turno falla');

-- ============================================================
-- 2. Cuenta desactivada: pierde el acceso (H2)
-- ============================================================
select pg_temp.como(:'inactivo');

select is((select count(*) from turnos), 0::bigint, 'desactivada: no ve turnos');
select is((select count(*) from usuarios), 1::bigint, 'desactivada: todavía ve su propia fila de usuarios');
select throws_ok($$ select guardar_turno('{"fecha":"2026-08-02","modo":"completo","ventas":{"efectivo":1}}') $$,
  '42501', null, 'desactivada: guardar_turno falla');

select pg_temp.como(:'duena_inactiva');
select is(es_dueno(), false, 'una dueña desactivada deja de ser dueña');
select is((select count(*) from turnos), 0::bigint, 'dueña desactivada: no ve turnos');
select throws_ok($$ select marcar_dia_cerrado('2026-08-03', true, null) $$,
  '42501', null, 'dueña desactivada: no marca días');

-- ============================================================
-- 3. Re-cierre de un turno ya cerrado (H1)
-- ============================================================
-- El turno 5 es el borrador de la cuenta del local (lunes 14).
select pg_temp.como(:'local');

select lives_ok(format($$ select cerrar_turno(%L, 50000) $$, :'t5'),
  'el local cierra su borrador');
select throws_ok(format($$ select cerrar_turno(%L, 70000) $$, :'t5'),
  '23514', 'El turno ya está cerrado; la dueña puede registrar una corrección',
  'el local NO puede volver a cerrar el turno con otro conteo');

select pg_temp.como_postgres();
select is((select count(*) from turno_cierres where turno_id = :'t5'), 1::bigint,
  'queda un solo cierre');
select is((select efectivo_contado from v_turnos where id = :'t5'), 50000::numeric,
  'y el conteo mostrado es el original');
select is((select count(*) from auditoria where tabla = 'turno_cierres' and operacion = 'INSERT'
           and registro = (select id::text from turno_cierres where turno_id = :'t5')), 1::bigint,
  'el cierre queda en la auditoría');

-- La dueña sí corrige (guardar_turno deriva a corregir_turno).
select pg_temp.como(:'duena');
select lives_ok($$ select guardar_turno('{"fecha":"2026-09-14","modo":"mañana","ventas":{"efectivo":60000},"cerrar":true}') $$,
  'la dueña corrige un turno cerrado con guardar_turno');
select is((select count(*) from turno_cierres where turno_id = :'t5' and es_correccion), 1::bigint,
  'la corrección queda registrada como tal');

-- Un turno en la papelera no se cierra.
select pg_temp.como_postgres();
insert into jornadas (id, fecha) values ('10000000-0000-4000-8000-0000000000b1', '2026-08-10');
insert into turnos (id, jornada_id, tipo, usuario_id, is_draft, deleted_at)
  values ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', 'mañana', :'local', true, now());
insert into ventas_turno (turno_id, efectivo) values ('20000000-0000-4000-8000-0000000000b1', 1000);
select pg_temp.como(:'duena');
select throws_ok($$ select cerrar_turno('20000000-0000-4000-8000-0000000000b1', null) $$,
  '23514', 'El turno está en la papelera', 'no se cierra un turno en la papelera');

-- ============================================================
-- 4. jornadas: la marca "No abrió" es solo de la dueña (M1)
-- ============================================================
select pg_temp.como(:'local');
select throws_ok(format($$ insert into jornadas (fecha, cerrado, cerrado_por, cerrado_en)
                          values ('2026-08-20', true, %L, now()) $$, :'duena'),
  '42501', null, 'el local no crea un día "No abrió" a nombre de la dueña');
select throws_ok($$ insert into jornadas (fecha, motivo_cierre) values ('2026-08-21', 'x') $$,
  '42501', null, 'ni con solo el motivo');
select lives_ok($$ insert into jornadas (fecha) values ('2026-08-22') $$,
  'sí crea una jornada limpia (lo que hace guardar_turno)');
select throws_ok($$ select marcar_dia_cerrado('2026-08-23', true, null) $$,
  '42501', null, 'y marcar_dia_cerrado sigue siendo solo de la dueña');

-- ============================================================
-- 5. turnos: solo borradores, y sin moverlos (L1)
-- ============================================================
select throws_ok(format($$ insert into turnos (jornada_id, tipo, usuario_id, is_draft)
                          select id, 'mañana', %L, false from jornadas where fecha = '2026-08-22' $$, :'local'),
  '42501', null, 'el local no inserta un turno ya "cerrado"');
select lives_ok(format($$ insert into turnos (id, jornada_id, tipo, usuario_id, is_draft)
                         select '20000000-0000-4000-8000-0000000000c1', id, 'mañana', %L, true
                         from jornadas where fecha = '2026-08-22' $$, :'local'),
  'sí inserta su borrador');
select throws_ok(format($$ update turnos set jornada_id = %L where id = '20000000-0000-4000-8000-0000000000c1' $$, :'j4'),
  '42501', 'Solo la dueña puede cambiar el día, el tipo o la cuenta de un turno',
  'el local no mueve su borrador a otro día');
select throws_ok($$ update turnos set tipo = 'tarde' where id = '20000000-0000-4000-8000-0000000000c1' $$,
  '42501', null, 'ni le cambia el tipo');
select lives_ok($$ update turnos set fondo_inicial = 15000 where id = '20000000-0000-4000-8000-0000000000c1' $$,
  'sí edita el fondo de su borrador');

select pg_temp.como(:'duena');
select lives_ok($$ update turnos set tipo = 'tarde' where id = '20000000-0000-4000-8000-0000000000c1' $$,
  'la dueña sí puede cambiar el tipo');

-- ============================================================
-- 6. Catálogo: el logo lo pone la dueña (L2)
-- ============================================================
select pg_temp.como(:'local');
select throws_ok($$ insert into proveedores_frecuentes (nombre, imagen_url) values ('Rastreo', 'https://evil.test/p.png') $$,
  '42501', null, 'el local no agrega un proveedor con logo externo');
select lives_ok($$ insert into proveedores_frecuentes (nombre) values ('Proveedor Nuevo') $$,
  'sí agrega un proveedor sin logo');

-- ============================================================
-- 7. logs_error acotado (L5)
-- ============================================================
select throws_ok($$ insert into logs_error (usuario_id, mensaje) values (null, 'anónimo') $$,
  '42501', null, 'no se registran errores sin usuario');
select lives_ok(format($$ insert into logs_error (usuario_id, mensaje) values (%L, 'propio') $$, :'local'),
  'sí con el usuario propio');
select throws_ok(format($$ insert into logs_error (usuario_id, mensaje, detalle)
                          values (%L, 'grande', jsonb_build_object('x', repeat(md5(random()::text), 2000))) $$, :'local'),
  '42501', null, 'un detalle de más de 16 KB se rechaza');

-- ============================================================
-- 8. Storage: solo la dueña escribe logos (M2)
-- ============================================================
select pg_temp.como(:'local');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('logos-proveedores', 'local.png') $$,
  '42501', null, 'el local no sube logos');
select pg_temp.como(:'duena');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('logos-proveedores', 'duena.png') $$,
  'la dueña sí');

select pg_temp.como_postgres();
select is((select file_size_limit from storage.buckets where id = 'logos-proveedores'), 1048576::bigint,
  'el bucket limita el tamaño a 1 MB');
select is((select allowed_mime_types from storage.buckets where id = 'logos-proveedores'),
  array['image/png', 'image/jpeg', 'image/webp'], 'y acepta solo imágenes');

select * from finish();
rollback;
