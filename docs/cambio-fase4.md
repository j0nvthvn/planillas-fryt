# Noche del cambio (Fase 4)

Pasa la base de `kfmwhtbvgqurnpotypii` (us-east-2) a `aecopggpahxjaglakqwd`
(sa-east-1), deja la v2 como única app en `https://app.frytspa.cl` y retira
la app antigua. Todo lo previo está hecho y ensayado (2026-09-17):
funciones, secretos, Vault, crons, dominio, Resend y dos corridas de
`scripts/migrar-region.sh` con manifiesto, auditoría e integridad iguales,
y la v2 revisada contra la copia con las cifras idénticas a prod.

Credenciales: `~/.config/frytcontrol/migracion.env` (fuera del repo).

## Antes (de día)

- [ ] Avisar a la dueña: esa noche, después del cierre, no registrar nada
      hasta el aviso. Al día siguiente entra en `app.frytspa.cl`, con la
      misma contraseña, e instala la app desde ahí.
- [ ] Rama `fase4` con los tres cambios de producción:
  - `v2/.env.production` → URL y anon key de `aecopggpahxjaglakqwd`.
  - `vercel.json` (raíz) → `redirects` 308 de todo a `https://app.frytspa.cl/`.
  - `.github/workflows/respaldo.yml` → `SUPABASE_URL` del proyecto nuevo.
- [ ] CI verde en `fase4`.

## Durante (después del último cierre del día)

1. Comprobar que no haya borradores del día en prod (Hoy en la v2 o
   `select count(*) from turnos where is_draft and deleted_at is null`).
2. Migración final, **sin** `SILENCIAR_CORREOS`:
   ```sh
   bash -c 'set -a; . ~/.config/frytcontrol/migracion.env; set +a;
     CONFIRMAR_DESTINO=aecopggpahxjaglakqwd ./scripts/migrar-region.sh <carpeta en scratchpad>'
   ```
   Debe terminar con `✔`. Si no, **se aborta**: nada cambió para la dueña.
   La corrida borra la cuenta de revisión (`revision@frytspa.cl`) y
   devuelve a la dueña su `activo = true` y los correos activos.
3. Fusionar y subir (lo hace el usuario): `git switch main && git merge --ff-only fase4 && git push`.
   Despliega las dos apps: la v2 contra sa-east-1 y la antigua como redirección.
4. Secreto del respaldo (lo hace el usuario): `gh secret set SUPABASE_DB_URL`
   con la cadena del session pooler del proyecto nuevo, y luego
   `gh workflow run respaldo.yml`.
5. En el prod viejo, para que no salgan correos ni crons duplicados:
   ```sql
   drop trigger if exists notificaciones on public.turnos;
   select cron.unschedule(jobid) from cron.job;
   ```
   Luego, en el dashboard, pausar `planillas-fryt` (**no borrar**; 30 días) y
   reactivar `planillas-fryt-staging`.

## Después (comprobar)

- `https://planillas-fryt.vercel.app` redirige a `app.frytspa.cl`.
- `app.frytspa.cl` entra con una cuenta real y Hoy muestra el día.
- `respaldo.yml` en verde contra la base nueva.
- Al día siguiente: llega el correo del primer cierre, el resumen diario
  (12:00 UTC) y `logs_error` sin errores `v2:`.

## Volver atrás

- Si falla antes de que haya registros nuevos: revertir el merge en `main`
  (la v2 vuelve a us-east-2 y la app antigua a funcionar), reanudar el
  proyecto viejo y restaurar sus crons con los de `docs/operacion.md`.
- Si ya hubo registros en la base nueva: copiar esas filas a mano al
  proyecto viejo antes de volver.
