# Para agentes y modelos que trabajen en este repo

Lee primero **`docs/ESTADO.md`**: qué es FrytControl, en qué fase está, qué
falta y qué no se debe romper. Luego `docs/plan-v2.md` (plan) y
`docs/operacion.md` (entornos, migraciones, credenciales).

Reglas cortas:
- La app vive en la raíz del repo (`src/`, en `app.frytspa.cl`). La app antigua
  se retiró el 2026-09-17 y se borró del repo el 2026-09-19: su código está en
  el tag `legacy-final` y en la rama `legacy`, que es la que despliega el
  proyecto de Vercel `planillas-fryt` (solo redirige).
- Un push a `main` despliega producción: avisar antes.
- La base todavía guarda "día completo" como `tipo='mañana'` +
  `jornadas.es_turno_unico`, y las ventas como una columna por método. Quitar
  eso es la parte de esquema de la Fase 5, pendiente: hasta entonces los
  cambios de base siguen siendo aditivos.
- Migraciones: probar con `./scripts/test-db.sh` (Docker), aplicar en staging
  (`psdhhwcxjcobwxjiemrr`) y después en prod (`aecopggpahxjaglakqwd`, sa-east-1
  desde el 2026-09-17; el anterior `kfmwhtbvgqurnpotypii` está pausado), con
  respaldo previo de las tablas.
- Antes de commitear: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`;
  `pnpm e2e` (Playwright contra staging) para el flujo de cierre.
- Idioma del código, commits y documentación: español.
