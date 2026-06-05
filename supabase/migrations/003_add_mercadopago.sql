-- ============================================================
-- 002_add_mercadopago.sql
-- Agrega el método de pago "Mercado Pago" (máquina de tarjetas,
-- igual que Getnet) a las ventas del turno.
-- ============================================================

alter table public.ventas_turno
  add column mercadopago numeric not null default 0 check (mercadopago >= 0);
