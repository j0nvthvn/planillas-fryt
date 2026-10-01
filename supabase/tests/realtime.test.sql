begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(3);

select ok(exists(select 1 from pg_publication where pubname = 'supabase_realtime'),
  'Conserva la publicación Realtime');
select is((select count(*)::integer from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
  and tablename in ('jornadas', 'turnos', 'ventas_turno', 'proveedores_turno')), 0,
  'Las cuatro tablas de la v1 dejan de publicar cambios');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('jornadas', 'turnos', 'ventas_turno', 'proveedores_turno')
  and c.relreplident = 'd'), 4, 'Las cuatro tablas usan replica identity default');

select * from finish();
rollback;
