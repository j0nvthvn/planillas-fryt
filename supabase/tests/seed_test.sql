-- ============================================================
-- Datos de prueba que reproducen los patrones reales de producción
-- (nombres de proveedor duplicados, día completo marcado a mano,
-- domingo de turno único, borrador sin cerrar, cierre con corrección).
-- Se carga sobre el esquema de la Fase 0 (hasta 20260915000200) y
-- DESPUÉS se aplican las migraciones de la Fase 1, para probar el
-- saneo y el backfill sobre datos "sucios". Ver docs/operacion.md.
--
-- Cuentas locales: duena@test.local / local@test.local, clave "password123".
-- ============================================================

begin;

-- ---- auth.users (mínimo para poder loguearse en local) ----
-- GoTrue no tolera NULL en las columnas de tokens (las lee como string),
-- por eso van como '' aunque no se usen.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'duena@test.local', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'local@test.local', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('duena@test.local', 'local@test.local')
on conflict do nothing;

insert into public.usuarios (id, nombre, email, rol) values
  ('00000000-0000-4000-8000-000000000001', 'Dueña Test', 'duena@test.local', 'dueño'),
  ('00000000-0000-4000-8000-000000000002', 'Local',      'local@test.local', 'trabajador')
on conflict (id) do nothing;

update public.configuracion set valor = '20000'::jsonb where clave = 'fondo_caja_inicial';

-- ---- catálogo con duplicados (como en prod: PF/Pf, Nestlé Lacteos/lacteos) ----
insert into public.proveedores_frecuentes (nombre, imagen_url) values
  ('PF', null),
  ('Pf', 'https://example.test/pf.png'),   -- duplicado con logo (debe sobrevivir el más usado: PF)
  ('Río Maipo', null),
  ('Nestlé Lacteos', null),
  ('Nestlé lacteos', null),
  ('Coca-Cola', 'https://example.test/coca.png')
on conflict (nombre) do nothing;

-- ---- jornadas ----
insert into public.jornadas (id, fecha, es_turno_unico) values
  ('10000000-0000-4000-8000-000000000001', '2026-09-08', false),  -- martes: mañana + tarde, cerrados
  ('10000000-0000-4000-8000-000000000002', '2026-09-09', true),   -- miércoles: día completo (fusionado a mano)
  ('10000000-0000-4000-8000-000000000003', '2026-09-13', false),  -- domingo: solo mañana (turno único por config)
  ('10000000-0000-4000-8000-000000000004', '2026-09-14', false);  -- lunes: borrador sin cerrar

-- ---- turnos ----
insert into public.turnos (id, jornada_id, tipo, usuario_id, fondo_inicial, is_draft) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'mañana', '00000000-0000-4000-8000-000000000001', 20000, true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'tarde',  '00000000-0000-4000-8000-000000000001', 20000, true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'mañana', '00000000-0000-4000-8000-000000000001', 20000, true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'mañana', '00000000-0000-4000-8000-000000000001', 20000, true),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'mañana', '00000000-0000-4000-8000-000000000002', 20000, true);

insert into public.ventas_turno (turno_id, efectivo, getnet, mercadopago, edenred, amipass, transferencia) values
  ('20000000-0000-4000-8000-000000000001', 150000, 80000, 30000, 10000, 5000, 20000),  -- total 295000
  ('20000000-0000-4000-8000-000000000002', 120000, 60000, 25000,     0,    0, 15000),  -- total 220000
  ('20000000-0000-4000-8000-000000000003', 300000, 150000, 50000, 20000, 10000, 40000), -- total 570000
  ('20000000-0000-4000-8000-000000000004', 200000, 90000, 0, 0, 0, 10000),             -- total 300000
  ('20000000-0000-4000-8000-000000000005', 50000, 0, 0, 0, 0, 0);                      -- borrador

-- Nombres tal como se escribieron en su momento (grafías distintas y
-- uno que no está en el catálogo).
insert into public.proveedores_turno (turno_id, nombre, monto, forma_pago) values
  ('20000000-0000-4000-8000-000000000001', 'PF',              40000, 'efectivo'),
  ('20000000-0000-4000-8000-000000000001', 'Coca-Cola',       35000, 'transferencia'),
  ('20000000-0000-4000-8000-000000000002', 'Pf',              20000, 'efectivo'),
  ('20000000-0000-4000-8000-000000000003', 'Rio Maipo',       15000, 'efectivo'),     -- sin tilde: debe unirse a "Río Maipo"
  ('20000000-0000-4000-8000-000000000003', 'Nestlé lacteos',  30000, 'transferencia'),
  ('20000000-0000-4000-8000-000000000003', 'Soprole',         25000, 'efectivo'),     -- no existe en el catálogo
  ('20000000-0000-4000-8000-000000000004', 'PF',              10000, 'efectivo');

-- ---- cierres: se simula la sesión de la dueña para pasar por cerrar_turno ----
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select public.cerrar_turno('20000000-0000-4000-8000-000000000001', 130000);  -- esperado 20000+150000-40000 = 130000 → cuadra
select public.cerrar_turno('20000000-0000-4000-8000-000000000002', null);
select public.cerrar_turno('20000000-0000-4000-8000-000000000003', 275000);  -- esperado 20000+300000-40000 = 280000 → faltan 5000
select public.cerrar_turno('20000000-0000-4000-8000-000000000004', null);

-- Corrección sobre el turno 1: se cambia una venta y se registra.
update public.ventas_turno set getnet = 85000 where turno_id = '20000000-0000-4000-8000-000000000001';
select public.corregir_turno('20000000-0000-4000-8000-000000000001', null);

reset role;
commit;
