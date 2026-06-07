-- ============================================================
-- 007_notificaciones_config.sql
-- Tabla de configuración clave-valor + claves del sistema de
-- notificaciones por email.
-- ============================================================

-- Tabla de configuración general (clave -> valor JSON)
create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null
);

alter table public.configuracion enable row level security;

-- Cualquier autenticado puede leer la configuración
drop policy if exists "Todos pueden leer configuracion" on public.configuracion;
create policy "Todos pueden leer configuracion"
  on public.configuracion for select
  using (true);

-- Solo el dueño puede modificarla
drop policy if exists "Solo dueno puede modificar configuracion" on public.configuracion;
create policy "Solo dueno puede modificar configuracion"
  on public.configuracion for all
  using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol = 'dueño')
  );

-- Claves de configuración del sistema de notificaciones por email
insert into public.configuracion (clave, valor) values
  ('notificaciones_activas',     to_jsonb(true)),
  ('notificaciones_email_extra', 'null'::jsonb)
on conflict (clave) do nothing;
