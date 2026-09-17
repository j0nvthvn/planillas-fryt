# Para agentes y modelos que trabajen en este repo

Lee primero **`docs/ESTADO.md`**: qué es FrytControl, en qué fase está, qué
falta y qué no se debe romper. Luego `docs/plan-v2.md` (plan) y
`docs/operacion.md` (entornos, migraciones, credenciales).

Reglas cortas:
- Desde el 2026-09-17 la única app en uso es la v2 (`v2/`, en
  `app.frytspa.cl`). La app antigua (raíz, `src/`) está retirada: su proyecto
  de Vercel solo redirige. Hasta la Fase 5 (limpieza) su código sigue en el
  repo y los cambios de base siguen siendo aditivos, para poder volver atrás.
- Un push a `main` despliega la v2 de producción: avisar antes.
- Migraciones: probar con `./scripts/test-db.sh` (Docker), aplicar en staging
  (`psdhhwcxjcobwxjiemrr`) y después en prod (`aecopggpahxjaglakqwd`, sa-east-1
  desde el 2026-09-17; el anterior `kfmwhtbvgqurnpotypii` está pausado), con
  respaldo previo de las tablas.
- v2: `cd v2 && pnpm lint && pnpm typecheck && pnpm test && pnpm build` antes de
  commitear; `pnpm e2e` (Playwright contra staging) para el flujo de cierre.
- Idioma del código, commits y documentación: español.
