# FrytControl v2

App renovada del registro de turnos del Minimarket Fryt. Convive con la app
actual (raíz del repo): las dos usan la misma base de Supabase y el modelo
"día completo o dividido" se traduce a `turnos.tipo` + `jornadas.es_turno_unico`
para que la app actual lo siga mostrando bien.

## Stack

- Vite 7 + React 19 + TypeScript estricto
- TanStack Router (rutas en `src/router.tsx`, search params con zod)
- TanStack Query con persistencia en IndexedDB (pantallas instantáneas,
  refresco al volver a la app; sin realtime)
- Tailwind v4 con los tokens "Cálido Editorial" en `src/styles.css`
- PWA (`vite-plugin-pwa`, aviso "Hay una versión nueva")
- supabase-js tipado (`src/lib/database.types.ts`, generado con
  `supabase gen types typescript --linked`)

## Correr

```sh
pnpm install
cp .env.example .env.local            # o .env.staging.local
pnpm dev                              # producción (según .env.local)
pnpm dev --mode staging               # staging (.env.staging.local)
pnpm typecheck && pnpm test && pnpm build
```

## Estructura

```
src/
  lib/        supabase, tipos, query client, auth (sesión como store), formato, totales
  components/ Layout, BottomSheet, Keypad, Toast, PageHeader, …
  features/
    auth/       Login
    hoy/        Hoy: estado del día, borradores olvidados, acción principal
    turno/      Cerrar turno: useTurnoForm (borrador local + autoguardado),
                reglas de modo (modo.ts), hojas de proveedor/monto, api (guardar_turno)
    planilla/   Planilla del día: turnos lado a lado, corregir, dividir/unir, papelera
    historial/  v_resumen_dia con filtros e infinite scroll
    analisis/   resumen_periodo, KPIs con variación, gráfico, top proveedores, CSV
    proveedores/ catálogo: renombrar, logo, fusionar, activar, historial
    ajustes/    general, trabajadores, métodos de pago, papelera, cuentas, errores
```

Toda escritura de un turno pasa por la RPC `guardar_turno` (una transacción).
Las lecturas usan `v_turnos`, `v_resumen_dia` y `resumen_periodo`.

## Roles

- Cuenta del local (rol `trabajador`): Hoy y Cerrar turno. No puede editar
  turnos cerrados (RLS).
- Dueña (rol `dueño`): todo, incluidas correcciones (auditadas en `turno_cierres`).

## Deploy

Proyecto de Vercel aparte con *Root Directory* `v2` (ver `vercel.json`).
Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
