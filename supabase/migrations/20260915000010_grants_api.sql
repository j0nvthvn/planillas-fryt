-- ============================================================
-- 20260915000010_grants_api.sql
-- Permisos de tabla para los roles de la API (anon, authenticated,
-- service_role). En producción estos GRANTs existen porque las tablas
-- se crearon desde el dashboard con los privilegios por defecto de esa
-- época; en un proyecto nuevo (local, staging, sa-east-1) las tablas
-- creadas por migraciones quedan sin SELECT/INSERT/UPDATE/DELETE para
-- esos roles y la app recibe "permission denied" antes siquiera de
-- evaluar RLS. Idempotente: en prod no cambia nada.
--
-- RLS sigue siendo lo que decide qué fila ve o toca cada usuario; el
-- GRANT solo habilita el acceso a nivel de tabla.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- Tablas y vistas que creen migraciones posteriores (como postgres).
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- Las funciones NO reciben EXECUTE por defecto: cada RPC que la app
-- llama lo otorga explícitamente en su migración (cerrar_turno,
-- corregir_turno, guardar_turno, resumen_periodo, …).
