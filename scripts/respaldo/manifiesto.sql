-- Huella de un respaldo: filas por tabla y sumas de dinero. Se genera
-- al volcar y se compara al restaurar (scripts/respaldo/*.sh). Las sumas
-- van como texto para comparar sin redondeos.
select jsonb_pretty(jsonb_build_object(
  'filas', (
    select jsonb_object_agg(tabla, filas) from (
      select 'auth.users' as tabla, count(*) as filas from auth.users
      union all select 'usuarios', count(*) from public.usuarios
      union all select 'configuracion', count(*) from public.configuracion
      union all select 'proveedores_frecuentes', count(*) from public.proveedores_frecuentes
      union all select 'trabajadores', count(*) from public.trabajadores
      union all select 'metodos_pago', count(*) from public.metodos_pago
      union all select 'jornadas', count(*) from public.jornadas
      union all select 'turnos', count(*) from public.turnos
      union all select 'ventas_turno', count(*) from public.ventas_turno
      union all select 'proveedores_turno', count(*) from public.proveedores_turno
      union all select 'turno_cierres', count(*) from public.turno_cierres
      union all select 'logs_error', count(*) from public.logs_error
    ) f
  ),
  'sumas', jsonb_build_object(
    'turno_cierres.total_ventas', (select coalesce(sum(total_ventas), 0)::text from public.turno_cierres),
    'ventas_turno.efectivo', (select coalesce(sum(efectivo), 0)::text from public.ventas_turno),
    'ventas_turno.total', (select coalesce(sum(efectivo + getnet + mercadopago + edenred + amipass + transferencia), 0)::text from public.ventas_turno),
    'proveedores_turno.monto', (select coalesce(sum(monto), 0)::text from public.proveedores_turno)
  ),
  'ultima_jornada', (select max(fecha)::text from public.jornadas)
));
