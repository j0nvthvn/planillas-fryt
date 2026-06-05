-- ============================================================
-- Instrucciones para crear el usuario dueño inicial:
--
-- 1. En Supabase Dashboard > Authentication > Users
--    crea el usuario con email y contraseña.
--
-- 2. Copia el UUID del usuario creado y ejecuta:
-- ============================================================

-- Reemplaza el UUID y datos por los del dueño real
-- INSERT INTO public.usuarios (id, nombre, email, rol)
-- VALUES ('UUID-DEL-USUARIO-AUTH', 'Nombre Dueño', 'dueno@ejemplo.com', 'dueño');

-- ============================================================
-- Política adicional: el dueño puede ver turnos de cualquier usuario
-- (ya cubierto por es_dueno() en las policies del schema inicial)
-- ============================================================

-- Índices para performance
create index if not exists idx_jornadas_fecha on public.jornadas(fecha);
create index if not exists idx_turnos_jornada on public.turnos(jornada_id);
create index if not exists idx_turnos_usuario on public.turnos(usuario_id);
create index if not exists idx_proveedores_turno on public.proveedores_turno(turno_id);
create index if not exists idx_ventas_turno on public.ventas_turno(turno_id);
