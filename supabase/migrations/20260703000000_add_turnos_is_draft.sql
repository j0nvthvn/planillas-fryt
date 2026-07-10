-- ============================================================
-- 20260703000000_add_turnos_is_draft.sql
-- Agrega el flag is_draft a turnos para diferenciar turnos en
-- progreso (autosave) de turnos finalizados.
-- ============================================================

alter table public.turnos
  add column if not exists is_draft boolean not null default true;

-- Los turnos existentes fueron creados antes del autosave, por lo
-- que se consideran finalizados.
update public.turnos set is_draft = false where is_draft = true;

-- Índice parcial: las consultas de "turnos en progreso" son frecuentes
-- (carga del Resumen, Realtime, cleanup de borradores viejos).
create index if not exists idx_turnos_is_draft
  on public.turnos(is_draft) where is_draft = true;
