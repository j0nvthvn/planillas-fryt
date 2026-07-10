-- ============================================================
-- 20260710000000_rls_trabajador_update_turnos.sql
-- Corrige un vacío de RLS: los trabajadores (rol distinto de
-- "dueño") no tenían política de UPDATE sobre turnos ni sobre
-- proveedores_turno, solo el dueño (ver 006_rls_edicion_dueno.sql).
--
-- Efecto del bug: finalizarTurno() (Turno.jsx, botón "Guardar
-- turno"/"Listo") intenta `update turnos set is_draft = false`, y
-- actualizarProveedor() intenta `update proveedores_turno` al editar
-- un proveedor ya guardado. Para un trabajador (no dueño), RLS
-- bloqueaba el update sin lanzar error (0 filas afectadas), por lo
-- que la app mostraba éxito pero el turno quedaba como "Borrador"
-- para siempre y las ediciones de proveedores no se guardaban.
--
-- Esta migración agrega políticas adicionales (permisivas, se
-- combinan con las de 006 vía OR) para que un trabajador pueda
-- actualizar sus propios turnos y los proveedores de sus propios
-- turnos, igual como ya podía con ventas_turno.
-- ============================================================

-- turnos: trabajador puede actualizar su propio turno
-- (p.ej. marcarlo como finalizado con is_draft = false).
-- No permite reasignar el turno a otro usuario_id.
create policy "turnos: trabajador puede actualizar su propio turno"
  on public.turnos for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- proveedores_turno: trabajador puede actualizar los proveedores
-- de sus propios turnos (edición de un proveedor ya guardado).
create policy "proveedores_turno: trabajador puede actualizar los de sus turnos"
  on public.proveedores_turno for update
  using (
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  )
  with check (
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );
