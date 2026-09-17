-- ============================================================
-- 20260920000000_correos_preferencias.sql
-- Correos: quién recibe qué, a qué hora, sin envíos duplicados.
--
-- Antes: un interruptor global (notificaciones_activas) más un correo
-- extra (notificaciones_email_extra), y dos crons con hora UTC fija
-- (08:00 o 09:00 en Chile según el horario de verano).
--
-- Ahora:
--   - correo_destinatarios: cada persona marca cierre / diario /
--     semanal / mensual. Se siembra con los dueños activos y el correo
--     extra; un dueño nuevo entra solo (trigger en usuarios).
--   - configuracion.correos_hora: hora de Chile de los resúmenes (8).
--     notificaciones_activas sigue siendo el interruptor general.
--   - programar_resumenes(): un cron cada hora; manda lo que toca solo
--     cuando la hora de Chile coincide (el horario de verano queda
--     resuelto) y una sola vez por período (correos_enviados).
--   - enviar_correo_prueba(tipo): el dueño se manda el último reporte
--     a sí mismo desde Ajustes.
-- ============================================================

-- ------------------------------------------------------------
-- correo_destinatarios
-- ------------------------------------------------------------
create table if not exists public.correo_destinatarios (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nombre text,
  usuario_id uuid references public.usuarios(id) on delete cascade,
  cierre boolean not null default true,
  diario boolean not null default false,
  semanal boolean not null default true,
  mensual boolean not null default true,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint correo_destinatarios_email_key unique (email),
  constraint correo_destinatarios_email_valido check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create or replace function public.normalizar_correo_destinatario()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  new.nombre := nullif(btrim(coalesce(new.nombre, '')), '');
  return new;
end;
$$;

drop trigger if exists normalizar on public.correo_destinatarios;
create trigger normalizar
  before insert or update on public.correo_destinatarios
  for each row execute function public.normalizar_correo_destinatario();

alter table public.correo_destinatarios enable row level security;

drop policy if exists "correo_destinatarios: dueño lee" on public.correo_destinatarios;
create policy "correo_destinatarios: dueño lee" on public.correo_destinatarios
  for select to authenticated using (public.es_dueno());
drop policy if exists "correo_destinatarios: dueño inserta" on public.correo_destinatarios;
create policy "correo_destinatarios: dueño inserta" on public.correo_destinatarios
  for insert to authenticated with check (public.es_dueno());
drop policy if exists "correo_destinatarios: dueño actualiza" on public.correo_destinatarios;
create policy "correo_destinatarios: dueño actualiza" on public.correo_destinatarios
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());
-- Las cuentas no se borran desde acá (se desactivan); solo los correos sueltos.
drop policy if exists "correo_destinatarios: dueño elimina" on public.correo_destinatarios;
create policy "correo_destinatarios: dueño elimina" on public.correo_destinatarios
  for delete to authenticated using (public.es_dueno() and usuario_id is null);

revoke all on public.correo_destinatarios from anon;
grant select, insert, update, delete on public.correo_destinatarios to authenticated;

insert into public.correo_destinatarios (email, nombre, usuario_id)
select email, nombre, id from public.usuarios
where rol = 'dueño' and activo and email is not null
on conflict (email) do nothing;

insert into public.correo_destinatarios (email)
select valor #>> '{}' from public.configuracion
where clave = 'notificaciones_email_extra'
  and (valor #>> '{}') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
on conflict (email) do nothing;

-- Un dueño nuevo recibe los correos por defecto.
create or replace function public.usuario_a_destinatario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol = 'dueño' and new.email is not null then
    insert into public.correo_destinatarios (email, nombre, usuario_id)
    values (new.email, new.nombre, new.id)
    on conflict (email) do update set usuario_id = excluded.usuario_id
      where public.correo_destinatarios.usuario_id is null;
  end if;
  return new;
end;
$$;

revoke execute on function public.usuario_a_destinatario() from public, anon, authenticated;

drop trigger if exists destinatario_de_correo on public.usuarios;
create trigger destinatario_de_correo
  after insert or update of rol on public.usuarios
  for each row execute function public.usuario_a_destinatario();

-- ------------------------------------------------------------
-- correos_enviados: un resumen por tipo y período, nunca dos.
-- ------------------------------------------------------------
create table if not exists public.correos_enviados (
  tipo text not null check (tipo in ('diario', 'semanal', 'mensual')),
  periodo date not null,
  enviado_en timestamptz not null default now(),
  primary key (tipo, periodo)
);

alter table public.correos_enviados enable row level security;
revoke all on public.correos_enviados from anon, authenticated;

insert into public.configuracion (clave, valor)
values ('correos_hora', to_jsonb(8))
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- programar_resumenes: lo llama el cron cada hora.
-- ------------------------------------------------------------
create or replace function public.programar_resumenes(p_ahora timestamptz default now())
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := p_ahora at time zone 'America/Santiago';
  v_hoy date := (p_ahora at time zone 'America/Santiago')::date;
  v_hora int;
  v_lunes date := date_trunc('week', v_hoy)::date;
  v_mes date := date_trunc('month', v_hoy)::date;
  v_filas int;
  v_enviados text[] := '{}';
  r record;
begin
  select coalesce((select (valor #>> '{}')::int from public.configuracion where clave = 'correos_hora'), 8)
    into v_hora;
  if extract(hour from v_local)::int <> v_hora then
    return v_enviados;
  end if;
  if (select valor from public.configuracion where clave = 'notificaciones_activas') = 'false'::jsonb then
    return v_enviados;
  end if;

  for r in
    select * from (values
      ('diario',  v_hoy - 1,                                  v_hoy - 1),
      ('semanal', v_lunes - 7,                                v_lunes - 1),
      ('mensual', (v_mes - interval '1 month')::date,         v_mes - 1)
    ) as t(tipo, desde, hasta)
    where tipo = 'diario'
       or (tipo = 'semanal' and extract(isodow from v_hoy) = 1)
       or (tipo = 'mensual' and extract(day from v_hoy) = 1)
  loop
    -- Solo si alguien lo recibe (si nadie, no se marca: activarlo más
    -- tarde ese mismo día todavía alcanza a mandarlo en la hora).
    if not exists (
      select 1 from public.correo_destinatarios d
      left join public.usuarios u on u.id = d.usuario_id
      where d.activo and coalesce(u.activo, true)
        and case r.tipo when 'diario' then d.diario when 'semanal' then d.semanal else d.mensual end
    ) then
      continue;
    end if;

    insert into public.correos_enviados (tipo, periodo) values (r.tipo, r.desde)
    on conflict do nothing;
    get diagnostics v_filas = row_count;
    if v_filas = 1 then
      perform public.invocar_edge_function('enviar-resumen-periodico',
        jsonb_build_object('tipo', r.tipo, 'desde', r.desde, 'hasta', r.hasta));
      v_enviados := v_enviados || r.tipo::text;
    end if;
  end loop;
  return v_enviados;
end;
$$;

revoke execute on function public.programar_resumenes(timestamptz) from public, anon, authenticated;

-- Compatibilidad: ahora acepta también 'mensual' (la función calcula el
-- período cerrado más reciente).
create or replace function public.enviar_resumen_periodico(p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('diario', 'semanal', 'mensual') then
    raise exception 'Tipo de resumen desconocido: %', p_tipo;
  end if;
  perform public.invocar_edge_function('enviar-resumen-periodico', jsonb_build_object('tipo', p_tipo));
end;
$$;

revoke execute on function public.enviar_resumen_periodico(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- enviar_correo_prueba: solo al correo de quien la pide.
-- ------------------------------------------------------------
create or replace function public.enviar_correo_prueba(p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_cierre jsonb;
begin
  if not public.es_dueno() then
    raise exception 'Solo una cuenta de dueño puede enviar pruebas.' using errcode = '42501';
  end if;
  select email into v_email from public.usuarios where id = auth.uid();
  if v_email is null then
    raise exception 'Tu cuenta no tiene correo.';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'webhook_secret')
     or not exists (select 1 from vault.decrypted_secrets where name = 'functions_base_url') then
    raise exception 'Los correos no están configurados en este entorno.';
  end if;

  if p_tipo = 'cierre' then
    select to_jsonb(c) into v_cierre
    from public.turno_cierres c
    where not c.es_correccion
    order by c.cerrado_en desc
    limit 1;
    if v_cierre is null then
      raise exception 'Todavía no hay cierres para usar de ejemplo.';
    end if;
    perform public.invocar_edge_function('enviar-resumen-turno', jsonb_build_object(
      'type', 'INSERT', 'table', 'turno_cierres', 'record', v_cierre, 'soloA', v_email));
  elsif p_tipo in ('diario', 'semanal', 'mensual') then
    perform public.invocar_edge_function('enviar-resumen-periodico',
      jsonb_build_object('tipo', p_tipo, 'soloA', v_email));
  else
    raise exception 'Tipo de correo desconocido: %', p_tipo;
  end if;
end;
$$;

revoke execute on function public.enviar_correo_prueba(text) from public, anon;
grant execute on function public.enviar_correo_prueba(text) to authenticated;

-- ------------------------------------------------------------
-- Crons: uno por hora reemplaza a resumen-diario / resumen-semanal.
-- ------------------------------------------------------------
do $$
declare
  j record;
begin
  for j in
    select jobid from cron.job
    where jobname in ('resumen-diario', 'resumen-semanal', 'resumenes')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('resumenes', '5 * * * *', $cmd$select public.programar_resumenes()$cmd$);
end;
$$;
