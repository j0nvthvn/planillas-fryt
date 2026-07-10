-- ============================================================
-- 20260710030000_rls_dueno_insert_ventas_turno.sql
-- Corrige un vacío de RLS descubierto durante la prueba de humo de
-- EditarTurno.jsx: la política de INSERT de ventas_turno nunca
-- incluyó al dueño (solo la de UPDATE lo tenía), a diferencia del
-- resto de las políticas de esta migración serie que sí le dan
-- acceso total.
--
-- Efecto del bug: guardarTurno() usa un upsert (INSERT ... ON
-- CONFLICT (turno_id) DO UPDATE) para ventas_turno. Postgres evalúa
-- la política de INSERT del upsert aunque el resultado termine
-- siendo un UPDATE sobre una fila existente. Cuando el dueño editaba
-- un turno creado por otro trabajador (usuario_id distinto al suyo),
-- esa comprobación fallaba con 42501 "new row violates row-level
-- security policy", aunque la política de UPDATE sí lo hubiera
-- permitido.
-- ============================================================

drop policy if exists "ventas_turno: trabajador puede insertar en sus turnos" on public.ventas_turno;
create policy "ventas_turno: trabajador puede insertar en sus turnos"
  on public.ventas_turno for insert
  with check (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );
