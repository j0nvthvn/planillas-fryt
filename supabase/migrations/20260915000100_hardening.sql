-- ============================================================
-- 20260915000100_hardening.sql
-- Seguridad y rendimiento de la base, sin cambiar lo que la app
-- actual puede hacer con la cuenta de la dueña (rol "dueño"):
--
-- 1. Todas las políticas RLS se reescriben `to authenticated` y con
--    `(select auth.uid())` (evita re-evaluar auth.uid() por fila —
--    advertencia auth_rls_initplan del linter). Una sola política
--    permisiva por tabla y acción (multiple_permissive_policies).
-- 2. Cierra tres huecos:
--    - proveedores_frecuentes: UPDATE era `true` para cualquier
--      autenticado → solo dueño. Se agrega DELETE para el dueño (la
--      pantalla Proveedores lo intentaba y RLS lo bloqueaba en
--      silencio: el proveedor "borrado" reaparecía al recargar).
--    - ventas_turno / proveedores_turno: un trabajador podía modificar
--      datos de sus turnos ya cerrados llamando directo a la API,
--      saltándose la corrección auditada (turno_cierres). Ahora solo
--      puede escribir mientras el turno sigue en borrador; el cierre
--      sigue pasando por cerrar_turno() (security definer).
--    - es_dueno()/get_my_rol() eran ejecutables por anon vía RPC.
-- 3. search_path fijo en las funciones (function_search_path_mutable).
-- 4. CHECK (amipass >= 0) que faltaba; índices para FKs sin cubrir.
--
-- Orden importante: primero las políticas pasan a `to authenticated`
-- (así anon nunca las evalúa) y recién después se revoca EXECUTE de
-- es_dueno() a anon. ConfigProvider consulta `configuracion` antes del
-- login: con esto sigue recibiendo un resultado vacío, no un error.
-- ============================================================

-- ------------------------------------------------------------
-- Funciones helper: search_path fijo, misma semántica
-- ------------------------------------------------------------
create or replace function public.get_my_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.usuarios where id = (select auth.uid());
$$;

create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.usuarios
    where id = (select auth.uid()) and rol = 'dueño'
  );
$$;

alter function public.set_updated_at() set search_path = public;
alter function public.touch_turno_updated_at() set search_path = public;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
drop policy if exists "usuarios: leer propio" on public.usuarios;
drop policy if exists "usuarios: dueño puede insertar" on public.usuarios;
drop policy if exists "usuarios: dueño puede actualizar" on public.usuarios;

create policy "usuarios: leer propio o dueño lee todos" on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()) or public.es_dueno());

create policy "usuarios: dueño puede insertar" on public.usuarios
  for insert to authenticated
  with check (public.es_dueno());

create policy "usuarios: dueño puede actualizar" on public.usuarios
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

-- ------------------------------------------------------------
-- proveedores_frecuentes
-- ------------------------------------------------------------
drop policy if exists "proveedores_frecuentes: todos autenticados pueden leer" on public.proveedores_frecuentes;
drop policy if exists "proveedores_frecuentes: todos autenticados pueden insertar" on public.proveedores_frecuentes;
drop policy if exists "Permitir actualización a usuarios autenticados" on public.proveedores_frecuentes;

create policy "proveedores_frecuentes: autenticados pueden leer" on public.proveedores_frecuentes
  for select to authenticated using (true);

-- INSERT abierto a autenticados: guardarTurno() hace upsert de los
-- nombres nuevos al registrar un turno (también desde la cuenta del local).
create policy "proveedores_frecuentes: autenticados pueden insertar" on public.proveedores_frecuentes
  for insert to authenticated with check (true);

create policy "proveedores_frecuentes: dueño puede actualizar" on public.proveedores_frecuentes
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

create policy "proveedores_frecuentes: dueño puede eliminar" on public.proveedores_frecuentes
  for delete to authenticated using (public.es_dueno());

-- ------------------------------------------------------------
-- jornadas
-- ------------------------------------------------------------
drop policy if exists "jornadas: todos autenticados pueden leer" on public.jornadas;
drop policy if exists "jornadas: todos autenticados pueden insertar" on public.jornadas;
drop policy if exists "jornadas: dueño puede actualizar" on public.jornadas;
drop policy if exists "jornadas: dueño puede eliminar" on public.jornadas;

create policy "jornadas: autenticados pueden leer" on public.jornadas
  for select to authenticated using (true);

create policy "jornadas: autenticados pueden insertar" on public.jornadas
  for insert to authenticated with check (true);

create policy "jornadas: dueño puede actualizar" on public.jornadas
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

create policy "jornadas: dueño puede eliminar" on public.jornadas
  for delete to authenticated using (public.es_dueno());

-- ------------------------------------------------------------
-- turnos
-- ------------------------------------------------------------
drop policy if exists "turnos: autenticados pueden leer" on public.turnos;
drop policy if exists "turnos: trabajador puede insertar su turno" on public.turnos;
drop policy if exists "turnos: dueño puede actualizar" on public.turnos;
drop policy if exists "turnos: trabajador puede actualizar su propio turno" on public.turnos;
drop policy if exists "turnos: dueño puede eliminar" on public.turnos;

create policy "turnos: autenticados pueden leer" on public.turnos
  for select to authenticated using (true);

create policy "turnos: insertar propio o dueño" on public.turnos
  for insert to authenticated
  with check (public.es_dueno() or usuario_id = (select auth.uid()));

-- Trabajador: solo sus turnos y solo mientras son borrador. Cerrar
-- (is_draft = false) pasa por cerrar_turno(), que es security definer.
create policy "turnos: dueño o propio en borrador puede actualizar" on public.turnos
  for update to authenticated
  using (public.es_dueno() or (usuario_id = (select auth.uid()) and is_draft))
  with check (public.es_dueno() or (usuario_id = (select auth.uid()) and is_draft));

create policy "turnos: dueño puede eliminar" on public.turnos
  for delete to authenticated using (public.es_dueno());

-- ------------------------------------------------------------
-- proveedores_turno
-- ------------------------------------------------------------
drop policy if exists "proveedores_turno: autenticados pueden leer" on public.proveedores_turno;
drop policy if exists "proveedores_turno: trabajador puede insertar en sus turnos" on public.proveedores_turno;
drop policy if exists "proveedores_turno: dueño puede actualizar" on public.proveedores_turno;
drop policy if exists "proveedores_turno: trabajador puede actualizar los de sus turno" on public.proveedores_turno;
drop policy if exists "proveedores_turno: trabajador puede borrar los de sus turnos" on public.proveedores_turno;

create policy "proveedores_turno: autenticados pueden leer" on public.proveedores_turno
  for select to authenticated using (true);

create policy "proveedores_turno: escribir en turno propio en borrador o dueño" on public.proveedores_turno
  for insert to authenticated
  with check (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  );

create policy "proveedores_turno: actualizar en turno propio en borrador o dueño" on public.proveedores_turno
  for update to authenticated
  using (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  )
  with check (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  );

create policy "proveedores_turno: borrar en turno propio en borrador o dueño" on public.proveedores_turno
  for delete to authenticated
  using (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  );

-- ------------------------------------------------------------
-- ventas_turno
-- ------------------------------------------------------------
drop policy if exists "ventas_turno: autenticados pueden leer" on public.ventas_turno;
drop policy if exists "ventas_turno: trabajador puede insertar en sus turnos" on public.ventas_turno;
drop policy if exists "ventas_turno: trabajador puede actualizar en sus turnos" on public.ventas_turno;

create policy "ventas_turno: autenticados pueden leer" on public.ventas_turno
  for select to authenticated using (true);

create policy "ventas_turno: insertar en turno propio en borrador o dueño" on public.ventas_turno
  for insert to authenticated
  with check (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  );

create policy "ventas_turno: actualizar en turno propio en borrador o dueño" on public.ventas_turno
  for update to authenticated
  using (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  )
  with check (
    public.es_dueno() or exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    )
  );

-- ------------------------------------------------------------
-- turno_cierres (solo lectura; se escribe vía funciones)
-- ------------------------------------------------------------
drop policy if exists "turno_cierres: autenticados pueden leer" on public.turno_cierres;
create policy "turno_cierres: autenticados pueden leer" on public.turno_cierres
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- configuracion
-- ------------------------------------------------------------
drop policy if exists "Todos pueden leer configuracion" on public.configuracion;
drop policy if exists "Solo dueno puede modificar configuracion" on public.configuracion;

create policy "configuracion: autenticados pueden leer" on public.configuracion
  for select to authenticated using (true);
create policy "configuracion: dueño puede insertar" on public.configuracion
  for insert to authenticated with check (public.es_dueno());
create policy "configuracion: dueño puede actualizar" on public.configuracion
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy "configuracion: dueño puede eliminar" on public.configuracion
  for delete to authenticated using (public.es_dueno());

-- ------------------------------------------------------------
-- logs_error
-- ------------------------------------------------------------
drop policy if exists "logs_error: autenticados pueden insertar su propio log" on public.logs_error;
drop policy if exists "logs_error: dueño puede leer" on public.logs_error;

create policy "logs_error: autenticados pueden insertar su propio log" on public.logs_error
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) or usuario_id is null);

create policy "logs_error: dueño puede leer" on public.logs_error
  for select to authenticated using (public.es_dueno());

-- ------------------------------------------------------------
-- Permisos de ejecución (después de mover las políticas a authenticated)
-- ------------------------------------------------------------
revoke execute on function public.es_dueno() from public, anon;
revoke execute on function public.get_my_rol() from public, anon;
revoke execute on function public.set_updated_at() from public, anon;
revoke execute on function public.touch_turno_updated_at() from public, anon;
grant execute on function public.es_dueno() to authenticated, service_role;
grant execute on function public.get_my_rol() to authenticated, service_role;

-- ------------------------------------------------------------
-- Integridad e índices
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ventas_turno_amipass_check'
  ) then
    alter table public.ventas_turno
      add constraint ventas_turno_amipass_check check (amipass >= 0);
  end if;
end;
$$;

create index if not exists idx_turno_cierres_cerrado_por
  on public.turno_cierres (cerrado_por);
create index if not exists idx_turno_cierres_cierre_anterior_id
  on public.turno_cierres (cierre_anterior_id);
create index if not exists idx_logs_error_usuario_id
  on public.logs_error (usuario_id);
