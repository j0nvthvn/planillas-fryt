# Estado del proyecto y traspaso (FrytControl)

Documento para quien continúe el trabajo, sea persona o modelo. Resume qué
es el sistema, qué se hizo, en qué punto está cada fase y qué falta, con las
reglas que no se deben romper. Última actualización: **2026-09-17**.

Documentos complementarios:
- `docs/plan-v2.md`: el plan completo por fases (con encabezado de estado).
- `docs/operacion.md`: entornos, CLI, migraciones, correos, seguridad, humo.
- `docs/piloto-v2.md`: cómo se ejecuta el piloto (Fase 3) y sus criterios.
- `docs/limpieza-datos-2026-09.sql`: consultas de limpieza y de comparación.
- `v2/README.md`: la app nueva (stack, estructura, cómo correrla).

## 1. Qué es esto

FrytControl registra el cierre de caja del **Minimarket Fryt** (Chile):
ventas por método de pago, proveedores pagados y conteo de caja, por día,
en dos turnos (mañana/tarde) o como día completo. Lo usa la dueña
(Angélica, cuenta `frytspa@gmail.com`) desde **un único celular del local**
y Jonathan (desarrollador, `jonathan.flores@mail.udp.cl`, también rol dueño).
Hay una cuenta trabajador (`diegoflores@gmail.com`) casi sin uso.

Conviven **dos apps sobre la misma base de datos**:

| App | Carpeta | URL | Estado |
|---|---|---|---|
| Actual (v1) | raíz del repo (`src/`) | https://planillas-fryt.vercel.app | En uso diario por la dueña. Solo recibe arreglos mínimos. |
| Nueva (v2) | `v2/` | https://frytcontrol-v2.vercel.app | Fase 3, piloto, semana A (solo lectura por parte de Jonathan). |

**Regla de oro:** hasta la Fase 5, todo cambio de base de datos es aditivo y
compatible con la app actual. Si la v2 falla, la dueña sigue con la actual
sin notar nada. Cualquier cambio a la app actual se avisa antes al usuario.

## 2. Infraestructura

| Recurso | Identificador | Notas |
|---|---|---|
| Supabase prod | `kfmwhtbvgqurnpotypii` (us-east-2), org `ccfgqstvcbxhllxvuivx` | Base real. Postgres 17. Plan gratis (sin backups automáticos). |
| Supabase staging | `psdhhwcxjcobwxjiemrr` (sa-east-1), misma org | Copia de prod del 2026-09-16 con los mismos ids, esquema completo. Se pausa tras 7 días sin uso; basta reactivarlo. |
| Vercel team | `team_K2vm0PJ0CZxXz4pp3MD3ndxe` (hobby) | |
| Vercel `planillas-fryt` | `prj_j5ZCp5g9YamCQKQy8Bthbzzjt6BZ` | App actual. Rama `main`, Root Directory raíz. |
| Vercel `frytcontrol-v2` | `prj_VR9zMl4lzvSeWZXAwJI9cx7IErlh` | v2. Rama de producción `main`, Root Directory `v2`. Producción → prod; previews (p. ej. rama `v2`) → staging, decidido por `VERCEL_ENV` en `v2/vercel.json`. Las previews piden login de Vercel. |
| GitHub | `j0nvthvn/planillas-fryt` | `main` es la rama de verdad. Un push a `main` despliega **las dos apps**. |
| Resend | cuenta en modo prueba | Los correos no salen a nadie más que al dueño de la cuenta Resend. Pospuesto. |

Credenciales y dónde están (nunca en el repo, salvo anon keys):
- `.env.local` (raíz) y `v2/.env.local`: prod. `v2/.env.production` y `v2/.env.staging` **sí** se versionan (URL + anon key, públicas por diseño; RLS protege los datos).
- `.env.staging.local` y `v2/.env.staging.local`: staging + `STAGING_PASSWORD`, contraseña única de todas las cuentas de staging (las 3 reales + `duena@test.local` / `local@test.local`). Los hashes de prod no se copiaron.
- Supabase CLI: `pnpm exec supabase` ya logueada con la cuenta correcta y linkeada a prod (`supabase migration list` funciona). `db query --linked` sirve para leer.
- Contraseña de la base de prod: no la tenemos; no hizo falta (todo por MCP de Supabase o CLI vía Management API).

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
- **Pendiente:** correos (`20260915000200_correos_seguros.sql` + edge functions reescritas) esperan dominio en Resend y secretos; ver `docs/operacion.md`. Mientras tanto siguen el trigger `notificaciones` y los crons viejos en prod. Activar *leaked password protection* en el dashboard de Auth. Limpieza de datos con la dueña (`docs/limpieza-datos-2026-09.sql`: duplicados de proveedores, días de turno único sin marcar); ahora los duplicados se fusionan desde la v2 → Proveedores.

### Fase 1 — Backend compatible: **hecha** (2026-09-16)
- Migraciones `20260916*` aplicadas en local (pgTAP 62/62, `scripts/test-db.sh`), staging y prod. Verificado: `turno_totales` reproduce los 115 cierres con 0 diferencias; humo de la app actual (`scripts/smoke-legacy.mjs`, 60 comprobaciones) verde en local y staging.
- Incidente ya corregido: el backfill de `proveedor_id` tocó `updated_at`; se restauró desde el respaldo y la migración ahora desactiva esos triggers.

### Fase 2 — App v2: **hecha** (2026-09-16/17)
- `v2/`: Vite 7, React 19, TS estricto, TanStack Router + Query (persistencia IndexedDB), Tailwind v4, PWA. Pantallas: Login, Hoy, Cerrar turno, Planilla del día, Historial, Análisis, Proveedores, Ajustes.
- Diseño decidido con la dueña/Jonathan: identidad café cálida, móvil primero, camino "A" (cifra al frente) + teclado encadenado + planilla en cuaderno. Exploraciones: https://claude.ai/artifact/VibHvxrnP7PXgWvAVUifqa
- Verificación: `pnpm typecheck`, `pnpm test` (27 unitarios), `pnpm build`, y 6 tests de integración contra staging (`src/test/integracion.staging.test.ts`, requiere `SMOKE_PASSWORD`).
- **Pendiente:** Playwright e2e (no había navegador disponible en la sesión); revisar en un celular real de vez en cuando.

### Fase 3 — Piloto en paralelo: **en curso, semana A** (desde 2026-09-16)
- Semana A automática: 0 diferencias en 59 días entre la fórmula de la app actual y `v_resumen_dia`.
- Hallazgos ya corregidos durante la semana A: unir/dividir creaba correcciones; cerrar sesión de un toque; tooltip del gráfico; Proveedores inaccesible en móvil; autoguardado no enviaba ceros ni lo pendiente al salir; campos de Ajustes sin formato; Edenred con total del día (`acumulado_diario`).
- Jonathan cerró desde la v2 cinco borradores antiguos en prod el 2026-09-16 (esperado: eran los turnos olvidados).
- **Siguiente:** semana B (registro parcial desde el móvil del local con la cuenta trabajador o la de la dueña; antes: crear trabajadores en Ajustes) y semana C (v2 principal). Criterios de salida en `docs/piloto-v2.md`.

### Fase 4 — Cambio definitivo y migración a sa-east-1: **no iniciada**
1. Proyecto Supabase nuevo en sa-east-1 (o reutilizar staging si se decide) con las migraciones del repo, edge functions y secretos.
2. Ventana nocturna: copiar datos (`docs/operacion.md` → "Copiar datos de prod a otro proyecto", o `pg_dump` si se consigue la contraseña), logos, `auth.users` (esto requiere la contraseña de la base o crear las cuentas de nuevo), verificar conteos y sumas, cambiar `v2/.env.production` y las variables de la app actual en Vercel, redeploy.
3. Proyecto antiguo pausado 30 días, no borrado.

### Fase 5 — Contracción: **no iniciada**
Tras ≈1 mes sin usar la app actual: tag `legacy-final`, mover `v2/` a la raíz, `turnos.tipo` admite `'completo'`, ventas por filas, quitar triggers de compatibilidad, realtime y `replica identity full`. Detalle en `docs/plan-v2.md`.

## 5. Cómo trabajar en este repo

```sh
# app actual (raíz)
pnpm install && pnpm dev                       # prod (.env.local)  |  pnpm dev --mode staging

# base local (Docker) y tests de migraciones
pnpm exec supabase start -x studio,imgproxy,inbucket,mailpit,logflare,vector,edge-runtime,realtime,storage-api,supavisor,pg_prove
./scripts/test-db.sh                           # reset → seed sucio → migraciones → pgTAP

# v2
cd v2 && pnpm install && pnpm dev --mode staging
pnpm typecheck && pnpm test && pnpm build
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
- Correos: habrá dominio propio, pero se pospuso; no es prioridad.
- Diseño: mantener el café cálido, priorizar el celular, camino A con préstamos de B y C.
