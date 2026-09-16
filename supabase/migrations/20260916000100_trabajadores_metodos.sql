-- ============================================================
-- 20260916000100_trabajadores_metodos.sql  (Fase 1.2 del plan v2)
--
-- 1. `trabajadores`: quién atendió el turno. No son cuentas de login
--    (el registro se hace desde un único móvil del local con una sola
--    sesión); es una lista que la dueña administra y de la que se elige
--    un nombre al cerrar. `turnos.trabajador_id` es opcional y la app
--    actual lo ignora.
--
-- 2. `metodos_pago`: los 6 métodos que hoy están fijos en el código
--    (METODOS_VENTA en src/components/TurnoInput.jsx) pasan a ser datos:
--    la v2 lee etiqueta, orden, color y logo desde acá y la dueña puede
--    desactivar o reordenar. `key` coincide con la columna de
--    ventas_turno; agregar un método nuevo sigue requiriendo columna
--    hasta la Fase 5 (ventas por filas).
-- ============================================================

-- ------------------------------------------------------------
-- trabajadores
-- ------------------------------------------------------------
create table if not exists public.trabajadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create unique index if not exists trabajadores_nombre_norm_key
  on public.trabajadores (public.norm_nombre(nombre));

alter table public.trabajadores enable row level security;

drop policy if exists "trabajadores: autenticados pueden leer" on public.trabajadores;
create policy "trabajadores: autenticados pueden leer" on public.trabajadores
  for select to authenticated using (true);
drop policy if exists "trabajadores: dueño puede insertar" on public.trabajadores;
create policy "trabajadores: dueño puede insertar" on public.trabajadores
  for insert to authenticated with check (public.es_dueno());
drop policy if exists "trabajadores: dueño puede actualizar" on public.trabajadores;
create policy "trabajadores: dueño puede actualizar" on public.trabajadores
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
drop policy if exists "trabajadores: dueño puede eliminar" on public.trabajadores;
create policy "trabajadores: dueño puede eliminar" on public.trabajadores
  for delete to authenticated using (public.es_dueno());

alter table public.turnos
  add column if not exists trabajador_id uuid references public.trabajadores(id) on delete set null;

create index if not exists idx_turnos_trabajador_id on public.turnos (trabajador_id);

-- ------------------------------------------------------------
-- metodos_pago
-- ------------------------------------------------------------
create table if not exists public.metodos_pago (
  key text primary key,
  label text not null,
  sub text,
  orden int not null default 0,
  activo boolean not null default true,
  color text not null,
  logo text
);

alter table public.metodos_pago enable row level security;

drop policy if exists "metodos_pago: autenticados pueden leer" on public.metodos_pago;
create policy "metodos_pago: autenticados pueden leer" on public.metodos_pago
  for select to authenticated using (true);
drop policy if exists "metodos_pago: dueño puede actualizar" on public.metodos_pago;
create policy "metodos_pago: dueño puede actualizar" on public.metodos_pago
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
-- Sin INSERT/DELETE desde la app: un método nuevo requiere columna en
-- ventas_turno (migración) hasta la Fase 5.

insert into public.metodos_pago (key, label, sub, orden, color, logo) values
  ('efectivo',      'Efectivo',      'Caja',              1, '#1E7A4F', null),
  ('getnet',        'Getnet',        'Débito / Crédito',  2, '#33518C', '/metodos/getnet.png'),
  ('mercadopago',   'Mercado Pago',  'Débito / Crédito',  3, '#00B1EA', '/metodos/mercadopago.png'),
  ('edenred',       'Edenred',       'Sodexo / Ticket',   4, '#F59E0B', '/metodos/edenred.png'),
  ('amipass',       'Amipass',       'Tarjeta beneficio', 5, '#A16207', '/metodos/amipass.png'),
  ('transferencia', 'Transferencia', 'Banco',             6, '#5C3317', null)
on conflict (key) do nothing;
