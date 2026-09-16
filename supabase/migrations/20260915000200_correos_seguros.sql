-- ============================================================
-- 20260915000200_correos_seguros.sql
-- Notificaciones por correo sin secretos en la base ni en el repo.
--
-- Antes: un trigger "notificaciones" (creado desde el dashboard) en
-- INSERT de `turnos` llamaba a enviar-resumen-turno con la llave JWT
-- del proyecto escrita en la definición del trigger, y dos cron jobs
-- hacían lo mismo con enviar-resumen-periodico. Problemas:
--   - El correo del turno salía al CREAR el turno (primer autoguardado,
--     sin ventas), no al cerrarlo.
--   - El cron "diario" corría a las 22:00 UTC = 18-19 h en Chile, antes
--     de que se cerrara el turno de la tarde.
--   - La llave quedaba visible en pg_trigger / cron.job y no se podía
--     versionar sin exponerla.
--
-- Ahora:
--   - Trigger AFTER INSERT en `turno_cierres` (solo cierres originales,
--     no correcciones): el correo sale con la fotografía del cierre.
--   - Los cron jobs llaman a una función SQL que arma la petición.
--   - Ambos leen desde Vault dos secretos que se crean A MANO en cada
--     entorno (nunca en migraciones):
--       select vault.create_secret('<secreto largo aleatorio>', 'webhook_secret');
--       select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_base_url');
--     y el mismo secreto se configura en las edge functions:
--       supabase secrets set WEBHOOK_SECRET=<mismo valor>
--     Las edge functions rechazan cualquier petición sin ese header.
--   - Si falta un secreto, la función avisa con WARNING y NO falla: un
--     cierre de turno nunca debe quedar bloqueado por el correo.
-- ============================================================

-- Ya existen en prod; en un proyecto nuevo (staging/local) hay que crearlas.
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;

-- ------------------------------------------------------------
-- Helper: hace el POST a una edge function con el secreto compartido.
-- ------------------------------------------------------------
create or replace function public.invocar_edge_function(p_nombre text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_base_url text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'webhook_secret';
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets where name = 'functions_base_url';

  if v_secret is null or v_base_url is null then
    raise warning 'invocar_edge_function(%): faltan los secretos webhook_secret / functions_base_url en Vault', p_nombre;
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_base_url, '/') || '/' || p_nombre,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := p_body,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function public.invocar_edge_function(text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Correo "Turno registrado": al cerrar (no al crear)
-- ------------------------------------------------------------
create or replace function public.notificar_cierre_turno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.es_correccion then
    return new;
  end if;
  perform public.invocar_edge_function(
    'enviar-resumen-turno',
    jsonb_build_object('type', 'INSERT', 'table', 'turno_cierres', 'record', to_jsonb(new))
  );
  return new;
exception when others then
  -- pg_net encola la petición; si aun así algo falla, el cierre sigue.
  raise warning 'notificar_cierre_turno: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notificar_cierre_turno() from public, anon, authenticated;

drop trigger if exists notificaciones on public.turnos;
drop trigger if exists notificar_cierre on public.turno_cierres;
create trigger notificar_cierre
  after insert on public.turno_cierres
  for each row execute function public.notificar_cierre_turno();

-- ------------------------------------------------------------
-- Resúmenes periódicos (pg_cron). Horarios en UTC:
--   diario  12:00 UTC = 08:00 (invierno) / 09:00 (verano) en Chile,
--           resume el día ANTERIOR ya cerrado.
--   semanal lunes 12:00 UTC, resume lunes-domingo anteriores.
-- ------------------------------------------------------------
create or replace function public.enviar_resumen_periodico(p_tipo text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.invocar_edge_function('enviar-resumen-periodico', jsonb_build_object('tipo', p_tipo));
$$;

revoke execute on function public.enviar_resumen_periodico(text) from public, anon, authenticated;

do $$
declare
  j record;
begin
  -- Retira los jobs viejos (creados desde el dashboard con la llave
  -- incrustada) y cualquier versión previa de los nuevos.
  for j in
    select jobid from cron.job
    where command ilike '%enviar-resumen-periodico%'
       or jobname in ('resumen-diario', 'resumen-semanal')
  loop
    perform cron.unschedule(j.jobid);
  end loop;

  perform cron.schedule('resumen-diario',  '0 12 * * *', $cmd$select public.enviar_resumen_periodico('diario')$cmd$);
  perform cron.schedule('resumen-semanal', '0 12 * * 1', $cmd$select public.enviar_resumen_periodico('semanal')$cmd$);
end;
$$;
