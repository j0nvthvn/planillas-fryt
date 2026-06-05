alter table public.turnos
  add column if not exists updated_at timestamptz not null default now();

alter table public.ventas_turno
  add column if not exists updated_at timestamptz not null default now();

alter table public.proveedores_turno
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists turnos_jornada_tipo_unique
  on public.turnos (jornada_id, tipo);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_turno_updated_at()
returns trigger
language plpgsql
as $$
declare
  affected_turno_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_turno_id := old.turno_id;
  else
    affected_turno_id := new.turno_id;
  end if;

  update public.turnos
  set updated_at = now()
  where id = affected_turno_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists set_turnos_updated_at on public.turnos;
create trigger set_turnos_updated_at
  before update on public.turnos
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_ventas_turno_updated_at on public.ventas_turno;
create trigger set_ventas_turno_updated_at
  before update on public.ventas_turno
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_proveedores_turno_updated_at on public.proveedores_turno;
create trigger set_proveedores_turno_updated_at
  before update on public.proveedores_turno
  for each row
  execute function public.set_updated_at();

drop trigger if exists touch_turno_on_ventas_turno on public.ventas_turno;
create trigger touch_turno_on_ventas_turno
  after insert or update or delete on public.ventas_turno
  for each row
  execute function public.touch_turno_updated_at();

drop trigger if exists touch_turno_on_proveedores_turno on public.proveedores_turno;
create trigger touch_turno_on_proveedores_turno
  after insert or update or delete on public.proveedores_turno
  for each row
  execute function public.touch_turno_updated_at();

alter table public.jornadas replica identity full;
alter table public.turnos replica identity full;
alter table public.ventas_turno replica identity full;
alter table public.proveedores_turno replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jornadas'
  ) then
    alter publication supabase_realtime add table public.jornadas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turnos'
  ) then
    alter publication supabase_realtime add table public.turnos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas_turno'
  ) then
    alter publication supabase_realtime add table public.ventas_turno;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proveedores_turno'
  ) then
    alter publication supabase_realtime add table public.proveedores_turno;
  end if;
end;
$$;
