-- ============================================================
-- FrytControl — Schema inicial
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLAS
-- ============================================================

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol text not null check (rol in ('dueño', 'trabajador')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.proveedores_frecuentes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  creado_en timestamptz not null default now()
);

create table public.jornadas (
  id uuid primary key default uuid_generate_v4(),
  fecha date not null unique,
  creado_en timestamptz not null default now()
);

create table public.turnos (
  id uuid primary key default uuid_generate_v4(),
  jornada_id uuid not null references public.jornadas(id) on delete cascade,
  tipo text not null check (tipo in ('mañana', 'tarde')),
  usuario_id uuid not null references public.usuarios(id),
  creado_en timestamptz not null default now(),
  unique (jornada_id, tipo)
);

create table public.proveedores_turno (
  id uuid primary key default uuid_generate_v4(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  nombre text not null,
  monto numeric not null check (monto >= 0),
  forma_pago text not null check (forma_pago in ('efectivo', 'transferencia')),
  creado_en timestamptz not null default now()
);

create table public.ventas_turno (
  id uuid primary key default uuid_generate_v4(),
  turno_id uuid not null references public.turnos(id) on delete cascade unique,
  efectivo numeric not null default 0 check (efectivo >= 0),
  getnet numeric not null default 0 check (getnet >= 0),
  edenred numeric not null default 0 check (edenred >= 0),
  transferencia numeric not null default 0 check (transferencia >= 0),
  creado_en timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.usuarios enable row level security;
alter table public.proveedores_frecuentes enable row level security;
alter table public.jornadas enable row level security;
alter table public.turnos enable row level security;
alter table public.proveedores_turno enable row level security;
alter table public.ventas_turno enable row level security;

-- Helper: obtener el rol del usuario autenticado
create or replace function public.get_my_rol()
returns text
language sql
security definer
stable
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

-- Helper: ¿es dueño el usuario autenticado?
create or replace function public.es_dueno()
returns boolean
language sql
security definer
stable
as $$
  select exists(select 1 from public.usuarios where id = auth.uid() and rol = 'dueño');
$$;

-- ---- usuarios ----
create policy "usuarios: leer propio" on public.usuarios
  for select using (id = auth.uid() or public.es_dueno());

create policy "usuarios: dueño puede insertar" on public.usuarios
  for insert with check (public.es_dueno());

create policy "usuarios: dueño puede actualizar" on public.usuarios
  for update using (public.es_dueno());

-- ---- proveedores_frecuentes ----
create policy "proveedores_frecuentes: todos autenticados pueden leer" on public.proveedores_frecuentes
  for select using (auth.uid() is not null);

create policy "proveedores_frecuentes: todos autenticados pueden insertar" on public.proveedores_frecuentes
  for insert with check (auth.uid() is not null);

-- ---- jornadas ----
create policy "jornadas: todos autenticados pueden leer" on public.jornadas
  for select using (auth.uid() is not null);

create policy "jornadas: todos autenticados pueden insertar" on public.jornadas
  for insert with check (auth.uid() is not null);

-- ---- turnos ----
create policy "turnos: trabajador lee sus propios turnos" on public.turnos
  for select using (
    public.es_dueno() or usuario_id = auth.uid()
  );

create policy "turnos: trabajador puede insertar su turno" on public.turnos
  for insert with check (usuario_id = auth.uid());

-- ---- proveedores_turno ----
create policy "proveedores_turno: trabajador lee los de sus turnos" on public.proveedores_turno
  for select using (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );

create policy "proveedores_turno: trabajador puede insertar en sus turnos" on public.proveedores_turno
  for insert with check (
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );

create policy "proveedores_turno: trabajador puede borrar los de sus turnos" on public.proveedores_turno
  for delete using (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );

-- ---- ventas_turno ----
create policy "ventas_turno: trabajador lee las de sus turnos" on public.ventas_turno
  for select using (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );

create policy "ventas_turno: trabajador puede insertar en sus turnos" on public.ventas_turno
  for insert with check (
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );

create policy "ventas_turno: trabajador puede actualizar en sus turnos" on public.ventas_turno
  for update using (
    public.es_dueno() or
    exists (select 1 from public.turnos t where t.id = turno_id and t.usuario_id = auth.uid())
  );
