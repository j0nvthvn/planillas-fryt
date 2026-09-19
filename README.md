# FrytControl

App del registro de turnos del Minimarket Fryt, en https://app.frytspa.cl.
Único frontend desde el 2026-09-17: la app anterior quedó retirada y su código
está en el tag `legacy-final` y en la rama `legacy`.

El modelo "día completo o dividido" todavía se guarda como `turnos.tipo` +
`jornadas.es_turno_unico` (la traducción la hacen `guardar_turno` y `v_turnos`).
Simplificar eso es la parte de esquema de la Fase 5, aún pendiente.

## Stack

- Vite 7 + React 19 + TypeScript estricto
- TanStack Router (rutas en `src/router.tsx`, search params con zod)
- TanStack Query con persistencia en IndexedDB (pantallas instantáneas,
  refresco al volver a la app; sin realtime)
- Tailwind v4 con los tokens del rediseño Fintech en `src/styles.css`
- PWA (`vite-plugin-pwa`, aviso "Hay una versión nueva"); fuentes alojadas en
  el repo (`@fontsource`), sin depender de Google Fonts
- ESLint (flat config, reglas con tipos) y Playwright para el e2e
- supabase-js tipado (`src/lib/database.types.ts`, generado con
  `supabase gen types typescript --linked`)

## Correr

```sh
pnpm install
cp .env.example .env.local            # o .env.staging.local
pnpm dev                              # producción (según .env.local)
pnpm dev --mode staging               # staging (.env.staging.local)
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Contra staging (nunca contra producción; ambos limpian lo que crean):

```sh
pnpm e2e                              # Playwright: el cierre completo en el navegador
                                      # (levanta `pnpm dev --mode staging` solo)
SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=<.env.staging.local> \
  pnpm vitest run --mode staging src/test/integracion.staging.test.ts
```

La primera vez, `pnpm exec playwright install chromium`. En cada push, GitHub
Actions corre lint, tipos, tests, build y las pruebas de las plantillas de
correo (`.github/workflows/ci.yml`).

## Estructura

```
src/
  lib/        supabase, tipos, query client, auth (sesión como store), formato, totales
  components/ Layout, BottomSheet, Keypad, Toast, PageHeader, …
  features/
    auth/       Login
    hoy/        Hoy: estado del día, borradores olvidados, acción principal
    turno/      Cerrar turno: useTurnoForm (borrador local + autoguardado),
                reglas de modo (modo.ts), hojas de proveedor/monto, conteo de
                caja por billetes (conteo.ts + ConteoSheet), revisión previa
                al cierre (revision.ts + RevisionSheet), aviso de proveedor
                parecido (parecido.ts), api (guardar_turno)
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

Proyecto de Vercel `frytcontrol-v2`, *Root Directory* la raíz del repo (ver
`vercel.json`): `main` despliega producción y las demás ramas, previews contra
staging (lo decide `VERCEL_ENV`). Variables: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`.

El repo tiene además el proyecto `planillas-fryt`, que despliega la rama
`legacy` y solo redirige a `app.frytspa.cl`.

## Base de datos

`supabase/` (migraciones, edge functions y pruebas pgTAP) vive en este mismo
repo y es compartido: ver `docs/operacion.md`.

## Accesibilidad

Reglas que no se rompen (están en `src/styles.css`): foco visible global,
`prefers-reduced-motion`, ningún texto bajo 12 px (la escala vive en tokens
`--text-*`) y selección de texto permitida salvo en la navegación y el
teclado. Las hojas son `<dialog>` con `showModal()`: atrapan el foco y lo
devuelven. Sobre fondos sólidos de marca o estado se usa `text-on-solid`, no
`text-white` (en modo oscuro esos fondos son claros).
