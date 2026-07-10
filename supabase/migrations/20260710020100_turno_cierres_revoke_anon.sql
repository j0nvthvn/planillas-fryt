-- ============================================================
-- 20260710020100_turno_cierres_revoke_anon.sql
-- Defensa en profundidad detectada por el linter de seguridad de
-- Supabase tras aplicar 20260710020000_turno_cierres.sql: Postgres
-- otorga EXECUTE a PUBLIC por defecto en funciones nuevas, así que
-- anon también podía invocar cerrar_turno/corregir_turno vía RPC
-- (aunque la lógica interna ya los rechaza por no estar
-- autenticados). Se revoca explícitamente.
-- ============================================================

revoke execute on function public.cerrar_turno(uuid) from public;
revoke execute on function public.corregir_turno(uuid) from public;
grant execute on function public.cerrar_turno(uuid) to authenticated;
grant execute on function public.corregir_turno(uuid) to authenticated;

-- Supabase también otorga EXECUTE a anon/authenticated vía default
-- privileges del esquema, independiente del grant a PUBLIC — revocar
-- de PUBLIC no fue suficiente, anon seguía con el permiso. Se revoca
-- explícitamente de anon.
revoke execute on function public.cerrar_turno(uuid) from anon;
revoke execute on function public.corregir_turno(uuid) from anon;
