-- La v2 consulta al volver a la app y después de cada escritura.
-- Retirar solo las cuatro tablas que publicaba la v1, conservando la
-- publicación y sus demás consumidores. No cambia filas ni permisos.
do $$
declare
  tabla text;
begin
  foreach tabla in array array['jornadas', 'turnos', 'ventas_turno', 'proveedores_turno'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', tabla);
    end if;
    execute format('alter table public.%I replica identity default', tabla);
  end loop;
end $$;
