-- ============================================================
-- 006_rls_edicion_dueno.sql
-- Permite al dueño editar y eliminar turnos históricos.
-- Los trabajadores siguen sin poder modificar datos pasados.
-- ============================================================

-- turnos: dueño puede actualizar (ej: cambiar usuario_id en correcciones)
create policy "turnos: dueño puede actualizar"
  on public.turnos for update
  using (public.es_dueno());

-- turnos: dueño puede eliminar un turno completo
create policy "turnos: dueño puede eliminar"
  on public.turnos for delete
  using (public.es_dueno());

-- proveedores_turno: dueño puede actualizar campos de un proveedor
create policy "proveedores_turno: dueño puede actualizar"
  on public.proveedores_turno for update
  using (public.es_dueno());

-- jornadas: dueño puede eliminar jornadas vacías
create policy "jornadas: dueño puede eliminar"
  on public.jornadas for delete
  using (public.es_dueno());
