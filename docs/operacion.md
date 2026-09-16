# Operación de FrytControl

Guía de los pasos que **no** viven en el código: secretos, entornos y
cómo aplicar migraciones. El plan completo de la renovación está en
`docs/plan-v2.md`.

## Entornos

| Entorno | Proyecto Supabase | Región | Uso |
|---|---|---|---|
| Producción | `kfmwhtbvgqurnpotypii` (`planillas-fryt`) | us-east-2 | La app actual (`planillas-fryt.vercel.app`) |
| Staging | `psdhhwcxjcobwxjiemrr` (`planillas-fryt-staging`) | sa-east-1 | Desarrollo de la v2 con copia de datos (creado 2026-09-16) |

Staging tiene el esquema completo (Fase 0 + Fase 1), una copia de los datos
de prod al 2026-09-16 (mismos ids), los logos y estas cuentas:

- Las 3 cuentas reales (`usuarios`) con los mismos ids que prod, y
  `duena@test.local` (dueño) / `local@test.local` (trabajador) para scripts.
- Todas con la contraseña de staging que está en `.env.staging.local`
  (`STAGING_PASSWORD`). Los hashes de prod **no** se copiaron.
- Correos: sin secretos en Vault → `invocar_edge_function` solo deja un
  WARNING; no sale ningún correo desde staging.

Para correr la app actual contra staging: `pnpm dev --mode staging`
(Vite lee `.env.staging.local`).

### App v2 en Vercel

| Proyecto Vercel | Root Directory | Rama | URL | Apunta a |
|---|---|---|---|---|
| `planillas-fryt` | raíz | `main` | planillas-fryt.vercel.app | prod (app actual) |
| `frytcontrol-v2` (`prj_VR9zMl4lzvSeWZXAwJI9cx7IErlh`) | `v2` | `main` | frytcontrol-v2.vercel.app | **prod** (`v2/.env.production`) |
| `frytcontrol-v2` previews | `v2` | cualquier otra rama (p. ej. `v2`) | frytcontrol-v2-git-<rama>-… (requiere login en Vercel) | staging (`v2/.env.staging`) |

El entorno lo decide `VERCEL_ENV` en el `buildCommand` de `v2/vercel.json`:
producción → `--mode production`, preview → `--mode staging`. No hay
variables en el dashboard. Un push a `main` despliega las dos apps
(`planillas-fryt` y `frytcontrol-v2`), así que `main` se pushea solo
cuando la app actual puede recibir lo que lleva.

> La cuenta de la CLI (`supabase login`) es distinta de la organización que
> tiene prod y staging (`ccfgqstvcbxhllxvuivx`), así que `link`/`db push`
> no aplican por ahora. Las migraciones se aplicaron con el MCP de
> Supabase, por lotes, y `supabase_migrations.schema_migrations` se dejó
> con las versiones de los archivos del repo. Cuando la CLI tenga acceso
> a esa organización, `supabase migration list` debe salir alineado.

Variables del frontend (Vercel → Settings → Environment Variables, y
`.env.local` local — **nunca** se versiona):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## CLI de Supabase

La CLI viene como devDependency: `pnpm exec supabase …`.

```sh
pnpm exec supabase login            # una vez por máquina (abre el navegador)
pnpm exec supabase link --project-ref kfmwhtbvgqurnpotypii
pnpm exec supabase migration list   # compara repo vs. proyecto
pnpm exec supabase db push          # aplica migraciones pendientes
pnpm exec supabase functions deploy # despliega las 3 edge functions
```

### Estado de producción (2026-09-16)

Fase 0 (baseline, grants, hardening) y Fase 1 (catálogo de proveedores,
trabajadores/métodos, totales/vistas, `guardar_turno`) **aplicadas en
prod** el 2026-09-16 a las 23:10 (Chile), vía MCP, después del cierre
del día. Verificado: conteos y sumas iguales al respaldo previo,
`turno_totales` vs. cierres = 0 diferencias, 0 filas sin `proveedor_id`,
advisors solo con lo esperado. El saneo eliminó del catálogo "Pf" y
"Río Maipo" (sobrevivió "Rio Maipo", la grafía más usada).

`supabase_migrations.schema_migrations` quedó con las versiones de los
archivos del repo; `supabase migration list` solo muestra pendiente
`20260915000200_correos_seguros` (pospuesta hasta tener Resend).
`20260917000000_metodos_acumulado_diario` (columna en `metodos_pago`, solo
la usa la v2) se aplicó en staging y prod el 2026-09-17. El
trigger `notificaciones` y los crons `Diario`/`semanal` viejos siguen en
prod hasta aplicarla.
`20260918000000_integridad` (auditoría, cierres inmutables,
`verificar_integridad()`) se aplicó en staging y prod el 2026-09-16.

Respaldo previo (JSON por tabla) en el scratchpad de la sesión:
`prod-backup-2026-09-16/`. Sirve para revertir el saneo de nombres.

Efecto secundario detectado y corregido: el backfill de `proveedor_id`
disparó los triggers de `updated_at` (125 turnos y 585 filas de
proveedores). Ambos se restauraron desde el respaldo la misma noche;
`turnos.updated_at` máximo volvió a ser el del último cierre. La
migración ya desactiva esos triggers durante el backfill para entornos
futuros.

## Pruebas de la base en local (Docker)

```sh
pnpm exec supabase start -x studio,imgproxy,inbucket,mailpit,logflare,vector,edge-runtime,realtime,storage-api,supavisor,pg_prove
./scripts/test-db.sh
```

El script resetea la base local hasta la Fase 0, carga
`supabase/tests/seed_test.sql` (datos con los mismos problemas que
prod: proveedores duplicados, día completo, borrador, corrección),
aplica las migraciones de la Fase 1 encima y corre los tests pgTAP de
`supabase/tests/*.test.sql`. Para probar la app actual contra esa base:

```sh
# Checklist de humo automatizado (las mismas consultas/escrituras que
# hacen las pantallas de la app actual; nunca contra producción). Usa una
# fecha aleatoria de 2027 y nombres de proveedor únicos, y limpia al final,
# así se puede correr también contra staging sin tocar los datos copiados:
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<ANON_KEY que imprime supabase start> \
SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=password123 node scripts/smoke-legacy.mjs

# O a mano en el navegador:
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<ANON_KEY> pnpm dev
# usuarios: duena@test.local / local@test.local, clave password123
```

Nota: en producción, 93 turnos cerrados antes de julio de 2026 no tienen
fila en `turno_cierres` (se marcaron cerrados por migración, antes de que
existiera la auditoría). En `v_turnos` aparecen con `cantidad_cierres = 0`.
Sobre los 81 turnos que sí tienen cierre, `turno_totales` reproduce
exactamente los totales guardados (verificado el 2026-09-15).

### Copiar datos de prod a otro proyecto (sin contraseña de la base)

Así se pobló staging; sirve igual para el proyecto definitivo de la Fase 4
si no se quiere usar `pg_dump`:

1. Aplicar migraciones hasta la Fase 0 (`20260915000200`) en el destino.
2. Exportar cada tabla de prod como JSON (`select json_agg(t) from tabla t`)
   en orden de FKs: usuarios, configuracion, proveedores_frecuentes,
   jornadas, turnos, ventas_turno, proveedores_turno, turno_cierres
   (ordenado por `cerrado_en`, por la FK a sí misma), logs_error.
3. Crear en el destino los `auth.users` con los mismos ids (ver
   `supabase/tests/seed_test.sql` para el formato) y una RPC temporal
   `security definer` que haga `insert … select * from
   jsonb_populate_recordset(null::tabla, $1)` con los triggers
   `touch_turno_*` y `notificar_cierre` deshabilitados durante la carga
   (para no pisar `updated_at` ni encolar correos). Eliminarla al terminar.
4. Verificar conteos y sumas (`sum(total_ventas)` de cierres,
   `sum(efectivo)` de ventas, `sum(monto)` de proveedores) contra prod.
5. Aplicar la Fase 1 encima (así el saneo de proveedores corre igual que
   correrá en prod) y comprobar `turno_totales` vs. cierres = 0 diferencias.
6. Logos: descargar del bucket público de prod y subir con
   `scripts/copiar-logos.mjs`; luego `update proveedores_frecuentes set
   imagen_url = replace(imagen_url, '<url prod>', '<url destino>')`.

## Respaldos y restauración

El plan gratis de Supabase no hace copias. Las hace
`.github/workflows/respaldo.yml`:

| Qué | Cuándo | Resultado |
|---|---|---|
| Respaldo | diario, 03:00 Chile | `frytcontrol-AAAA-MM-DD.tar.age` en Drive, carpeta `frytcontrol-respaldos` |
| Control de integridad | tras cada respaldo | falla el job si `verificar_integridad()` devuelve filas |
| Simulacro | domingos | restaura la última copia en una base local del runner y compara |

Cada `.tar.age` (cifrado con [age](https://age-encryption.org)) contiene
`respaldo.dump` (`pg_dump -Fc` de `public`, `auth` y `storage`),
`manifiesto.json` (filas por tabla y sumas de dinero) y `logos/`.
Retención: 30 días, más la copia del día 1 de cada mes por ~13 meses.
Si un job falla, GitHub manda un correo a quien tenga el repo.

Ambos se pueden lanzar a mano: Actions → respaldo → Run workflow, o
`gh workflow run respaldo.yml -f tarea=respaldo` (o `simulacro`).

### Puesta en marcha (una vez)

1. Contraseña de la base: Dashboard de prod → Settings → Database →
   *Reset database password*. Las apps no la usan (usan las API keys),
   así que cambiarla no afecta nada. Guardarla en el gestor de claves.
2. Cadena de conexión: Dashboard → Connect → *Session pooler* (IPv4; los
   runners de GitHub no tienen IPv6):
   `postgresql://postgres.kfmwhtbvgqurnpotypii:<clave>@aws-0-us-east-2.pooler.supabase.com:5432/postgres`
   (copiar la que muestra el dashboard).
3. Claves de cifrado: `age-keygen -o frytcontrol-respaldo.key`. La línea
   `# public key: age1…` es la pública. **El archivo es la única forma de
   abrir las copias**: guardarlo en el gestor de claves y en un segundo
   lugar fuera de este computador.
4. Drive: `rclone config` → *n* → nombre `drive` → tipo `drive` → sin
   client id propio → scope `drive.file` → autorizar en el navegador con
   la cuenta de Google que guardará las copias. Luego
   `rclone mkdir drive:frytcontrol-respaldos`.
5. Secretos del repo:

```sh
gh secret set SUPABASE_DB_URL                                 # pega la cadena del paso 2
gh secret set AGE_RECIPIENT --body 'age1…'
gh secret set AGE_IDENTITY < frytcontrol-respaldo.key          # solo lo usa el simulacro
gh secret set RCLONE_CONFIG < ~/.config/rclone/rclone.conf
```

6. `gh workflow run respaldo.yml -f tarea=respaldo`, y cuando termine
   `gh workflow run respaldo.yml -f tarea=simulacro`.

Si no se quiere la clave privada en GitHub, no crear `AGE_IDENTITY`: el
simulacro fallará cada domingo, así que en ese caso quitar su `cron` y
hacerlo a mano una vez al mes (abajo).

### Abrir una copia y probarla en local

```sh
rclone copy drive:frytcontrol-respaldos/frytcontrol-2026-09-20.tar.age .
mkdir respaldo && age -d -i frytcontrol-respaldo.key frytcontrol-2026-09-20.tar.age | tar -C respaldo -xf -
pnpm exec supabase start -x studio,imgproxy,inbucket,mailpit,logflare,vector,edge-runtime,realtime,storage-api,supavisor,pg_prove
./scripts/respaldo/restaurar-prueba.sh respaldo    # borra la base local
```

`restaurar-prueba.sh` aplica las migraciones del repo, carga los datos de
`public` y `auth.users`/`auth.identities`, compara con el manifiesto y
corre `verificar_integridad()`. Con eso también se comprueba que el
esquema del repo sigue reproduciendo prod.

### Restauración real

- **Recuperar unas filas** (algo borrado o pisado): restaurar la copia
  en local como arriba, buscar las filas y reinsertarlas en prod con
  SQL. Para cambios posteriores a la última copia, usar `auditoria`
  (siguiente sección).
- **Perder el proyecto completo:** proyecto nuevo → aplicar
  `supabase/migrations` → `pg_restore --data-only --disable-triggers`
  como en `restaurar-prueba.sh` (con la cadena del proyecto nuevo y
  su rol `postgres`; si `--disable-triggers` falla por permisos, cargar
  por tablas en orden de FKs como en "Copiar datos de prod a otro
  proyecto") → subir `logos/` con `scripts/copiar-logos.mjs` → cambiar
  URL y anon key en Vercel (las dos apps) y en `v2/.env.production`. Las
  contraseñas de `auth.users` viajan en el dump, así que las cuentas
  siguen funcionando.

## Auditoría

`public.auditoria` guarda cada cambio real (y cada borrado) en
`jornadas`, `turnos`, `ventas_turno`, `proveedores_turno`,
`turno_cierres` (solo borrados), `proveedores_frecuentes`,
`trabajadores`, `metodos_pago` y `configuracion`: fila `antes`,
`despues`, `usuario_id` y `en`. Las reescrituras sin cambios del
autoguardado de la app actual no se registran. Solo la dueña puede
leerla; nadie puede escribir en ella directamente.

`turno_cierres` no se puede modificar y solo se borra en cascada con su
turno. Para un arreglo manual excepcional (como `postgres`):
`set local frytcontrol.permitir_cambiar_cierres = 'on';` dentro de la
transacción.

```sql
-- Qué se borró en los últimos 7 días
select en, tabla, registro, usuario_id from auditoria
where operacion = 'DELETE' and en > now() - interval '7 days' order by en;

-- Historia de las ventas de un turno
select en, antes->>'efectivo' as antes, despues->>'efectivo' as despues
from auditoria where tabla = 'ventas_turno' and coalesce(despues, antes)->>'turno_id' = '<turno_id>'
order by en;

-- Reconstruir un turno borrado definitivamente (revisar antes de correr)
insert into turnos select * from jsonb_populate_record(null::turnos,
  (select antes from auditoria where tabla = 'turnos' and operacion = 'DELETE' and registro = '<turno_id>'));
insert into ventas_turno select * from jsonb_populate_record(null::ventas_turno,
  (select antes from auditoria where tabla = 'ventas_turno' and operacion = 'DELETE' and antes->>'turno_id' = '<turno_id>'));
insert into proveedores_turno select (jsonb_populate_record(null::proveedores_turno, antes)).*
  from auditoria where tabla = 'proveedores_turno' and operacion = 'DELETE' and antes->>'turno_id' = '<turno_id>';
insert into turno_cierres select (jsonb_populate_record(null::turno_cierres, antes)).*
  from auditoria where tabla = 'turno_cierres' and operacion = 'DELETE' and antes->>'turno_id' = '<turno_id>'
  order by (antes->>'cerrado_en')::timestamptz, antes->>'cierre_anterior_id' nulls first;
```

Probado en local: el turno vuelve idéntico en `v_turnos` salvo
`turnos.updated_at`, que queda con la hora de la reconstrucción (lo
tocan los triggers al reinsertar ventas y proveedores). En prod, el
trigger `notificaciones` puede mandar un correo al reinsertar el turno.

`verificar_integridad()` (dueña o `service_role`) devuelve una fila por
regla que falla, con `severidad` `error` (datos inconsistentes: totales
distintos del último cierre, turno cerrado sin ventas, correcciones sin
cierre anterior, proveedores sin catálogo, día completo con una tarde
con ventas) o `aviso` (borradores de días pasados, fechas futuras, día
completo con una tarde vacía). El respaldo diario falla si hay
cualquiera de las dos. Estado de prod al 2026-09-18: un error, el
2026-06-17 marcado como día completo con una tarde sin ventas pero con
2 proveedores ($207.405). Hay que revisarlo con la dueña.

## Correos (Resend)

1. Verificar un dominio en <https://resend.com/domains> (DNS: SPF + DKIM).
   Sin dominio, Resend solo envía al correo del dueño de la cuenta.
2. Secretos de las edge functions:

```sh
pnpm exec supabase secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM="FrytControl <avisos@tudominio.cl>" \
  WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  ANTHROPIC_API_KEY=sk-ant-xxx        # opcional: resumen narrativo
```

3. El mismo `WEBHOOK_SECRET` y la URL de las funciones van a Vault
   (SQL Editor del proyecto, **una vez por entorno**):

```sql
select vault.create_secret('<mismo WEBHOOK_SECRET>', 'webhook_secret');
select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_base_url');
```

4. Probar:

```sql
-- Debe encolar una petición y, en unos segundos, aparecer 200 acá:
select public.enviar_resumen_periodico('diario');
select status_code, left(content, 200), created
from net._http_response order by created desc limit 3;
```

Cómo funciona: el trigger `notificar_cierre` (tabla `turno_cierres`)
manda el correo "turno cerrado"; `pg_cron` corre `resumen-diario`
(12:00 UTC, día anterior) y `resumen-semanal` (lunes 12:00 UTC). Las
funciones rechazan cualquier petición sin el header `x-webhook-secret`.
Las llaves **no** están en el repo ni en las definiciones de la base.

## Seguridad

- Dashboard → Authentication → Providers → Email: activar
  *Leaked password protection*.
- Después de cada migración: `get_advisors` (MCP) o Dashboard →
  Database → Advisors, sin advertencias nuevas. Las esperadas (mismas que
  en prod): "SECURITY DEFINER ejecutable por authenticated" en
  `cerrar_turno`, `corregir_turno`, `fusionar_proveedores`, `es_dueno`,
  `get_my_rol`, `verificar_integridad` — son las RPC que se llaman a propósito y validan el
  rol por dentro.

## Checklist de humo de la app actual

Correr contra staging después de cada migración de la Fase 1, y contra
prod después de aplicarlas:

1. Login con la cuenta dueña → Hoy carga.
2. Ingresar turno: agregar / editar / borrar un proveedor; ingresar
   ventas; "Listo" con conteo y sin conteo.
3. Hoy muestra los totales; Resumen del día muestra el cuadre.
4. Historial → un día cerrado → Editar → guardar → aparece "Corregido".
5. Fusionar en turno único / Desmarcar.
6. Proveedores: renombrar uno y subir un logo.
7. Análisis 7 y 30 días + Exportar CSV.
8. Papelera: eliminar un turno y restaurarlo.
