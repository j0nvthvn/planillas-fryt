-- ============================================================
-- Tests pgTAP de la Fase 1 (catálogo de proveedores, trabajadores,
-- totales/vistas, guardar_turno) y de las políticas RLS.
--
-- Precondición: base local reseteada a la Fase 0, seed_test.sql
-- cargado y DESPUÉS las migraciones 20260916* aplicadas (así se prueba
-- el saneo del catálogo sobre datos sucios). Ver docs/operacion.md.
--
--   docker exec -i supabase_db_planillas-fryt psql -U postgres \
--     -v ON_ERROR_STOP=1 -q < supabase/tests/fase1.test.sql
--
-- Todo corre en una transacción que se revierte al final.
-- ============================================================
\set ON_ERROR_STOP on
\set QUIET on
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- Las aserciones se ejecutan también con el rol authenticated (para
-- que RLS aplique); se le da EXECUTE a pgtap solo dentro de esta
-- transacción.
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select * from no_plan();

-- ---- helpers de sesión ----
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
\set t1 '20000000-0000-4000-8000-000000000001'
\set t2 '20000000-0000-4000-8000-000000000002'
\set t3 '20000000-0000-4000-8000-000000000003'
\set t4 '20000000-0000-4000-8000-000000000004'
\set t5 '20000000-0000-4000-8000-000000000005'

-- ============================================================
-- 1. Catálogo tras la migración sobre datos sucios
-- ============================================================
select is((select count(*)::int from proveedores_frecuentes where nombre_norm = 'pf'), 1,
  'PF/Pf quedó como un solo proveedor');
select is((select nombre from proveedores_frecuentes where nombre_norm = 'pf'), 'PF',
  'sobrevive la grafía más usada (PF)');
select is((select imagen_url from proveedores_frecuentes where nombre_norm = 'pf'), null,
  'el duplicado eliminado no transfiere el logo (eso lo hace fusionar_proveedores)');
select is((select count(*)::int from proveedores_frecuentes where nombre_norm = 'nestlelacteos'), 1,
  'Nestlé Lacteos/lacteos fusionados');
select ok(exists (select 1 from proveedores_frecuentes where nombre = 'Soprole'),
  'un nombre usado en turnos pero ausente del catálogo se agregó');
select is((select count(*)::int from proveedores_turno where proveedor_id is null), 0,
  'todas las filas de proveedores_turno quedaron vinculadas');
select is((select nombre from proveedores_turno where turno_id = :'t2'), 'PF',
  '"Pf" en un turno se canonicalizó a "PF"');
select is((select count(*)::int from proveedores_turno where turno_id = :'t3' and nombre = 'Río Maipo'), 1,
  '"Rio Maipo" (sin tilde) se unió a "Río Maipo"');
select is((select nombre from proveedores_turno where turno_id = :'t3' and monto = 30000),
  (select nombre from proveedores_frecuentes where nombre_norm = 'nestlelacteos'),
  'la fila del turno usa la grafía que sobrevivió en el catálogo');
select is((select nombre from proveedores_frecuentes where nombre_norm = 'nestlelacteos'), 'Nestlé lacteos',
  'sobrevive la grafía usada en turnos aunque sea minúscula (1 uso vs 0)');
select ok(exists (select 1 from pg_indexes where indexname = 'proveedores_frecuentes_nombre_norm_key'),
  'índice único por nombre normalizado');

-- ============================================================
-- 2. Triggers con escrituras "a la antigua" (solo nombre), como dueña
-- ============================================================
select pg_temp.como(:'duena');

insert into proveedores_turno (turno_id, nombre, monto, forma_pago) values (:'t5', 'p.f.', 5000, 'efectivo');
select is((select nombre from proveedores_turno where turno_id = :'t5' and monto = 5000), 'PF',
  'insert con "p.f." se vincula a PF y toma su nombre');
select is((select proveedor_id from proveedores_turno where turno_id = :'t5' and monto = 5000),
  (select id from proveedores_frecuentes where nombre_norm = 'pf'),
  'insert con nombre guarda el proveedor_id del catálogo');

insert into proveedores_turno (turno_id, nombre, monto, forma_pago) values (:'t5', '  Lucchetti ', 7000, 'transferencia');
select ok(exists (select 1 from proveedores_frecuentes where nombre = 'Lucchetti'),
  'un nombre nuevo crea la entrada del catálogo (sin espacios)');

-- upsert de guardarTurno() con una grafía distinta: se ignora en silencio
select lives_ok($$ insert into proveedores_frecuentes (nombre) values ('coca cola') on conflict (nombre) do nothing $$,
  'upsert de una grafía duplicada no falla');
select is((select count(*)::int from proveedores_frecuentes where nombre_norm = 'cocacola'), 1,
  '…y no crea un duplicado');

-- renombrar en el catálogo propaga a los turnos
update proveedores_frecuentes set nombre = 'PF Alimentos' where nombre_norm = 'pf';
select is((select count(*)::int from proveedores_turno where nombre = 'PF Alimentos'), 4,
  'renombrar en el catálogo actualiza todas las filas de turnos');
select is((select count(*)::int from proveedores_turno where nombre = 'PF'), 0,
  '…y no queda ninguna con el nombre viejo');

-- editar el nombre en un turno a otro proveedor existente lo re-vincula
update proveedores_turno set nombre = 'coca-cola' where turno_id = :'t5' and monto = 5000;
select is((select proveedor_id from proveedores_turno where turno_id = :'t5' and monto = 5000),
  (select id from proveedores_frecuentes where nombre_norm = 'cocacola'),
  'editar el nombre en un turno re-vincula al proveedor con ese nombre');
select is((select nombre from proveedores_turno where turno_id = :'t5' and monto = 5000), 'Coca-Cola',
  '…con la grafía canónica');

-- fusionar
select lives_ok(format($$ select fusionar_proveedores(%L, %L) $$,
  (select id from proveedores_frecuentes where nombre = 'Soprole'),
  (select id from proveedores_frecuentes where nombre = 'Lucchetti')),
  'la dueña puede fusionar proveedores');
select is((select count(*)::int from proveedores_frecuentes where nombre = 'Soprole'), 0,
  'el origen desaparece del catálogo');
select is((select nombre from proveedores_turno where turno_id = :'t3' and monto = 25000), 'Lucchetti',
  'los turnos del origen pasan al destino');

-- eliminar del catálogo un proveedor en uso: los turnos conservan el nombre
delete from proveedores_frecuentes where nombre = 'Lucchetti';
select results_eq(
  format($$ select nombre, proveedor_id from proveedores_turno where turno_id = %L and monto = 25000 $$, :'t3'),
  $$ values ('Lucchetti'::text, null::uuid) $$,
  'eliminar un proveedor en uso deja las filas con su nombre y sin catálogo');
-- …y al volver a usarlo por nombre, se recrea en el catálogo
insert into proveedores_frecuentes (nombre) values ('Lucchetti');
select is((select proveedor_id from proveedores_turno where turno_id = :'t3' and monto = 25000), null,
  'recrear el proveedor no re-vincula filas viejas automáticamente (eso lo hace fusionar/editar)');

select pg_temp.como(:'local');
select throws_ok(format($$ select fusionar_proveedores(%L, %L) $$,
  (select id from proveedores_frecuentes where nombre = 'Lucchetti'),
  (select id from proveedores_frecuentes where nombre = 'Coca-Cola')),
  'P0001', 'Solo el dueño puede fusionar proveedores',
  'un trabajador no puede fusionar');
select pg_temp.como_postgres();

-- ============================================================
-- 3. Totales, vistas y cuadre contra los cierres
-- ============================================================
select results_eq(
  format($$ select total_ventas, total_proveedores, neto, efectivo_neto, efectivo_esperado from turno_totales(%L) $$, :'t1'),
  $$ values (300000::numeric, 75000::numeric, 225000::numeric, 110000::numeric, 130000::numeric) $$,
  'turno_totales del turno corregido (getnet 80000→85000)');
select results_eq(
  format($$ select cantidad_cierres, corregido, efectivo_contado, diferencia_efectivo from v_turnos where id = %L $$, :'t1'),
  $$ values (2, true, 130000::numeric, 0::numeric) $$,
  'v_turnos conserva el conteo del cierre original tras una corrección sin conteo');
select is((select diferencia_efectivo from v_turnos where id = :'t3'), -5000::numeric,
  'diferencia negativa = faltan $5.000');
select is((select modo from v_turnos where id = :'t3'), 'completo',
  'mañana + turno único se expone como modo "completo"');
select results_eq(
  $$ select fecha::text, estado, es_dia_unico from v_resumen_dia order by fecha $$,
  $$ values ('2026-09-08', 'completo', false), ('2026-09-09', 'completo', true),
            ('2026-09-13', 'completo', true), ('2026-09-14', 'borrador', false) $$,
  'estado por día: mañana+tarde, día completo a mano, domingo por config, borrador');
select is((select total_ventas from v_resumen_dia where fecha = '2026-09-08'), 520000::numeric,
  'v_resumen_dia suma los dos turnos del día');
select is((select count(*)::int
           from turno_cierres c
           cross join lateral turno_totales(c.turno_id) t
           where c.turno_id <> :'t1' and (c.total_ventas <> t.total_ventas or c.total_proveedores <> t.total_proveedores)),
  0, 'los totales de los cierres coinciden con turno_totales (turnos sin corrección)');
select is((select (resumen_periodo('2026-09-08', '2026-09-14')->'totales'->>'total_ventas')::numeric), 1440000::numeric,
  'resumen_periodo suma el período');
select is((select resumen_periodo('2026-09-08', '2026-09-14')->'top_proveedores'->0->>'nombre'), 'PF Alimentos',
  'top proveedor del período usa el nombre actual del catálogo');
select is((select (resumen_periodo('2026-09-08', '2026-09-14')->'top_proveedores'->0->>'monto')::numeric), 70000::numeric,
  '…con el monto acumulado');
select is((select (resumen_periodo('2026-09-08', '2026-09-14')->'totales'->>'dias_con_borrador')::int), 1,
  'cuenta los días con borrador');

-- ============================================================
-- 4. guardar_turno como trabajador (cuenta del local)
-- ============================================================
select pg_temp.como(:'local');

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

insert into r values ('crea', guardar_turno($j${
  "fecha": "2026-09-15", "modo": "completo", "fondo_inicial": 20000,
  "ventas": {"efectivo": 100000, "getnet": 50000},
  "proveedores": [
    {"nombre": "coca cola", "monto": 12000, "forma_pago": "efectivo"},
    {"nombre": "Watts", "monto": 8000, "forma_pago": "transferencia"},
    {"nombre": "vacío", "monto": 0, "forma_pago": "efectivo"}
  ],
  "cerrar": false
}$j$));
select is((select v->>'modo' from r where k = 'crea'), 'completo', 'crea un día completo');
select is((select (v->>'is_draft')::boolean from r where k = 'crea'), true, '…como borrador');
select is((select (v->>'total_ventas')::numeric from r where k = 'crea'), 150000::numeric, '…con las ventas');
select is((select (v->>'total_proveedores')::numeric from r where k = 'crea'), 20000::numeric,
  '…con los proveedores (la fila en $0 se descarta)');
select is((select count(*)::int from proveedores_turno where turno_id = (select (v->>'id')::uuid from r where k = 'crea') and nombre = 'Coca-Cola'), 1,
  'el proveedor por nombre ("coca cola") quedó vinculado al catálogo con su grafía');
select ok(exists (select 1 from proveedores_frecuentes where nombre = 'Watts'),
  'el proveedor nuevo se agregó al catálogo');
select is((select es_turno_unico from jornadas where fecha = '2026-09-15'), true,
  'la jornada quedó marcada como turno único (compatible con la app actual)');

-- conflicto de versión
insert into r values ('conflicto', guardar_turno($j${
  "fecha": "2026-09-15", "modo": "completo", "ventas": {"efectivo": 1},
  "base_updated_at": "2020-01-01T00:00:00Z"
}$j$));
select is((select (v->>'conflicto')::boolean from r where k = 'conflicto'), true,
  'base_updated_at desactualizado devuelve conflicto');
select is((select (v->'actual'->>'total_ventas')::numeric from r where k = 'conflicto'), 150000::numeric,
  '…con el estado actual, sin escribir nada');

-- editar por diferencia y cerrar con conteo
insert into r values ('cierra', guardar_turno(jsonb_build_object(
  'fecha', '2026-09-15', 'modo', 'completo',
  'base_updated_at', (select v->>'updated_at' from r where k = 'crea'),
  'ventas', jsonb_build_object('efectivo', 100000, 'getnet', 50000, 'transferencia', 10000),
  'proveedores', jsonb_build_array(jsonb_build_object(
    'id', (select id from proveedores_turno where turno_id = (select (v->>'id')::uuid from r where k = 'crea') and monto = 12000),
    'nombre', 'PF Alimentos', 'monto', 15000, 'forma_pago', 'efectivo')),
  'cerrar', true, 'efectivo_contado', 100000
)));
select is((select (v->>'is_draft')::boolean from r where k = 'cierra'), false, 'cerrar = true cierra el turno');
select is((select (v->>'cantidad_cierres')::int from r where k = 'cierra'), 1, '…con un cierre registrado');
select is((select (v->>'total_proveedores')::numeric from r where k = 'cierra'), 15000::numeric,
  'el proveedor omitido se borró y el existente se actualizó');
select is((select (v->>'diferencia_efectivo')::numeric from r where k = 'cierra'), -5000::numeric,
  'diferencia = contado 100000 − esperado (20000+100000−15000)');

-- reglas de modo
select throws_ok($$ select guardar_turno('{"fecha":"2026-09-15","modo":"tarde","ventas":{"efectivo":1}}') $$,
  '23514', null, 'no se puede agregar tarde a un día completo');

-- trabajador no puede tocar un turno cerrado (RLS + chequeo explícito)
select throws_ok($$ select guardar_turno('{"fecha":"2026-09-15","modo":"completo","ventas":{"efectivo":999}}') $$,
  '42501', 'No tienes permiso para modificar este turno (ya está cerrado)',
  'un trabajador no puede editar un turno ya cerrado');
select is((select (v->>'total_ventas')::numeric from r where k = 'cierra'),
  (select total_ventas from v_turnos where id = (select (v->>'id')::uuid from r where k = 'crea')),
  '…y no cambió nada');

-- ============================================================
-- 5. guardar_turno como dueña: corrección, dividir el día
-- ============================================================
select pg_temp.como(:'duena');

insert into r values ('corrige', guardar_turno($j${
  "fecha": "2026-09-15", "modo": "completo",
  "ventas": {"efectivo": 100000, "getnet": 55000, "transferencia": 10000},
  "cerrar": true
}$j$));
select is((select (v->>'cantidad_cierres')::int from r where k = 'corrige'), 2, 'la dueña corrige un turno cerrado');
select is((select (v->>'corregido')::boolean from r where k = 'corrige'), true, '…y queda marcado como corregido');
select is((select (v->>'total_ventas')::numeric from r where k = 'corrige'), 165000::numeric, '…con las ventas nuevas');
select is((select (v->>'efectivo_contado')::numeric from r where k = 'corrige'), 100000::numeric,
  'el conteo original se conserva');

-- dividir: mañana (quita turno único) y luego tarde
insert into r values ('divide', guardar_turno($j${"fecha":"2026-09-15","modo":"mañana"}$j$));
select is((select es_turno_unico from jornadas where fecha = '2026-09-15'), false,
  'modo mañana desmarca el turno único');
insert into r values ('tarde', guardar_turno($j${"fecha":"2026-09-15","modo":"tarde","ventas":{"efectivo":30000}}$j$));
select is((select v->>'tipo' from r where k = 'tarde'), 'tarde', 'crea el turno de tarde');
select is((select turnos from v_resumen_dia where fecha = '2026-09-15'), 2, 'el día tiene dos turnos');
select throws_ok($$ select guardar_turno('{"fecha":"2026-09-15","modo":"completo"}') $$,
  '23514', null, 'no se puede volver a día completo si existe la tarde');

select pg_temp.como_postgres();

-- sin sesión
select throws_ok($$ select guardar_turno('{"fecha":"2026-09-16","modo":"completo"}') $$,
  '42501', null, 'sin sesión no se puede guardar');

select * from finish();
rollback;
