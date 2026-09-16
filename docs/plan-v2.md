# Plan: FrytControl v2 — renovación sin interrumpir la app actual

> **Estado al 2026-09-16**
> - Fase 0: código listo y commiteado (repo limpio, migraciones baseline/grants/hardening/correos, edge functions, arreglos de frontend). **Nada aplicado en prod todavía** (ni base ni frontend: los commits no se han pusheado). Pendiente: aplicar migraciones en prod vía MCP, dominio en Resend + secretos (pospuesto por decisión del usuario), limpieza de datos con la dueña (`docs/limpieza-datos-2026-09.sql`).
> - Fase 1: migraciones 1.1–1.4 probadas en local (62 pgTAP) y **aplicadas en staging** `psdhhwcxjcobwxjiemrr` (sa-east-1) sobre una copia real de prod: 0 diferencias entre `turno_totales` y los cierres, humo de la app actual (`scripts/smoke-legacy.mjs`, 60 comprobaciones) en verde contra staging y local. Pendiente: 1.6 (prod) cuando el usuario lo autorice.
> - Fases 2–5: no iniciadas.

## Contexto

FrytControl (React 18 + Vite + Tailwind + Supabase us-east-2, Vercel hobby, pnpm, Node 24) registra ventas y proveedores del Minimarket Fryt. La evaluación (código + base de producción, solo lectura) mostró:

- **Uso real ≠ diseño.** 193/193 turnos los registró la cuenta de la dueña desde **un móvil compartido del local**, al cierre (picos 14 h y 20 h). **45 % de los días de semana se cierran como un solo turno** (una persona atendió todo el día; mismas ventas promedio que los días con dos turnos), pero el modelo obliga a "mañana/tarde" y a fusionar/desmarcar a mano. La app está construida para multiusuario concurrente (autoguardado por campo, realtime, conflictos, RLS por trabajador) → complejidad y lentitud sin beneficio.
- **Lentitud.** 6–8 viajes al servidor por autoguardado (`src/components/turno/turnoApi.js:80`), consultas en cascada jornada→turnos en todas las páginas, descarga completa de `proveedores_turno` para sugerencias, sin caché, base en Ohio.
- **Fricción.** 19 borradores sin cerrar (18 de días pasados), 29 % de cierres son correcciones, **0 conteos de caja**, proveedores duplicados (PF/Pf, Río/Rio Maipo, Nestlé Lacteos/lacteos, Comercial GAUNE/Gaune).
- **Bugs/ops.** Correos no llegan (Resend en modo prueba: solo envía al correo del dueño de la cuenta Resend); `enviar-resumen-turno` se dispara al *crear* el turno (sin ventas) y compara fechas en UTC; cron diario a 22:00 UTC (18 h Chile, antes del cierre); `enviar-resumen-periodico` tiene `verify_jwt=false` → cualquiera puede invocarla; el webhook y los crons llevan la llave JWT de Supabase incrustada en la base; totales duplicados en ~9 lugares con fórmulas distintas; migraciones del repo no reflejan producción (`deleted_at`, `fondo_inicial`, `es_turno_unico`, `efectivo_*`, `logs_error`, `cerrar_turno(uuid,numeric)`, `jornadas: dueño puede actualizar`, webhook, crons); `.env.local`, `dist/`, `supabase/.temp/` versionados; `package-lock.json` sobrante (el commit 3e6056c migró a pnpm); RLS UPDATE `true` en `proveedores_frecuentes`; ventas de turnos cerrados editables vía API. Verificado: **no hay turnos mal fechados** por registros de madrugada (los de 00–02 h fueron carga histórica).

**Decisiones del usuario:** trabajadores sin cuenta (se elige el nombre de una lista); modelo **"día completo o dividido"**; desarrollo contra **staging** y luego piloto contra la **base real con ambas apps en paralelo**; conexión estable (borrador local + reintento); **migrar a sa-east-1 en el cambio definitivo**; **habrá dominio propio** para los correos.

**Regla de oro:** hasta la Fase 5, todo cambio de base es **aditivo y compatible** con la app actual (*expand → contract*). Si la v2 falla, la dueña sigue usando la actual sin notar nada.

**Equivalencia clave (compatibilidad):** "día completo" en v2 = `turnos.tipo='mañana'` + `jornadas.es_turno_unico=true` — exactamente lo que hoy produce "Fusionar en turno único" (`src/pages/Resumen.jsx:109`), así la app actual lo muestra bien como "Turno único".

---

## Fase 0 — Estabilizar la app actual (usable en producción de inmediato)

### 0.1 Repo y migraciones como fuente de verdad
- `git rm --cached` de `.env.local`, `dist/`, `supabase/.temp/`, `.codegraph/`, `package-lock.json`; agregarlos a `.gitignore` (menos el lockfile, que se borra). `deno.lock` → `supabase/functions/deno.lock`. (La anon key es pública por diseño; no requiere rotación.)
- `supabase db pull` → migración baseline `supabase/migrations/20260915000000_baseline_prod.sql` con todo lo que existe solo en prod (ver Contexto). **Sin secretos:** el webhook y los crons actuales se documentan pero no se copian; se reemplazan en 0.3. Marcar aplicada con `supabase migration repair --status applied`.
- Mover `propuesta-guardado-y-cierre-turnos.md` y `design_handoff_ingresar_turno/` a `docs/`.

### 0.2 Seguridad y rendimiento de base (`..._hardening.sql`)
Compatible con la app actual porque toda escritura hoy la hace la dueña (hay 2 cuentas dueño + 1 trabajador):
- `proveedores_frecuentes` UPDATE → `using (es_dueno())`; INSERT autenticado se mantiene (upsert de `guardarTurno`).
- `ventas_turno` y `proveedores_turno` INSERT/UPDATE/DELETE: `es_dueno() or (turno propio and turno.is_draft)`.
- Reescribir políticas con `(select auth.uid())` y `to authenticated`; luego `revoke execute … from anon, public` en `es_dueno`/`get_my_rol` (el orden importa: `ConfigProvider` consulta `configuracion` antes del login y debe seguir recibiendo vacío, no error).
- `set search_path = public` en `get_my_rol`, `es_dueno`, `set_updated_at`, `touch_turno_updated_at`.
- `check (amipass >= 0)`; índices en `turno_cierres(cerrado_por)`, `turno_cierres(cierre_anterior_id)`, `logs_error(usuario_id)`.
- Activar *leaked password protection* (dashboard Auth).

### 0.3 Correos (prerrequisito manual: verificar el dominio en Resend y crear secretos)
- Secretos: `supabase secrets set RESEND_API_KEY RESEND_FROM WEBHOOK_SECRET ANTHROPIC_API_KEY`; en la base `select vault.create_secret('<mismo valor>', 'webhook_secret')` (manual, fuera de migraciones).
- Migración: trigger function `notificar_cierre_turno()` (AFTER INSERT en `turno_cierres` where `es_correccion=false`) que lee `vault.decrypted_secrets` y hace `net.http_post` con header `x-webhook-secret`; borrar el trigger `notificaciones` de `turnos`. Crons recreados con `cron.schedule` leyendo el secreto del vault: diario `0 12 * * *` UTC (≈08–09 h Chile) resumiendo **el día anterior**; semanal `0 12 * * 1`.
- Ambas edge functions: `verify_jwt=false` + rechazo si falta/difiere `x-webhook-secret` (config en `supabase/config.toml`).
- `supabase/functions/enviar-resumen-turno/index.ts`: recibir el registro de `turno_cierres`; usar `ventas_snapshot`/`proveedores_snapshot`/`efectivo_*`; eliminar el filtro de fecha UTC.
- `supabase/functions/enviar-resumen-periodico/index.ts`: fechas con `America/Santiago` (Intl) en vez de `toISOString()`; filtrar `turnos.deleted_at is null`; marcar borradores; "Caja" con fondo inicial igual que la app.

### 0.4 Arreglos mínimos en el frontend actual
- `src/pages/Turno.jsx:480`: "Sin conexión — se guardará al volver" → "Sin conexión — los cambios no se están guardando" (como `Layout.jsx:113`).
- `src/components/ErrorBoundary.jsx`: ante `Failed to fetch dynamically imported module`, recargar una vez (flag en `sessionStorage`).

### 0.5 Limpieza de datos (con la dueña; SQL revisado antes de correr)
- Unificar nombres duplicados en `proveedores_turno` y `proveedores_frecuentes` (canónicos a confirmar: PF, Río Maipo, Nestlé Lácteos, Comercial Gaune).
- Revisar los 18 borradores de días pasados en Historial: cerrar o eliminar uno a uno (dinero; nada automático).
- Días con un solo turno "mañana" que fueron día completo: marcar `es_turno_unico=true` (lista para que la dueña confirme; 40 días desde junio).

---

## Fase 1 — Backend compatible para la v2 (staging → prod)

### 1.0 Staging
- Proyecto Supabase **`planillas-fryt-staging` en sa-east-1** (costo $0 en la organización actual; los proyectos gratis se pausan tras 7 días sin uso — basta reactivarlo). Sirve además para medir la latencia real desde Chile.
- Copiar esquema (migraciones del repo) + datos (`supabase db dump --data-only`, incluye `auth.users`) + objetos de `logos-proveedores` (script supabase-js) + `update … imagen_url = replace(…)`.
- **Prueba de compatibilidad:** correr la app actual (`pnpm dev` con `.env` de staging) después de cada migración y pasar el checklist de humo (Verificación).

### 1.1 Catálogo de proveedores con identidad (sobre `proveedores_frecuentes`)
- Función `immutable norm_nombre(text)` (minúsculas, sin tildes ni símbolos).
- `proveedores_frecuentes`: `nombre_norm text generated always as (norm_nombre(nombre)) stored` + índice único; `activo boolean default true`.
- `proveedores_turno.proveedor_id uuid null references proveedores_frecuentes(id)` + backfill por `nombre_norm`.
- Trigger BEFORE INSERT/UPDATE en `proveedores_turno`: sin `proveedor_id` (app actual) → busca/crea en catálogo y **canonicaliza el nombre**; con `proveedor_id` (v2) → rellena `nombre`.
- Trigger BEFORE INSERT en `proveedores_frecuentes`: si existe el `nombre_norm`, `return null` (el upsert actual no falla).
- Trigger AFTER UPDATE OF nombre en `proveedores_frecuentes`: propaga a `proveedores_turno` (reemplaza la cascada no transaccional de `src/pages/Proveedores.jsx:102`).
- RPC `fusionar_proveedores(origen, destino)` (solo dueño).

### 1.2 Trabajadores sin cuenta y métodos de pago configurables
- `trabajadores(id, nombre, activo, orden, creado_en)`; `turnos.trabajador_id uuid null`. La app actual lo ignora.
- `metodos_pago(key pk, label, sub, orden, activo, color, logo)` sembrada con los 6 de `METODOS_VENTA` (`src/components/TurnoInput.jsx:16`). `key` = columna de `ventas_turno` (agregar un método requiere columna hasta la Fase 5).

### 1.3 Una sola definición de totales
- `turno_totales(p_turno_id)`: `total_ventas`, `prov_efectivo`, `prov_transferencia`, `total_proveedores`, `neto`, `efectivo_esperado = fondo_inicial + ventas.efectivo − prov_efectivo` (fórmula de `cerrar_turno` en prod).
- Vista `v_turnos` (`security_invoker`): turno + fecha + `es_turno_unico` + trabajador + ventas por método + totales + último cierre (`efectivo_contado`, `diferencia_efectivo`) + `corregido` + `cantidad_cierres`; excluye `deleted_at`.
- Vista `v_resumen_dia`: agregado por fecha; `estado`: `sin_registro` / `borrador` / `parcial` (solo mañana, no único) / `completo` (único o mañana+tarde).
- RPC `resumen_periodo(desde, hasta)`: por día + totales + período anterior + top proveedores (reemplaza `src/pages/Analisis.jsx:168-297`).
- Refactor interno de `cerrar_turno`/`corregir_turno` para usar `turno_totales`; **mismas firmas**.

### 1.4 Guardado transaccional en una llamada
RPC `guardar_turno(p jsonb) returns jsonb`, `security invoker`, una transacción:
- Entrada: `{fecha, modo:'completo'|'mañana'|'tarde', trabajador_id, fondo_inicial, ventas:{key:monto}, proveedores:[{id?, proveedor_id?, nombre?, monto, forma_pago}], cerrar:bool, efectivo_contado?, base_updated_at?}`.
- `modo='completo'` → `tipo='mañana'` + `jornadas.es_turno_unico=true`; `'mañana'|'tarde'` → `es_turno_unico=false`. Rechaza `'tarde'` si el día ya está marcado completo (y viceversa) con un error legible.
- Pasos: asegura jornada → crea/bloquea turno (`for update`) → conflicto si `base_updated_at` difiere (`{conflicto:true, actual}`) → upsert ventas → proveedores por diferencia → si `cerrar`: `cerrar_turno` (borrador) o `corregir_turno` (cerrado; solo dueño) → devuelve fila de `v_turnos`.
- Reemplaza en v2 `asegurarTurno`, `guardarTurno`, `finalizarTurno`, `corregirTurno`, `versionTurno` de `turnoApi.js`.

### 1.5 Tests de base y tipos
- `supabase/tests/*.sql` (pgTAP, `supabase test db`): políticas por rol (dueño/trabajador/anon), `guardar_turno` (crear completo, dividir, cerrar, corregir, conflicto, tarde sobre día completo), triggers de proveedores, `turno_totales` vs. snapshots existentes.
- `supabase gen types typescript` → `v2/src/lib/database.types.ts`.

### 1.6 Pasar a producción
Aplicar 1.1–1.4 en prod (us-east-2) solo con pgTAP verde + checklist de humo de la app actual contra staging OK; repetir el checklist contra prod.

---

## Fase 2 — App v2 (`v2/` en el mismo repo; nuevo proyecto Vercel con *Root Directory* `v2`)

La app actual queda intacta en la raíz y en `planillas-fryt.vercel.app`.

### 2.1 Stack
- Vite + React 19 + **TypeScript estricto**, pnpm.
- **TanStack Router** (search params `fecha`/`modo` validados con zod).
- **TanStack Query v5** + persistencia en IndexedDB (`@tanstack/react-query-persist-client` + `idb-keyval`) → pantallas instantáneas; `refetchOnWindowFocus` en vez de realtime.
- supabase-js tipado; lecturas vía `v_turnos`, `v_resumen_dia`, `resumen_periodo`; escrituras vía `guardar_turno`.
- Tailwind v4 con los tokens "Cálido Editorial" portados de `src/index.css` / `tailwind.config.js` a `@theme`.
- `vite-plugin-pwa` (`registerType: 'prompt'`, aviso "Hay una versión nueva — Actualizar"); íconos de `public/`.
- recharts solo en Análisis. Vitest + Testing Library; Playwright e2e.

### 2.2 Reutilizar (portar a TS)
`src/utils/format.js`, `applyKey`/`Keypad`/`MetodoLogo`/`ProveedorAvatar` (`src/components/TurnoInput.jsx`), `src/utils/csv.js`, `src/components/Icon.jsx`, `DeltaBadge` (`src/pages/Analisis.jsx:35`), diff de `src/components/turno/CorreccionModal.jsx`, `ErrorBoundary` + `errorLog.js` (sigue escribiendo a `logs_error`), logos `public/metodos/*`.

### 2.3 Sesión y roles
- **Móvil del local:** cuenta "Local" rol `trabajador` (edge function `crear-usuario`): ve **Hoy** y **Cerrar turno**; RLS impide editar turnos cerrados.
- **Dueña:** su cuenta; ve todo y corrige. Si prefieren seguir con la sesión de la dueña en el móvil, funciona igual.

### 2.4 Pantallas y flujos
1. **Hoy** — estado del día (`v_resumen_dia`): sin registro / borrador / mañana cerrada, falta tarde / completo; neto, efectivo esperado; alerta de **borradores de cualquier fecha**; botón principal contextual: "Cerrar el día" (default) o "Cerrar turno tarde" si ya hay mañana.
2. **Cerrar turno** (una sola pantalla):
   - Fecha (default hoy, editable) + selector **Día completo · Mañana · Tarde** (default: completo; tarde si ya existe mañana; `dias_turno_unico` fuerza completo).
   - **¿Quién estaba?** chips de `trabajadores`.
   - **Ventas por método** (`metodos_pago` activos; teclado numérico en hoja inferior).
   - **Proveedores** (buscador sobre el catálogo normalizado, orden por frecuencia, alta rápida; efectivo/transferencia).
   - **Caja:** fondo inicial + **efectivo contado integrado** con diferencia en vivo; "No se contó" explícito.
   - Barra fija: total ventas · neto · **Cerrar** → una llamada `guardar_turno({cerrar:true})`.
   - Borrador **en el dispositivo** (IndexedDB por fecha+modo) en cada cambio; borrador en servidor con debounce ~3 s (`cerrar:false`); si falla la red, reintento automático y aviso claro.
3. **Planilla del día** (dueña) — día completo o mañana/tarde lado a lado; celdas editables; guardar = `guardar_turno` (corrección auditada si estaba cerrado); "Dividir en dos turnos" / "Unir como día completo" reemplazan fusionar/desmarcar; badge "Corregido" con diff.
4. **Historial** — infinite query sobre `v_resumen_dia`; filtros: borradores, corregidos, con descuadre, parciales.
5. **Análisis** — `resumen_periodo`; KPIs con la misma fórmula que Hoy; gráfico por día; top proveedores → detalle; CSV.
6. **Proveedores** — catálogo: renombrar, **fusionar duplicados**, logo, activar/desactivar, historial.
7. **Ajustes** — trabajadores, métodos de pago, fondo de caja, días de turno único, hora de corte mañana, papelera, usuarios, registro de errores.

### 2.5 Diseño
- Mantener "Cálido Editorial" (café `#5C3317`, Instrument Serif para cifras, Hanken Grotesk).
- **Contraste ≥ 4,5:1** (oscurecer `muted`/`muted2`), texto mínimo 12 px, objetivos táctiles ≥ 44 px; cero colores fuera de tokens (Toast, Keypad, gráfico); modo oscuro con los mismos tokens.
- Prototipar Cerrar turno y Planilla del día (skill `design`) y validar con la dueña antes de codificar.

---

## Fase 3 — Piloto en paralelo contra la base real

1. Deploy de v2 en Vercel con variables de **producción**.
2. **Semana A — solo lectura:** comparar v2 vs. actual en Hoy, Historial (30 días) y Análisis (7/30): cifras idénticas.
3. **Semana B — registro parcial:** algunos días se cierran en v2 desde el móvil del local; el resto en la actual. Ambas apps deben mostrar todo bien (incluido "día completo" = turno único en la actual).
4. **Semana C — v2 principal;** la actual queda de respaldo.
5. **Salida:** 0 errores nuevos en `logs_error` por v2 · totales coinciden · borradores de días pasados = 0 · la dueña aprueba · tiempo de cierre medido y menor.

---

## Fase 4 — Cambio definitivo y migración a sa-east-1

1. Proyecto productivo en **sa-east-1**; migraciones del repo; edge functions + secretos (`supabase secrets set …` y `vault.create_secret`); crons y trigger vienen en migraciones.
2. Ventana nocturna (tras el cierre): dump de `public` + `auth` desde us-east-2 → restore; copiar logos y reescribir `imagen_url`; verificar conteos por tabla y `sum(total_ventas)` por mes; cambiar variables en Vercel de **v2 y de la app actual** y redeployar.
3. Proyecto antiguo **pausado, no borrado**, 30 días. Rollback: volver a apuntar variables si no hubo escrituras nuevas.

---

## Fase 5 — Contracción (≈1 mes sin usar la app actual)

- Tag `legacy-final`; borrar la app actual de la raíz; mover `v2/` a la raíz (Root Directory en Vercel).
- `turnos.tipo` admite `'completo'`; migrar `mañana + es_turno_unico` → `completo`; `turnos.fecha` directo con índice único parcial; eliminar `jornadas` (mover `dias_turno_unico`/excepciones a configuración).
- Ventas como filas `ventas_turno_metodo(turno_id, metodo_key, monto)`; eliminar columnas fijas.
- `proveedores_turno.nombre` → eliminar; retirar triggers de compatibilidad.
- Quitar publicación realtime y `replica identity full`; políticas basadas en `usuario_id` que ya no aplican; `get_my_rol`.

---

## Notas de plataforma
- Vercel: plan hobby (dos proyectos caben; el plan hobby es para uso no comercial — evaluar Pro si crece).
- Supabase: organización gratuita; el proyecto nuevo en sa-east-1 es $0.

## Archivos críticos
- Fase 0: `supabase/functions/enviar-resumen-turno/index.ts`, `supabase/functions/enviar-resumen-periodico/index.ts`, `supabase/config.toml`, `src/pages/Turno.jsx`, `src/components/ErrorBoundary.jsx`, `.gitignore`.
- Base: migraciones nuevas en `supabase/migrations/` (baseline, hardening, correos, proveedores, trabajadores/métodos, totales, `guardar_turno`); `supabase/tests/*.sql`.
- v2: `v2/` (router, `lib/supabase.ts`, `lib/database.types.ts`, `features/turno`, `features/planilla`, `features/historial`, `features/analisis`, `features/proveedores`, `features/ajustes`).

## Verificación
- **Checklist de humo de la app actual** (staging tras cada migración de Fase 1; prod después): login dueña → Ingresar turno: proveedores (agregar/editar/borrar), ventas, cerrar con y sin conteo → Hoy → Resumen/Historial: editar cerrado ("Corregido"), fusionar/desmarcar turno único → Proveedores: renombrar + logo → Análisis 7/30 + CSV → Papelera.
- **Base:** `supabase test db` verde; `get_advisors` sin advertencias nuevas; `turno_totales` vs. `turno_cierres.total_*` del último cierre = 0 diferencias.
- **Correos:** cerrar un turno en staging → llega "Turno registrado" con ventas al correo de la dueña; invocar `enviar-resumen-periodico` con `{"tipo":"diario"}` → fechas en hora de Chile; sin `x-webhook-secret` → 401; `net._http_response` sin 4xx/5xx.
- **v2:** `vitest` (format, totales, applyKey, reglas de modo/fecha); Playwright móvil 390 px: cerrar día completo, cerrar mañana y luego tarde, recarga a mitad (borrador recuperado), corte de red simulado, conflicto (editar el mismo turno desde la app actual), corrección desde Planilla. Lighthouse PWA/performance.
- **Latencia:** tiempo de "Cerrar" y carga de Hoy en prod (Ohio) vs. staging (São Paulo) con red 4G en DevTools.
- **Piloto y cutover:** criterios de la Fase 3 y verificación de conteos/sumas de la Fase 4.
