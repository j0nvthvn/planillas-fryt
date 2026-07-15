-- ============================================================
-- 20260714000000_rls_dueno_insert_proveedores_turno.sql
-- Mismo vacío que 20260710030000 corrigió para ventas_turno, pero
-- en proveedores_turno: la política de INSERT nunca incluyó al
-- dueño (solo la de UPDATE/DELETE lo tenían).
--
-- Efecto del bug: cuando el dueño corregía en EditarTurno.jsx un
-- turno registrado por un trabajador y la edición insertaba una
-- fila nueva de proveedor (agregar proveedor, o re-insertar tras un
-- "Deshacer"), el insert fallaba con 42501 "new row violates
-- row-level security policy". Peor: guardarTurno() ya había
-- alcanzado a actualizar otras filas antes de fallar, así que
-- turnos.updated_at cambiaba y el reintento del usuario chocaba
-- con el chequeo de versión, mostrando el mensaje engañoso "Este
-- turno cambió en otro dispositivo".
--
-- NOTA: esta migración ya fue aplicada directamente al proyecto
-- kfmwhtbvgqurnpotypii el 2026-07-14; este archivo la documenta
-- para entornos nuevos.
-- ============================================================

drop policy if exists "proveedores_turno: trabajador puede insertar en sus turnos" on public.proveedores_turno;
create policy "proveedores_turno: trabajador puede insertar en sus turnos"
  on public.proveedores_turno for insert
  with check (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );
