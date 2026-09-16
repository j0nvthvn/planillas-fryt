# Operación de FrytControl

Guía de los pasos que **no** viven en el código: secretos, entornos y
cómo aplicar migraciones. El plan completo de la renovación está en
`docs/plan-v2.md`.

## Entornos

| Entorno | Proyecto Supabase | Región | Uso |
|---|---|---|---|
| Producción | `kfmwhtbvgqurnpotypii` (`planillas-fryt`) | us-east-2 | La app actual (`planillas-fryt.vercel.app`) |
| Staging | `planillas-fryt-staging` (crear en Fase 1.0) | sa-east-1 | Desarrollo de la v2 con copia de datos |

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

### Historial de migraciones en producción (una sola vez)

Producción tiene 19 versiones registradas con nombres distintos a los
archivos del repo (se aplicaron desde el dashboard). Para que
`db push` funcione, alinear el historial **sin tocar el esquema**:

```sh
# 1. Marcar como revertidas las versiones remotas que no existen como archivo
pnpm exec supabase migration repair --status reverted \
  20260710045738 20260710052026 20260710052051 20260710052138 \
  20260710055027 20260710060951 20260710061550 20260710154107 \
  20260710154704 20260710155727 20260715031254
# 2. Marcar como aplicadas las locales que ya están en el esquema
pnpm exec supabase migration repair --status applied \
  20260703000000 20260710000000 20260710020000 20260710020100 \
  20260710030000 20260714000000 20260915000000
# 3. Verificar: solo deben quedar pendientes hardening y correos_seguros
pnpm exec supabase migration list
```

(`20260915000000_baseline_prod.sql` es idempotente: aplicarla en prod
no cambia nada; existe para que un proyecto nuevo quede igual a prod.)

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
# hacen las pantallas de la app actual; nunca contra producción):
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
  Database → Advisors, sin advertencias nuevas.

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
