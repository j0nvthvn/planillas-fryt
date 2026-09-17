# Estado del proyecto y traspaso (FrytControl)

Documento para quien continúe el trabajo, sea persona o modelo. Resume qué
es el sistema, qué se hizo, en qué punto está cada fase y qué falta, con las
reglas que no se deben romper. Última actualización: **2026-09-17**.

Documentos complementarios:
- `docs/plan-v2.md`: el plan completo por fases (con encabezado de estado).
- `docs/operacion.md`: entornos, CLI, migraciones, correos, seguridad, humo.
- `docs/piloto-v2.md`: cómo se ejecutó el piloto (Fase 3) y sus criterios.
- `docs/cambio-fase4.md`: guion de la noche del cambio (Fase 4).
- `docs/limpieza-datos-2026-09.sql`: consultas de limpieza y de comparación.
- `docs/mejoras-ux.md`: mejoras de UI/UX de la v2 (tipografía, accesibilidad, flujo y la revisión móvil con capturas del 2026-09-16): qué se aplicó y qué quedó pendiente.
- `v2/README.md`: la app nueva (stack, estructura, cómo correrla).

## 1. Qué es esto

FrytControl registra el cierre de caja del **Minimarket Fryt** (Chile):
ventas por método de pago, proveedores pagados y conteo de caja, por día,
en dos turnos (mañana/tarde) o como día completo. Lo usa la dueña
(Angélica, cuenta `frytspa@gmail.com`) desde **un único celular del local**
y Jonathan (desarrollador, `jonathan.flores@mail.udp.cl`, también rol dueño).
Hay una cuenta trabajador (`diegoflores@gmail.com`) casi sin uso.

Desde el **2026-09-17** la única app en uso es la v2, en
**https://app.frytspa.cl**, sobre la base de sa-east-1. La app actual quedó
retirada: su dirección redirige a la nueva.

| App | Carpeta | URL | Estado |
|---|---|---|---|
| Antigua (v1) | raíz del repo (`src/`) | https://planillas-fryt.vercel.app | **Retirada** (2026-09-17): redirige con 308 a app.frytspa.cl. El código se borra en la Fase 5. |
| Nueva (v2) | `v2/` | https://app.frytspa.cl (también frytcontrol-v2.vercel.app) | **Principal** desde el 2026-09-17. |

**Regla de oro:** hasta la Fase 5, todo cambio de base de datos sigue siendo
aditivo, para poder volver atrás (ver `docs/cambio-fase4.md` → "Volver
atrás"). Un push a `main` despliega producción: se avisa antes.

## 2. Infraestructura

| Recurso | Identificador | Notas |
|---|---|---|
| Supabase prod | `aecopggpahxjaglakqwd` (`frytcontrol`, sa-east-1), org `ccfgqstvcbxhllxvuivx` | Base real desde el 2026-09-17. Postgres 17. Plan gratis (sin copias de Supabase: las hace `.github/workflows/respaldo.yml`, ver `docs/operacion.md` → "Respaldos y restauración"). |
| Supabase prod anterior | `kfmwhtbvgqurnpotypii` (us-east-2) | **Pausado** el 2026-09-17 con los datos a esa fecha. No borrar antes del 2026-10-17. El plan gratis admite 2 proyectos activos: prod y staging. |
| Supabase staging | `psdhhwcxjcobwxjiemrr` (sa-east-1), misma org | Copia de prod del 2026-09-16 con los mismos ids, esquema completo. Se pausa tras 7 días sin uso; basta reactivarlo. |
| Vercel team | `team_K2vm0PJ0CZxXz4pp3MD3ndxe` (hobby) | |
| Vercel `planillas-fryt` | `prj_j5ZCp5g9YamCQKQy8Bthbzzjt6BZ` | App actual. Rama `main`, Root Directory raíz. |
| Vercel `frytcontrol-v2` | `prj_VR9zMl4lzvSeWZXAwJI9cx7IErlh` | v2. Rama de producción `main`, Root Directory `v2`. Producción → prod; previews (p. ej. rama `v2`) → staging, decidido por `VERCEL_ENV` en `v2/vercel.json`. Las previews piden login de Vercel. |
| GitHub | `j0nvthvn/planillas-fryt` | `main` es la rama de verdad. Un push a `main` despliega **las dos apps**. |
| Dominio | `frytspa.cl` (DNS en Cloudflare) | `app` → Vercel (DNS only). Registros de Resend en `send`, `resend._domainkey` y `_dmarc`. |
| Resend | dominio `frytspa.cl` verificado | Correos activos desde `avisos@frytspa.cl` (cierre de turno, resumen diario y semanal). Ver `docs/operacion.md` → "Correos". |

Credenciales y dónde están (nunca en el repo, salvo anon keys):
- `.env.local` (raíz) y `v2/.env.local`: prod. `v2/.env.production` y `v2/.env.staging` **sí** se versionan (URL + anon key, públicas por diseño; RLS protege los datos).
- `.env.staging.local` y `v2/.env.staging.local`: staging + `STAGING_PASSWORD`, contraseña única de todas las cuentas de staging (las 3 reales + `duena@test.local` / `local@test.local`). Los hashes de prod no se copiaron.
- Supabase CLI: `pnpm exec supabase` logueada con la cuenta correcta. Al 2026-09-17 sigue **linkeada al prod anterior (pausado)**: usar `--project-ref aecopggpahxjaglakqwd` o `supabase link` de nuevo.
- `~/.config/frytcontrol/migracion.env` (fuera del repo, 600): cadenas del session pooler de ambas bases y la API key de Resend. El usuario tiene las contraseñas. El secreto `SUPABASE_DB_URL` de GitHub apunta a la base nueva.

## 3. Modelo de datos (lo esencial)

- `jornadas(fecha, es_turno_unico)` → `turnos(tipo 'mañana'|'tarde', is_draft, fondo_inicial, deleted_at, trabajador_id)` → `ventas_turno` (una fila por turno, una columna por método) y `proveedores_turno(nombre, proveedor_id, monto, forma_pago)`.
- **"Día completo" (v2) = `tipo='mañana'` + `jornadas.es_turno_unico=true`.** Así la app actual lo muestra como "Turno único".
- `turno_cierres`: fotografía inmutable de cada cierre y corrección (`es_correccion`), con `efectivo_esperado/contado/diferencia`. Se escribe solo vía `cerrar_turno` / `corregir_turno` (security definer).
- Catálogo `proveedores_frecuentes` con `nombre_norm` único (sin tildes/mayúsculas/símbolos, función `norm_nombre`) y `activo`; `proveedores_turno.proveedor_id` lo enlaza. Triggers mantienen compatibilidad con la app actual, que escribe solo `nombre`. `fusionar_proveedores(origen, destino)` para duplicados.
- `trabajadores` (lista sin cuentas) y `metodos_pago` (los 6 métodos como datos; `acumulado_diario` = la máquina entrega el total del día, hoy Edenred).
- Una sola definición de totales: `turno_totales(id)`, vistas `v_turnos` y `v_resumen_dia`, RPC `resumen_periodo(desde, hasta)`. `neto = ventas − proveedores`, `efectivo_esperado = fondo + ventas.efectivo − proveedores en efectivo`.
- **`guardar_turno(jsonb)`**: una llamada, una transacción: asegura jornada, aplica modo, upsert de ventas, proveedores por diferencia, cierre o corrección, control de concurrencia por `base_updated_at` (devuelve `{conflicto:true, actual}`). Sin claves `ventas`/`proveedores` en el JSON solo cambia el modo (así "unir/dividir" no crea correcciones).
- RLS: todo `to authenticated`; el trabajador solo escribe en sus borradores; la dueña en todo. Grants explícitos para proyectos nuevos (`20260915000010_grants_api.sql`).

## 4. Fases: hecho y pendiente

### Fase 0 — Estabilizar la app actual: **hecha** (2026-09-16)
- Repo limpio (sin `.env.local`, `dist/`, `.temp/`), migraciones baseline + grants + hardening aplicadas en prod.
- Frontend actual: aviso sin conexión y recarga automática ante chunk viejo, desplegado.
- **Correos: hechos** (2026-09-17) en el proyecto nuevo, con dominio propio. Lo que sigue de esta línea es historia: `docs/operacion.md`. Mientras tanto siguen el trigger `notificaciones` y los crons viejos en prod. Activar *leaked password protection* en el dashboard de Auth. Limpieza de datos con la dueña (`docs/limpieza-datos-2026-09.sql`: duplicados de proveedores, días de turno único sin marcar); ahora los duplicados se fusionan desde la v2 → Proveedores.

### Fase 1 — Backend compatible: **hecha** (2026-09-16)
- Migraciones `20260916*` aplicadas en local (pgTAP 62/62, `scripts/test-db.sh`), staging y prod. Verificado: `turno_totales` reproduce los 115 cierres con 0 diferencias; humo de la app actual (`scripts/smoke-legacy.mjs`, 60 comprobaciones) verde en local y staging.
- Incidente ya corregido: el backfill de `proveedor_id` tocó `updated_at`; se restauró desde el respaldo y la migración ahora desactiva esos triggers.

### Fase 2 — App v2: **hecha** (2026-09-16/17; ajustes móviles 2026-09-16)
- `v2/`: Vite 7, React 19, TS estricto, TanStack Router + Query (persistencia IndexedDB), Tailwind v4, PWA. Pantallas: Login, Hoy, Cerrar turno, Planilla del día, Historial, Análisis, Proveedores, Ajustes.
- Diseño inicial decidido con la dueña/Jonathan: identidad café cálida (reemplazada por el rediseño Fintech, ver abajo), móvil primero, camino "A" (cifra al frente) + teclado encadenado + planilla en cuaderno. Exploraciones: https://claude.ai/artifact/VibHvxrnP7PXgWvAVUifqa
- Verificación: `pnpm lint`, `pnpm typecheck`, `pnpm test` (81 unitarios), `pnpm build`, `pnpm e2e` (Playwright contra staging) y 6 tests de integración contra staging (`src/test/integracion.staging.test.ts`, requiere `SMOKE_PASSWORD`).
- **Mejoras del 2026-09-17** (detalle y pendientes en `docs/mejoras-ux.md`): hoja de revisión antes de cerrar y conteo de caja por billetes —las dos atacan lo medido en prod: 25 % de cierres son correcciones y no hay ningún conteo registrado—, aviso de proveedor parecido, base accesible (foco visible, `prefers-reduced-motion`, hojas como `<dialog>`, nada bajo 12 px, contrastes), escala tipográfica en tokens y fuentes alojadas en el repo.
- **Exportación** (detalle en `docs/mejoras-ux.md`): Análisis → Exportar ofrece un Excel con varias hojas, un CSV por turno (igual al de la app actual), un CSV de compras a proveedores y un reporte imprimible o PDF (`/analisis/reporte`). En el celular el archivo se comparte. Corrige el CSV por día anterior, que duplicaba el fondo en "Efectivo esperado" y omitía métodos inactivos.
- **Ingeniería:** ESLint (flat config con reglas de tipos), GitHub Actions (`.github/workflows/v2.yml`: lint + tipos + tests + build en cada push/PR) y Playwright (`v2/e2e/`, el cierre completo y la exportación contra staging; requiere `pnpm exec playwright install chromium`).
- **Ajustes móviles** (commit `33f27f4`, en producción; detalle en `docs/mejoras-ux.md` → "Móvil"): revisión con capturas de Playwright en Pixel 7 (claro/oscuro) e iPhone SE contra staging. Fechas sin "De" en mayúscula (`mayusculaInicial`) y negativos como "−$404.199" en `clp`; `BottomSheet` con `footer` fijo (teclado, conteo y revisión siempre a la vista); sin botón flotante en Cerrar turno; Historial agrupado por mes con filas que caben en 375 px; Análisis con fechas a todo lo ancho y rango siempre válido (`ajustarRango`); Ajustes apilado; esqueletos de carga (`Esqueleto.tsx`) en vez de spinner; login con "Ingresando…" y `?volver=`; color de los métodos aclarado en oscuro (`colorMetodo` + `--metodo-mezcla`). Cierra los tres pendientes que tenía `mejoras-ux.md`.
- **Selección de texto bloqueada** en toda la interfaz, sin el menú de copiar al mantener presionado (`styles.css`, capa base). Solo los campos de texto se seleccionan. Reemplaza la utilidad `no-select`: antes se podían copiar montos para WhatsApp, y ahora para eso está Compartir.
- **Rediseño Fintech** (rama `rediseno-fintech`; handoff en `docs/design_handoff_rediseno_fintech/`; detalle en `docs/mejoras-ux.md` → "Rediseño Fintech"): se reemplaza la piel café por gris/blanco/indigo, Inter + Inter Tight (solo subconjunto latino) y cifras tabulares. Sin cambios de flujo, rutas, consultas ni textos de dominio. Revisado con capturas en Pixel 7 (claro/oscuro), iPhone SE y escritorio contra staging; `pnpm e2e` sin cambios de selectores.
- **Auditoría de accesibilidad y UI** (misma rama, 2026-09-17; detalle en `docs/auditoria-ui.md`):
  - Contraste AA en tokens (`muted`, `muted2` y `neg` más oscuros).
  - Áreas táctiles de 44 px.
  - Radios con flechas.
  - Regiones vivas y foco al navegar.
  - Utilitarios compartidos.
  - axe en `v2/e2e/a11y.spec.ts`: 0 violaciones (antes, 15).
  - Migración `20260919000000_colores_metodos_fintech.sql` aplicada en staging y en prod (2026-09-17, vía MCP, versión registrada con el nombre del archivo).
- **Pendiente:** revisar en un celular real (Safari de iOS con su barra inferior): altura de las hojas y encabezado pegajoso del Historial.

### Fase 3 — Piloto en paralelo: **hecha** (2026-09-16/17; semanas B y C abreviadas a pedido del usuario)
- Semana A automática: 0 diferencias en 59 días entre la fórmula de la app actual y `v_resumen_dia`.
- Hallazgos ya corregidos durante la semana A: unir/dividir creaba correcciones; cerrar sesión de un toque; tooltip del gráfico; Proveedores inaccesible en móvil; autoguardado no enviaba ceros ni lo pendiente al salir; campos de Ajustes sin formato; Edenred con total del día (`acumulado_diario`).
- Estado de prod al 2026-09-17: 0 errores `v2:` en `logs_error`, 1 borrador (el del día), ningún borrador de días pasados. 33 de 134 cierres son correcciones (25 %) y no hay un solo conteo de caja en toda la historia: de ahí las dos mejoras de flujo de la Fase 2.
- Jonathan cerró desde la v2 cinco borradores antiguos en prod el 2026-09-16 (esperado: eran los turnos olvidados).
- Semana B lista y revisión en un celular real hecha (2026-09-17). El usuario decidió pasar directo a la Fase 4.

### Integridad y respaldos: **hecho** (2026-09-16/18)
- Migración `20260918000000_integridad.sql`: tabla `auditoria` (cambios reales y borrados de las tablas de negocio), `turno_cierres` inmutable (solo se borra en cascada con su turno, y queda en `auditoria`), sin `TRUNCATE` para los roles de la API, CHECKs de `fondo_inicial` y `efectivo_contado`, y `verificar_integridad()`. pgTAP 90/90 y humo de la app actual en verde en local y staging.
- `.github/workflows/respaldo.yml` + `scripts/respaldo/`: `pg_dump` diario cifrado con age a Google Drive, control de integridad y simulacro de restauración semanal (probado en local, y detecta un manifiesto alterado). **Activo desde el 2026-09-16**: primera copia en Drive y simulacro con conteos idénticos a prod. Incidente: un simulacro imprimió el token de rclone en el log público (variable `RCLONE_CONFIG`); se borró la ejecución, se revocó el token y se renombró la variable.
- Aplicada en **staging** y en **prod** el 2026-09-16 (15:15 Chile, con respaldo JSON previo en el scratchpad de la sesión: `prod-backup-2026-09-18/`), versión registrada con el nombre del archivo, tipos de la v2 regenerados. Conteos iguales al respaldo; advisors solo con lo esperado.
- Hallazgo en prod (error de `verificar_integridad()`): el 2026-06-17 está marcado como día completo y tiene un turno de tarde sin ventas pero con 2 proveedores ($207.405), sin cierres. **Resuelto el 2026-09-16:** los 2 pagos pasaron a la mañana y la tarde vacía quedó en la papelera (queda en `auditoria`); totales del día sin cambio.

### Fase 4 — Cambio definitivo y migración a sa-east-1: **hecha** (2026-09-17, 03:40–04:00 Chile)
- Proyecto `frytcontrol` (`aecopggpahxjaglakqwd`) con las migraciones del repo (todas alineadas en `schema_migrations`), las 3 edge functions, secretos, Vault y crons de correo. Correos probados antes del cambio (llegaron) y 401 sin secreto.
- Datos copiados con `scripts/migrar-region.sh` (dos ensayos y la corrida final): manifiesto, `auditoria` y `verificar_integridad()` iguales; 31 logos; `auth.users` con sus contraseñas. La v2 revisada contra la copia: cifras idénticas a prod.
- `main` en `778a48e`: `v2/.env.production` → proyecto nuevo, `vercel.json` de la raíz redirige a `app.frytspa.cl` y `respaldo.yml` usa la URL nueva. Respaldo manual en verde contra la base nueva.
- Prod anterior pausado (sus crons y trigger viejos quedaron intactos, no corren; definiciones en `~/.config/frytcontrol/prod-viejo-correos.json`). Staging reactivado.
- **Pendiente:** confirmar el primer día (entrada de la dueña en `app.frytspa.cl`, correo del primer cierre, resumen diario de las 12:00 UTC, `logs_error`). Reinstalar la PWA desde la dirección nueva en el celular del local. Re-linkear la CLI al proyecto nuevo.

### Fase 5 — Contracción: **no iniciada**
Decidido: empezar tras ≈1 semana estable con la v2 (la app antigua ya está retirada), es decir, desde el 2026-09-24: tag `legacy-final`, mover `v2/` a la raíz, `turnos.tipo` admite `'completo'`, ventas por filas, quitar triggers de compatibilidad, realtime y `replica identity full`. Detalle en `docs/plan-v2.md`.

## 5. Cómo trabajar en este repo

```sh
# app actual (raíz)
pnpm install && pnpm dev                       # prod (.env.local)  |  pnpm dev --mode staging

# base local (Docker) y tests de migraciones
pnpm exec supabase start -x studio,imgproxy,inbucket,mailpit,logflare,vector,edge-runtime,realtime,storage-api,supavisor,pg_prove
./scripts/test-db.sh                           # reset → seed sucio → migraciones → pgTAP

# v2
cd v2 && pnpm install && pnpm dev --mode staging
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm e2e                                       # Playwright contra staging (usa STAGING_PASSWORD)
# mirar la interfaz: pnpm dev --mode staging --port 5174 y un script de Playwright
# (devices Pixel 7 / iPhone SE) que importe v2/node_modules/@playwright/test por ruta absoluta
SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=<.env.staging.local> pnpm vitest run --mode staging src/test/integracion.staging.test.ts
```

- Migraciones nuevas: archivo en `supabase/migrations/` (idempotente), probar con `scripts/test-db.sh`, aplicar en staging y luego en prod (MCP `apply_migration` o `supabase db push` con la CLI linkeada), y registrar la versión en `supabase_migrations.schema_migrations` con el nombre del archivo si se aplicó por MCP. Regenerar tipos: `pnpm exec supabase gen types typescript --linked --schema public > v2/src/lib/database.types.ts`.
- Nunca correr `scripts/smoke-legacy.mjs` contra prod (escribe datos; el script lo rechaza). Contra staging está bien: limpia lo que crea.
- Commits en español con prefijo tipo (`feat(v2):`, `fix(db):`), firmados con `Co-Authored-By` del modelo. Push a `main` solo cuando la app actual pueda recibir lo que lleva.
- Antes de tocar prod: exportar las tablas (JSON vía MCP o `supabase db query --linked`) como respaldo; el plan gratis no tiene backups.

## 6. Avisos y trampas conocidas

- El clasificador de permisos de Claude Code bloqueó: leer `auth.users` de prod (hashes), escribir en prod desde la CLI, y bajar la protección de previews en Vercel. No intentar rodearlo: pedirle al usuario.
- Los resultados grandes del MCP de Supabase se guardan en archivos `tool-results/*.txt`; se pueden procesar con scripts sin pasarlos por el contexto.
- Tailwind v4: las clases propias (`btn`, `card`, `input`) están como `@utility` porque `@apply` no acepta clases de `@layer components`.
- PWA: sin `modulepreload` (choca con el service worker). Tras cada deploy, la app avisa "Hay una versión nueva".
- `proveedores_frecuentes`: al sanear quedó "Rio Maipo" (sin tilde) por ser la grafía más usada; la dueña puede renombrarlo desde la v2.
- 93 turnos cerrados antes de julio de 2026 no tienen fila en `turno_cierres` (se cerraron por migración antes de que existiera la auditoría).
- `docs/superpowers/` no es parte de este trabajo; no tocarlo sin preguntar.

## 7. Decisiones tomadas por el usuario (no volver a preguntar)

- Trabajadores sin cuenta: se elige el nombre de una lista al cerrar.
- Modelo "día completo o dividido" (no mañana/tarde obligatorio).
- Desarrollo contra staging, piloto con ambas apps contra la base real, migración a sa-east-1 solo en el cambio definitivo.
- Conexión del local estable: borrador local + reintento, sin offline-first.
- Correos: con dominio propio (`frytspa.cl`), activos desde el 2026-09-17.
- Diseño: rediseño Fintech (gris/blanco/indigo, Inter) acordado con la dueña el 2026-09-16, reemplaza al café cálido; priorizar el celular, camino A con préstamos de B y C.
- Fase 4 adelantada (2026-09-17): la app va en `app.frytspa.cl`, la migración se hace con `pg_dump` conservando las contraseñas y la app antigua se retira al migrar (redirige; no se reconfigura contra la base nueva).
