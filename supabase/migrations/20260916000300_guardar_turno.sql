-- ============================================================
-- 20260916000300_guardar_turno.sql  (Fase 1.4 del plan v2)
-- Guardado de un turno completo en UNA transacción y UNA llamada:
--
--   select public.guardar_turno('{
--     "fecha": "2026-09-15",
--     "modo": "completo" | "mañana" | "tarde",
--     "trabajador_id": "<uuid>" | null,
--     "fondo_inicial": 20000,
--     "ventas": { "efectivo": 120000, "getnet": 80000, ... },
--     "proveedores": [
--       { "id": "<uuid existente>" | null, "proveedor_id": "<uuid>" | null,
--         "nombre": "PF", "monto": 15000, "forma_pago": "efectivo" }
--     ],
--     "cerrar": true,
--     "efectivo_contado": 135000 | null,
--     "base_updated_at": "<updated_at que tenía el cliente>" | null
--   }'::jsonb);
--
-- Devuelve la fila de v_turnos como jsonb, o {"conflicto": true,
-- "actual": <fila>} si base_updated_at no coincide con la base (otro
-- dispositivo guardó en el medio; el cliente decide qué hacer).
--
-- Reglas:
--   - "completo" = tipo 'mañana' + jornada.es_turno_unico = true (así
--     la app actual lo ve como "turno único"). "mañana"/"tarde" ponen
--     es_turno_unico = false.
--   - No se puede registrar "tarde" en un día marcado completo ni
--     "completo" si ya existe una tarde: error legible.
--   - Proveedores por diferencia: los que traen id se actualizan, los
--     nuevos se insertan, los que no vienen se borran. Sin id ni
--     proveedor_id, el trigger de proveedores_turno resuelve el nombre
--     contra el catálogo.
--   - cerrar = true: cerrar_turno() si es borrador, corregir_turno() si
--     ya estaba cerrado (solo dueño). Ambas son security definer y
--     guardan la fotografía inmutable en turno_cierres.
--   - security invoker: aplica el RLS del que llama (un trabajador solo
--     puede escribir en sus borradores; el dueño en todo).
--   - Si cualquier paso falla, no queda nada a medias.
-- ============================================================

create or replace function public.guardar_turno(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fecha date;
  v_modo text;
  v_tipo text;
  v_es_unico boolean;
  v_cerrar boolean;
  v_base timestamptz;
  v_jornada_id uuid;
  v_turno public.turnos%rowtype;
  v_ventas jsonb;
  v_provs jsonb;
  v_prov jsonb;
  v_ids_conservados uuid[] := '{}';
  v_id uuid;
  v_uid uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'Sin sesión' using errcode = 'insufficient_privilege';
  end if;

  -- ---------- entrada ----------
  v_fecha := (p->>'fecha')::date;
  v_modo  := coalesce(p->>'modo', 'completo');
  if v_fecha is null then
    raise exception 'Falta la fecha' using errcode = 'invalid_parameter_value';
  end if;
  if v_modo not in ('completo', 'mañana', 'tarde') then
    raise exception 'modo debe ser completo, mañana o tarde' using errcode = 'invalid_parameter_value';
  end if;
  v_tipo := case when v_modo = 'tarde' then 'tarde' else 'mañana' end;
  v_es_unico := (v_modo = 'completo');
  v_cerrar := coalesce((p->>'cerrar')::boolean, false);
  v_base := nullif(p->>'base_updated_at', '')::timestamptz;
  v_ventas := p->'ventas';
  v_provs := p->'proveedores';

  -- ---------- jornada ----------
  select id into v_jornada_id from public.jornadas where fecha = v_fecha;
  if v_jornada_id is null then
    insert into public.jornadas (fecha, es_turno_unico) values (v_fecha, v_es_unico)
      returning id into v_jornada_id;
  end if;
  -- Serializa escrituras del mismo día.
  perform 1 from public.jornadas where id = v_jornada_id for update;

  -- ---------- reglas de modo ----------
  if v_modo = 'tarde' and exists (select 1 from public.jornadas where id = v_jornada_id and es_turno_unico) then
    raise exception 'El % está registrado como día completo; divídelo antes de agregar un turno de tarde', v_fecha
      using errcode = 'check_violation';
  end if;
  if v_modo = 'completo' and exists (
    select 1 from public.turnos where jornada_id = v_jornada_id and tipo = 'tarde' and deleted_at is null
  ) then
    raise exception 'El % ya tiene un turno de tarde; no se puede registrar como día completo', v_fecha
      using errcode = 'check_violation';
  end if;

  -- ---------- turno (crear o bloquear) ----------
  -- Primero se busca sin bloquear: bajo RLS, `for update` también exige
  -- pasar la política de UPDATE, y para un trabajador un turno cerrado
  -- "desaparecería" y se intentaría insertar un duplicado.
  select * into v_turno
    from public.turnos
    where jornada_id = v_jornada_id and tipo = v_tipo and deleted_at is null;

  if v_turno.id is not null then
    perform 1 from public.turnos where id = v_turno.id for update;
    if not found then
      raise exception 'No tienes permiso para modificar este turno (ya está cerrado)'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if v_turno.id is null then
    insert into public.turnos (jornada_id, tipo, usuario_id, trabajador_id, fondo_inicial, is_draft)
      values (
        v_jornada_id, v_tipo, v_uid,
        nullif(p->>'trabajador_id', '')::uuid,
        coalesce((p->>'fondo_inicial')::numeric, 0),
        true
      )
      returning * into v_turno;
  else
    -- Concurrencia optimista: el cliente dice qué versión tenía.
    if v_base is not null and v_turno.updated_at <> v_base then
      select to_jsonb(vt) into v_resultado from public.v_turnos vt where vt.id = v_turno.id;
      return jsonb_build_object('conflicto', true, 'actual', v_resultado);
    end if;
    update public.turnos
      set trabajador_id = case when p ? 'trabajador_id' then nullif(p->>'trabajador_id', '')::uuid else trabajador_id end,
          fondo_inicial = case when p ? 'fondo_inicial' then coalesce((p->>'fondo_inicial')::numeric, 0) else fondo_inicial end
      where id = v_turno.id;
  end if;

  -- El modo manda sobre la marca de turno único de la jornada.
  update public.jornadas set es_turno_unico = v_es_unico
    where id = v_jornada_id and es_turno_unico is distinct from v_es_unico;

  -- ---------- ventas ----------
  if v_ventas is not null then
    insert into public.ventas_turno (turno_id, efectivo, getnet, mercadopago, edenred, amipass, transferencia)
      values (
        v_turno.id,
        coalesce((v_ventas->>'efectivo')::numeric, 0),
        coalesce((v_ventas->>'getnet')::numeric, 0),
        coalesce((v_ventas->>'mercadopago')::numeric, 0),
        coalesce((v_ventas->>'edenred')::numeric, 0),
        coalesce((v_ventas->>'amipass')::numeric, 0),
        coalesce((v_ventas->>'transferencia')::numeric, 0)
      )
      on conflict (turno_id) do update set
        efectivo = excluded.efectivo, getnet = excluded.getnet, mercadopago = excluded.mercadopago,
        edenred = excluded.edenred, amipass = excluded.amipass, transferencia = excluded.transferencia;
  end if;

  -- ---------- proveedores por diferencia ----------
  if v_provs is not null then
    for v_prov in select * from jsonb_array_elements(v_provs) loop
      if coalesce((v_prov->>'monto')::numeric, 0) <= 0 then
        continue;  -- filas vacías / a medio escribir no se guardan
      end if;
      v_id := nullif(v_prov->>'id', '')::uuid;
      if v_id is not null and exists (select 1 from public.proveedores_turno where id = v_id and turno_id = v_turno.id) then
        update public.proveedores_turno
          set monto = (v_prov->>'monto')::numeric,
              forma_pago = coalesce(v_prov->>'forma_pago', forma_pago),
              proveedor_id = coalesce(nullif(v_prov->>'proveedor_id', '')::uuid, proveedor_id),
              nombre = coalesce(nullif(btrim(v_prov->>'nombre'), ''), nombre)
          where id = v_id;
      else
        insert into public.proveedores_turno (turno_id, proveedor_id, nombre, monto, forma_pago)
          values (
            v_turno.id,
            nullif(v_prov->>'proveedor_id', '')::uuid,
            coalesce(nullif(btrim(v_prov->>'nombre'), ''), 'Proveedor'),
            (v_prov->>'monto')::numeric,
            coalesce(v_prov->>'forma_pago', 'efectivo')
          )
          returning id into v_id;
      end if;
      v_ids_conservados := v_ids_conservados || v_id;
    end loop;

    delete from public.proveedores_turno
      where turno_id = v_turno.id and not (id = any (v_ids_conservados));
  end if;

  -- ---------- cierre ----------
  if v_cerrar then
    if v_turno.is_draft then
      perform public.cerrar_turno(v_turno.id, nullif(p->>'efectivo_contado', '')::numeric);
    else
      perform public.corregir_turno(v_turno.id, nullif(p->>'efectivo_contado', '')::numeric);
    end if;
  end if;

  select to_jsonb(vt) into v_resultado from public.v_turnos vt where vt.id = v_turno.id;
  return v_resultado;
end;
$$;

revoke execute on function public.guardar_turno(jsonb) from public, anon;
grant execute on function public.guardar_turno(jsonb) to authenticated;
