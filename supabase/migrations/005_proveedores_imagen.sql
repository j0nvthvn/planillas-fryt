-- ============================================================
-- 005_proveedores_imagen.sql
-- Agrega soporte de logos a proveedores frecuentes.
-- - Columna imagen_url en proveedores_frecuentes
-- - Bucket público "logos-proveedores" en Supabase Storage
-- - Políticas RLS para el bucket
-- ============================================================

alter table public.proveedores_frecuentes
  add column if not exists imagen_url text;

-- Bucket público (las URLs son legibles sin auth)
insert into storage.buckets (id, name, public)
values ('logos-proveedores', 'logos-proveedores', true)
on conflict (id) do nothing;

-- Autenticados pueden subir y sobrescribir logos
create policy "logos: autenticados pueden subir"
  on storage.objects for insert
  with check (bucket_id = 'logos-proveedores' and auth.uid() is not null);

create policy "logos: autenticados pueden actualizar"
  on storage.objects for update
  using (bucket_id = 'logos-proveedores' and auth.uid() is not null);

-- Lectura pública (sin requerir auth en la URL)
create policy "logos: público puede leer"
  on storage.objects for select
  using (bucket_id = 'logos-proveedores');
