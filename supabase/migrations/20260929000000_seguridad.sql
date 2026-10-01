-- ============================================================
-- 20260929000000_seguridad.sql
-- Correcciones de la auditoría de seguridad del 2026-09-28. Aditiva e
-- idempotente; la app no cambia su forma de llamar a la base.
--
-- 1. Pertenencia explícita (H2, H3): hasta ahora las lecturas eran
--    `using (true)` para cualquier `authenticated`, así que una cuenta
--    de Auth sin fila en `usuarios` (o una desactivada) leía todo el
--    negocio. Ahora toda política exige es_miembro_activo(), y
--    es_dueno() exige además `activo` (un dueño desactivado deja de ser
--    dueño). La cuenta sigue pudiendo leer su propia fila de `usuarios`.
-- 2. cerrar_turno() solo cierra borradores (H1): antes un trabajador
--    podía volver a "cerrar" su turno ya cerrado con otro conteo y
--    borrar un descuadre de caja (v_turnos muestra el último conteo), y
--    cada llamada mandaba otra vez el correo. Rehacer un cierre es una
--    corrección, que solo registra el dueño (guardar_turno ya deriva a
--    corregir_turno cuando el turno no es borrador).
-- 3. auditoria registra también los INSERT en turno_cierres (H1).
-- 4. jornadas (M1): solo el dueño puede crear un día con la marca "No
--    abrió"; el resto crea jornadas limpias (lo único que hace
--    guardar_turno). La marca pasa por marcar_dia_cerrado().
-- 5. turnos (L1): un no dueño solo inserta borradores activos, y no
--    puede mover su borrador de día, de tipo ni de dueño.
-- 6. proveedores_frecuentes (L2): solo el dueño fija imagen_url.
-- 7. logs_error (L5): solo con el usuario propio y tamaño acotado.
-- 8. Storage (M2): el bucket de logos acepta solo imágenes de hasta
--    1 MB, y solo el dueño sube o reemplaza (la pantalla de Proveedores
--    ya era solo del dueño).
--
-- Fuera de esta migración: pg_net otorga EXECUTE a PUBLIC desde
-- supabase_admin y el rol de las migraciones no puede revocarlo. Lo que
-- protege es que el esquema `net` no esté en los "Exposed schemas" de la
-- API (Dashboard → Settings → API); ver docs/operacion.md.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers
-- ------------------------------------------------------------
create or replace function public.es_miembro_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.usuarios
    where id = (select auth.uid()) and activo
  );
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
    where id = (select auth.uid()) and rol = 'dueño' and activo
  );
$$;

revoke execute on function public.es_miembro_activo() from public, anon;
grant execute on function public.es_miembro_activo() to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Lecturas: solo miembros activos
-- ------------------------------------------------------------
drop policy if exists "proveedores_frecuentes: autenticados pueden leer" on public.proveedores_frecuentes;
drop policy if exists "proveedores_frecuentes: miembros pueden leer" on public.proveedores_frecuentes;
create policy "proveedores_frecuentes: miembros pueden leer" on public.proveedores_frecuentes
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "jornadas: autenticados pueden leer" on public.jornadas;
drop policy if exists "jornadas: miembros pueden leer" on public.jornadas;
create policy "jornadas: miembros pueden leer" on public.jornadas
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "turnos: autenticados pueden leer" on public.turnos;
drop policy if exists "turnos: miembros pueden leer" on public.turnos;
create policy "turnos: miembros pueden leer" on public.turnos
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "proveedores_turno: autenticados pueden leer" on public.proveedores_turno;
drop policy if exists "proveedores_turno: miembros pueden leer" on public.proveedores_turno;
create policy "proveedores_turno: miembros pueden leer" on public.proveedores_turno
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "ventas_turno: autenticados pueden leer" on public.ventas_turno;
drop policy if exists "ventas_turno: miembros pueden leer" on public.ventas_turno;
create policy "ventas_turno: miembros pueden leer" on public.ventas_turno
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "turno_cierres: autenticados pueden leer" on public.turno_cierres;
drop policy if exists "turno_cierres: miembros pueden leer" on public.turno_cierres;
create policy "turno_cierres: miembros pueden leer" on public.turno_cierres
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "configuracion: autenticados pueden leer" on public.configuracion;
drop policy if exists "configuracion: miembros pueden leer" on public.configuracion;
create policy "configuracion: miembros pueden leer" on public.configuracion
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "trabajadores: autenticados pueden leer" on public.trabajadores;
drop policy if exists "trabajadores: miembros pueden leer" on public.trabajadores;
create policy "trabajadores: miembros pueden leer" on public.trabajadores
  for select to authenticated using (public.es_miembro_activo());

drop policy if exists "metodos_pago: autenticados pueden leer" on public.metodos_pago;
drop policy if exists "metodos_pago: miembros pueden leer" on public.metodos_pago;
create policy "metodos_pago: miembros pueden leer" on public.metodos_pago
  for select to authenticated using (public.es_miembro_activo());

-- ------------------------------------------------------------
-- 3. Escrituras de miembros (el dueño ya pasa por es_dueno())
-- ------------------------------------------------------------
-- proveedores_frecuentes: el logo solo lo fija el dueño.
drop policy if exists "proveedores_frecuentes: autenticados pueden insertar" on public.proveedores_frecuentes;
drop policy if exists "proveedores_frecuentes: miembros pueden insertar" on public.proveedores_frecuentes;
create policy "proveedores_frecuentes: miembros pueden insertar" on public.proveedores_frecuentes
  for insert to authenticated
  with check (public.es_miembro_activo() and (imagen_url is null or public.es_dueno()));

-- jornadas: el día "No abrió" se marca con marcar_dia_cerrado().
drop policy if exists "jornadas: autenticados pueden insertar" on public.jornadas;
drop policy if exists "jornadas: miembros pueden insertar" on public.jornadas;
create policy "jornadas: miembros pueden insertar" on public.jornadas
  for insert to authenticated
  with check (
    public.es_dueno() or (
      public.es_miembro_activo()
      and not cerrado
      and motivo_cierre is null
      and cerrado_en is null
      and cerrado_por is null
    )
  );

-- turnos
drop policy if exists "turnos: insertar propio o dueño" on public.turnos;
create policy "turnos: insertar propio o dueño" on public.turnos
  for insert to authenticated
  with check (
    public.es_dueno() or (
      public.es_miembro_activo()
      and usuario_id = (select auth.uid())
      and is_draft
      and deleted_at is null
    )
  );

drop policy if exists "turnos: dueño o propio en borrador puede actualizar" on public.turnos;
create policy "turnos: dueño o propio en borrador puede actualizar" on public.turnos
  for update to authenticated
  using (public.es_dueno() or (public.es_miembro_activo() and usuario_id = (select auth.uid()) and is_draft))
  with check (public.es_dueno() or (public.es_miembro_activo() and usuario_id = (select auth.uid()) and is_draft));

-- proveedores_turno
drop policy if exists "proveedores_turno: escribir en turno propio en borrador o dueño" on public.proveedores_turno;
create policy "proveedores_turno: escribir en turno propio en borrador o dueño" on public.proveedores_turno
  for insert to authenticated
  with check (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  );

drop policy if exists "proveedores_turno: actualizar en turno propio en borrador o dueño" on public.proveedores_turno;
create policy "proveedores_turno: actualizar en turno propio en borrador o dueño" on public.proveedores_turno
  for update to authenticated
  using (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  )
  with check (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  );

drop policy if exists "proveedores_turno: borrar en turno propio en borrador o dueño" on public.proveedores_turno;
create policy "proveedores_turno: borrar en turno propio en borrador o dueño" on public.proveedores_turno
  for delete to authenticated
  using (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  );

-- ventas_turno
drop policy if exists "ventas_turno: insertar en turno propio en borrador o dueño" on public.ventas_turno;
create policy "ventas_turno: insertar en turno propio en borrador o dueño" on public.ventas_turno
  for insert to authenticated
  with check (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  );

drop policy if exists "ventas_turno: actualizar en turno propio en borrador o dueño" on public.ventas_turno;
create policy "ventas_turno: actualizar en turno propio en borrador o dueño" on public.ventas_turno
  for update to authenticated
  using (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  )
  with check (
    public.es_dueno() or (public.es_miembro_activo() and exists (
      select 1 from public.turnos t
      where t.id = turno_id and t.usuario_id = (select auth.uid()) and t.is_draft
    ))
  );

-- logs_error: siempre con el usuario propio y acotado (la app corta el
-- mensaje en 2000; detalle es un error serializado, no un volcado).
drop policy if exists "logs_error: autenticados pueden insertar su propio log" on public.logs_error;
create policy "logs_error: autenticados pueden insertar su propio log" on public.logs_error
  for insert to authenticated
  with check (
    public.es_miembro_activo()
    and usuario_id = (select auth.uid())
    and length(mensaje) <= 2000
    and length(coalesce(contexto, '')) <= 200
    and length(coalesce(ruta, '')) <= 500
    and coalesce(pg_column_size(detalle), 0) <= 16384
  );

-- ------------------------------------------------------------
-- 4. turnos: un no dueño no mueve su borrador
-- ------------------------------------------------------------
-- La política de UPDATE deja al trabajador editar su borrador (fondo,
-- trabajador_id, papelera), pero no cambiarlo de día, de tipo ni de
-- dueño: eso lo decide guardar_turno() al crearlo. Sin JWT (postgres,
-- mantenimiento por MCP) no aplica, igual que marcar_dia_cerrado().
create or replace function public.turno_campos_fijos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.es_dueno() then
    return new;
  end if;
  if new.jornada_id is distinct from old.jornada_id
     or new.tipo is distinct from old.tipo
     or new.usuario_id is distinct from old.usuario_id then
    raise exception 'Solo la dueña puede cambiar el día, el tipo o la cuenta de un turno'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke execute on function public.turno_campos_fijos() from public, anon, authenticated;

drop trigger if exists turno_campos_fijos on public.turnos;
create trigger turno_campos_fijos
  before update on public.turnos
  for each row execute function public.turno_campos_fijos();

-- ------------------------------------------------------------
-- 5. cerrar_turno: solo borradores activos
-- ------------------------------------------------------------
-- Igual a 20260916000200_totales_vistas.sql más las dos guardas de estado.
create or replace function public.cerrar_turno(p_turno_id uuid, p_efectivo_contado numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos%rowtype;
  v_snap record;
  v_tot record;
  v_cierre_id uuid;
begin
  select * into v_turno from public.turnos where id = p_turno_id;
  if v_turno.id is null then
    raise exception 'El turno % no existe', p_turno_id;
  end if;

  if not (v_turno.usuario_id = auth.uid() or public.es_dueno()) then
    raise exception 'No tienes permiso para cerrar este turno';
  end if;

  if not public.es_miembro_activo() then
    raise exception 'Tu cuenta está desactivada' using errcode = 'insufficient_privilege';
  end if;

  if not v_turno.is_draft then
    raise exception 'El turno ya está cerrado; la dueña puede registrar una corrección'
      using errcode = 'check_violation';
  end if;

  if v_turno.deleted_at is not null then
    raise exception 'El turno está en la papelera' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.ventas_turno where turno_id = p_turno_id) then
    raise exception 'El turno no tiene ventas registradas todavía';
  end if;

  select * into v_snap from public._snapshot_turno(p_turno_id);
  select * into v_tot from public.turno_totales(p_turno_id);

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id,
    efectivo_esperado, efectivo_contado, diferencia_efectivo
  ) values (
    p_turno_id, auth.uid(), v_snap.ventas_snapshot, v_snap.proveedores_snapshot,
    v_tot.total_ventas, v_tot.total_proveedores, false, null,
    v_tot.efectivo_esperado, p_efectivo_contado,
    case when p_efectivo_contado is not null then p_efectivo_contado - v_tot.efectivo_esperado end
  ) returning id into v_cierre_id;

  update public.turnos set is_draft = false where id = p_turno_id;

  return v_cierre_id;
end;
$$;

revoke execute on function public.cerrar_turno(uuid, numeric) from public, anon;
grant execute on function public.cerrar_turno(uuid, numeric) to authenticated, service_role;

-- ------------------------------------------------------------
-- 6. auditoria: también los cierres nuevos
-- ------------------------------------------------------------
drop trigger if exists auditar on public.turno_cierres;
create trigger auditar
  after insert or delete on public.turno_cierres
  for each row execute function public.auditar('id');

-- ------------------------------------------------------------
-- 7. Storage: logos solo imágenes, solo el dueño escribe
-- ------------------------------------------------------------
update storage.buckets
   set file_size_limit = 1048576,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'logos-proveedores';

drop policy if exists "logos: autenticados pueden subir" on storage.objects;
drop policy if exists "logos: dueño puede subir" on storage.objects;
create policy "logos: dueño puede subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos-proveedores' and public.es_dueno());

drop policy if exists "logos: autenticados pueden actualizar" on storage.objects;
drop policy if exists "logos: dueño puede actualizar" on storage.objects;
create policy "logos: dueño puede actualizar" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos-proveedores' and public.es_dueno())
  with check (bucket_id = 'logos-proveedores' and public.es_dueno());
