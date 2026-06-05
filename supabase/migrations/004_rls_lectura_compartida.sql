-- ============================================================
-- 004_rls_lectura_compartida.sql
-- Amplía las políticas de lectura en turnos, proveedores_turno
-- y ventas_turno para que todos los trabajadores autenticados
-- puedan ver los turnos del día (no solo los propios).
-- Necesario porque mañana y tarde los registran personas distintas
-- y ambas necesitan ver el resumen completo de la jornada.
-- ============================================================

-- Turnos: reemplazar política de lectura restrictiva por libre para autenticados
drop policy if exists "turnos: trabajador lee sus propios turnos" on public.turnos;
create policy "turnos: autenticados pueden leer" on public.turnos
  for select using (auth.uid() is not null);

-- Proveedores_turno: ídem
drop policy if exists "proveedores_turno: trabajador lee los de sus turnos" on public.proveedores_turno;
create policy "proveedores_turno: autenticados pueden leer" on public.proveedores_turno
  for select using (auth.uid() is not null);

-- Ventas_turno: ídem
drop policy if exists "ventas_turno: trabajador lee las de sus turnos" on public.ventas_turno;
create policy "ventas_turno: autenticados pueden leer" on public.ventas_turno
  for select using (auth.uid() is not null);
