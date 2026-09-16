-- ============================================================
-- 20260917000000_metodos_acumulado_diario.sql
-- Algunos terminales (Edenred, y según el local, Amipass) no cierran por
-- turno: la máquina muestra el TOTAL ACUMULADO DEL DÍA. Quien cierra la
-- tarde tenía que restar a mano lo que se registró en la mañana.
--
-- Se modela como propiedad del método de pago, no como un caso especial
-- de la pantalla: `acumulado_diario = true` significa "la fuente entrega
-- el total del día". La v2 lo usa al cerrar la tarde: se escribe el total
-- que muestra la máquina y la app calcula y guarda la parte de la tarde
-- (total − mañana), mostrando la resta. Lo que queda guardado sigue siendo
-- el monto por turno, así que reportes, cierres y la app actual no cambian.
-- Solo la lee la v2 (tabla metodos_pago); la app actual la ignora.
-- ============================================================
alter table public.metodos_pago
  add column if not exists acumulado_diario boolean not null default false;

comment on column public.metodos_pago.acumulado_diario is
  'La máquina/plataforma entrega el total del día, no por turno: al cerrar la tarde se ingresa el total y se deriva la parte de la tarde.';

update public.metodos_pago set acumulado_diario = true where key = 'edenred' and acumulado_diario = false;
