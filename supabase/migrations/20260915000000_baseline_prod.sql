-- ============================================================
-- 20260915000000_baseline_prod.sql
-- Baseline: todo lo que existía en el proyecto de producción
-- (kfmwhtbvgqurnpotypii) el 2026-09-15 pero no estaba en ninguna
-- migración del repo. Se aplicó a mano desde el dashboard en
-- distintas sesiones. Es idempotente: en prod no cambia nada; en un
-- proyecto nuevo (staging, sa-east-1) deja el esquema igual al real.
--
-- NO incluye secretos. El webhook "notificaciones" (trigger en turnos
-- que llama a la edge function enviar-resumen-turno) y los dos cron
-- jobs (0 22 * * * diario, 0 8 * * 1 semanal) llevaban la llave JWT
-- incrustada en la definición; se reemplazan en
-- 20260915000200_correos_seguros.sql leyendo el secreto desde Vault.
-- ============================================================

-- ---- ventas_turno: amipass (agregado sin migración) ----
alter table public.ventas_turno
  add column if not exists amipass numeric not null default 0;

-- ---- turnos: fondo de caja inicial + papelera (soft delete) ----
alter table public.turnos
  add column if not exists fondo_inicial numeric not null default 0;
alter table public.turnos
  add column if not exists deleted_at timestamptz;

create index if not exists idx_turnos_deleted_at
  on public.turnos (deleted_at) where (deleted_at is not null);

-- La unicidad (jornada, tipo) solo aplica entre turnos activos: un turno
-- en la papelera no bloquea registrar uno nuevo para el mismo día/tipo.
-- (En prod se eliminaron tanto la constraint original de 001 como el
-- índice de 20260605060523; solo queda el índice parcial.)
alter table public.turnos drop constraint if exists turnos_jornada_id_tipo_key;
drop index if exists public.turnos_jornada_tipo_unique;
create unique index if not exists turnos_jornada_id_tipo_activo_key
  on public.turnos (jornada_id, tipo) where (deleted_at is null);

-- ---- jornadas: turno único marcado a mano ("Fusionar") ----
alter table public.jornadas
  add column if not exists es_turno_unico boolean not null default false;

drop policy if exists "jornadas: dueño puede actualizar" on public.jornadas;
create policy "jornadas: dueño puede actualizar" on public.jornadas
  for update using (public.es_dueno()) with check (public.es_dueno());

-- ---- proveedores_frecuentes: UPDATE (creada desde el dashboard) ----
-- Permisiva de más (cualquier autenticado); se corrige en
-- 20260915000100_hardening.sql. Se incluye para reflejar prod tal cual.
drop policy if exists "Permitir actualización a usuarios autenticados" on public.proveedores_frecuentes;
create policy "Permitir actualización a usuarios autenticados" on public.proveedores_frecuentes
  for update to authenticated using (true) with check (true);

-- ---- turno_cierres: conteo físico de caja al cerrar ----
alter table public.turno_cierres
  add column if not exists efectivo_esperado numeric;
alter table public.turno_cierres
  add column if not exists efectivo_contado numeric;
alter table public.turno_cierres
  add column if not exists diferencia_efectivo numeric;

-- ---- logs_error: registro de errores de la app ----
create table if not exists public.logs_error (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usuario_id uuid references public.usuarios(id),
  mensaje text not null,
  contexto text,
  ruta text,
  detalle jsonb
);

create index if not exists idx_logs_error_created_at
  on public.logs_error (created_at desc);

alter table public.logs_error enable row level security;

drop policy if exists "logs_error: autenticados pueden insertar su propio log" on public.logs_error;
create policy "logs_error: autenticados pueden insertar su propio log" on public.logs_error
  for insert with check (usuario_id = auth.uid() or usuario_id is null);

drop policy if exists "logs_error: dueño puede leer" on public.logs_error;
create policy "logs_error: dueño puede leer" on public.logs_error
  for select using (public.es_dueno());

-- ---- configuracion: claves que la app espera (useConfig.jsx) ----
insert into public.configuracion (clave, valor) values
  ('dias_turno_unico',   '[0]'::jsonb),
  ('hora_corte_manana',  '14'::jsonb),
  ('nombre_local',       '"Fryt"'::jsonb),
  ('fondo_caja_inicial', '0'::jsonb)
on conflict (clave) do nothing;

-- ---- cerrar_turno / corregir_turno con conteo de caja ----
-- Reemplazan a las versiones de 20260710020000 (firma de un solo
-- parámetro). La firma nueva es la que llama turnoApi.js:
--   rpc('cerrar_turno',   { p_turno_id, p_efectivo_contado })
--   rpc('corregir_turno', { p_turno_id, p_efectivo_contado })
drop function if exists public.cerrar_turno(uuid);
drop function if exists public.corregir_turno(uuid);

create or replace function public.cerrar_turno(p_turno_id uuid, p_efectivo_contado numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos%rowtype;
  v_ventas public.ventas_turno%rowtype;
  v_proveedores jsonb;
  v_total_ventas numeric;
  v_total_proveedores numeric;
  v_efectivo_prov numeric;
  v_efectivo_esperado numeric;
  v_diferencia numeric;
  v_cierre_id uuid;
begin
  select * into v_turno from public.turnos where id = p_turno_id;
  if v_turno.id is null then
    raise exception 'El turno % no existe', p_turno_id;
  end if;

  if not (v_turno.usuario_id = auth.uid() or public.es_dueno()) then
    raise exception 'No tienes permiso para cerrar este turno';
  end if;

  select * into v_ventas from public.ventas_turno where turno_id = p_turno_id;
  if v_ventas.id is null then
    raise exception 'El turno no tiene ventas registradas todavía';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'monto', monto, 'forma_pago', forma_pago
         )), '[]'::jsonb)
    into v_proveedores
    from public.proveedores_turno where turno_id = p_turno_id;

  v_total_ventas := coalesce(v_ventas.efectivo, 0) + coalesce(v_ventas.getnet, 0)
    + coalesce(v_ventas.mercadopago, 0) + coalesce(v_ventas.edenred, 0)
    + coalesce(v_ventas.amipass, 0) + coalesce(v_ventas.transferencia, 0);

  select coalesce(sum(monto), 0) into v_total_proveedores
    from public.proveedores_turno where turno_id = p_turno_id;

  select coalesce(sum(monto), 0) into v_efectivo_prov
    from public.proveedores_turno where turno_id = p_turno_id and forma_pago = 'efectivo';

  v_efectivo_esperado := coalesce(v_turno.fondo_inicial, 0) + coalesce(v_ventas.efectivo, 0) - v_efectivo_prov;
  v_diferencia := case when p_efectivo_contado is not null then p_efectivo_contado - v_efectivo_esperado else null end;

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id,
    efectivo_esperado, efectivo_contado, diferencia_efectivo
  ) values (
    p_turno_id, auth.uid(),
    jsonb_build_object(
      'efectivo', v_ventas.efectivo, 'getnet', v_ventas.getnet,
      'mercadopago', v_ventas.mercadopago, 'edenred', v_ventas.edenred,
      'amipass', v_ventas.amipass, 'transferencia', v_ventas.transferencia
    ),
    v_proveedores, v_total_ventas, v_total_proveedores, false, null,
    v_efectivo_esperado, p_efectivo_contado, v_diferencia
  ) returning id into v_cierre_id;

  update public.turnos set is_draft = false where id = p_turno_id;

  return v_cierre_id;
end;
$$;

create or replace function public.corregir_turno(p_turno_id uuid, p_efectivo_contado numeric default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos%rowtype;
  v_ventas public.ventas_turno%rowtype;
  v_proveedores jsonb;
  v_total_ventas numeric;
  v_total_proveedores numeric;
  v_efectivo_prov numeric;
  v_efectivo_esperado numeric;
  v_diferencia numeric;
  v_ultimo_cierre_id uuid;
  v_cierre_id uuid;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede registrar una corrección';
  end if;

  select * into v_turno from public.turnos where id = p_turno_id;
  if v_turno.id is null then
    raise exception 'El turno % no existe', p_turno_id;
  end if;

  select id into v_ultimo_cierre_id
    from public.turno_cierres
    where turno_id = p_turno_id
    order by cerrado_en desc
    limit 1;

  if v_ultimo_cierre_id is null then
    raise exception 'Este turno no tiene un cierre previo que corregir';
  end if;

  select * into v_ventas from public.ventas_turno where turno_id = p_turno_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'monto', monto, 'forma_pago', forma_pago
         )), '[]'::jsonb)
    into v_proveedores
    from public.proveedores_turno where turno_id = p_turno_id;

  v_total_ventas := coalesce(v_ventas.efectivo, 0) + coalesce(v_ventas.getnet, 0)
    + coalesce(v_ventas.mercadopago, 0) + coalesce(v_ventas.edenred, 0)
    + coalesce(v_ventas.amipass, 0) + coalesce(v_ventas.transferencia, 0);

  select coalesce(sum(monto), 0) into v_total_proveedores
    from public.proveedores_turno where turno_id = p_turno_id;

  select coalesce(sum(monto), 0) into v_efectivo_prov
    from public.proveedores_turno where turno_id = p_turno_id and forma_pago = 'efectivo';

  v_efectivo_esperado := coalesce(v_turno.fondo_inicial, 0) + coalesce(v_ventas.efectivo, 0) - v_efectivo_prov;
  v_diferencia := case when p_efectivo_contado is not null then p_efectivo_contado - v_efectivo_esperado else null end;

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id,
    efectivo_esperado, efectivo_contado, diferencia_efectivo
  ) values (
    p_turno_id, auth.uid(),
    jsonb_build_object(
      'efectivo', v_ventas.efectivo, 'getnet', v_ventas.getnet,
      'mercadopago', v_ventas.mercadopago, 'edenred', v_ventas.edenred,
      'amipass', v_ventas.amipass, 'transferencia', v_ventas.transferencia
    ),
    v_proveedores, v_total_ventas, v_total_proveedores, true, v_ultimo_cierre_id,
    v_efectivo_esperado, p_efectivo_contado, v_diferencia
  ) returning id into v_cierre_id;

  return v_cierre_id;
end;
$$;

revoke execute on function public.cerrar_turno(uuid, numeric) from public, anon;
revoke execute on function public.corregir_turno(uuid, numeric) from public, anon;
grant execute on function public.cerrar_turno(uuid, numeric) to authenticated, service_role;
grant execute on function public.corregir_turno(uuid, numeric) to authenticated, service_role;
