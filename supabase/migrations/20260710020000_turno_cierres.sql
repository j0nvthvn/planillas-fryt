-- ============================================================
-- 20260710020000_turno_cierres.sql
-- Fase 1 de la propuesta de guardado/cierre de turnos
-- (ver propuesta-guardado-y-cierre-turnos.md).
--
-- Introduce un registro de auditoría inmutable para el cierre de
-- turnos, equivalente a un "Z report" de un sistema de punto de
-- venta: una fotografía de ventas y proveedores al momento de
-- cerrar el turno, que no se puede editar ni borrar directamente.
--
-- Esta migración es puramente aditiva: crea una tabla nueva y dos
-- funciones nuevas (cerrar_turno, corregir_turno). No modifica el
-- comportamiento de ninguna tabla ni política existente, y el
-- código del cliente (Turno.jsx, EditarTurno.jsx, turnoApi.js)
-- todavía no las usa — eso llega en una fase posterior.
-- ============================================================

create table public.turno_cierres (
  id uuid primary key default uuid_generate_v4(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  cerrado_por uuid not null references public.usuarios(id),
  cerrado_en timestamptz not null default now(),
  ventas_snapshot jsonb not null,
  proveedores_snapshot jsonb not null,
  total_ventas numeric not null,
  total_proveedores numeric not null,
  es_correccion boolean not null default false,
  cierre_anterior_id uuid references public.turno_cierres(id)
);

create index idx_turno_cierres_turno_id on public.turno_cierres(turno_id);

alter table public.turno_cierres enable row level security;

-- Lectura: cualquier autenticado puede ver el historial de cierres
-- (igual que ya pueden ver turnos/ventas/proveedores de cualquier
-- jornada, ver 004_rls_lectura_compartida.sql).
create policy "turno_cierres: autenticados pueden leer"
  on public.turno_cierres for select
  using (auth.uid() is not null);

-- A propósito NO se agregan políticas de insert/update/delete para
-- usuarios: la tabla solo se escribe a través de las funciones
-- security definer de más abajo, nunca directo desde el cliente.
-- Eso es lo que la hace un registro inmutable de verdad.

-- ------------------------------------------------------------
-- cerrar_turno: cierre original de un turno (equivalente a
-- generar el Z report). Guarda la fotografía y marca is_draft=false.
-- Solo puede cerrarlo el dueño del turno o el dueño del negocio.
-- ------------------------------------------------------------
create or replace function public.cerrar_turno(p_turno_id uuid)
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

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id
  ) values (
    p_turno_id, auth.uid(),
    jsonb_build_object(
      'efectivo', v_ventas.efectivo, 'getnet', v_ventas.getnet,
      'mercadopago', v_ventas.mercadopago, 'edenred', v_ventas.edenred,
      'amipass', v_ventas.amipass, 'transferencia', v_ventas.transferencia
    ),
    v_proveedores, v_total_ventas, v_total_proveedores, false, null
  ) returning id into v_cierre_id;

  update public.turnos set is_draft = false where id = p_turno_id;

  return v_cierre_id;
end;
$$;

-- ------------------------------------------------------------
-- corregir_turno: registra una nueva fotografía encadenada al
-- cierre anterior, sin modificar los cierres previos. Se llama
-- DESPUÉS de guardar la edición sobre ventas_turno/proveedores_turno,
-- para que la fotografía capture el valor ya corregido. Solo el
-- dueño del negocio puede corregir un turno ya cerrado.
-- ------------------------------------------------------------
create or replace function public.corregir_turno(p_turno_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ventas public.ventas_turno%rowtype;
  v_proveedores jsonb;
  v_total_ventas numeric;
  v_total_proveedores numeric;
  v_ultimo_cierre_id uuid;
  v_cierre_id uuid;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede registrar una corrección';
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

  insert into public.turno_cierres (
    turno_id, cerrado_por, ventas_snapshot, proveedores_snapshot,
    total_ventas, total_proveedores, es_correccion, cierre_anterior_id
  ) values (
    p_turno_id, auth.uid(),
    jsonb_build_object(
      'efectivo', v_ventas.efectivo, 'getnet', v_ventas.getnet,
      'mercadopago', v_ventas.mercadopago, 'edenred', v_ventas.edenred,
      'amipass', v_ventas.amipass, 'transferencia', v_ventas.transferencia
    ),
    v_proveedores, v_total_ventas, v_total_proveedores, true, v_ultimo_cierre_id
  ) returning id into v_cierre_id;

  return v_cierre_id;
end;
$$;

grant execute on function public.cerrar_turno(uuid) to authenticated;
grant execute on function public.corregir_turno(uuid) to authenticated;
