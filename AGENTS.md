# Para agentes y modelos que trabajen en este repo

Lee primero **`docs/ESTADO.md`**: qué es FrytControl, en qué fase está, qué
falta y qué no se debe romper. Luego `docs/plan-v2.md` (plan) y
`docs/operacion.md` (entornos, migraciones, credenciales).

Reglas cortas:
- Hay dos apps sobre la misma base: la actual (raíz, en uso diario) y la v2
  (`v2/`, en piloto). Todo cambio de base es aditivo y compatible con la actual
  hasta la Fase 5.
- Cualquier cambio que afecte a la app actual se avisa antes al usuario.
  Un push a `main` despliega las dos apps.
- Migraciones: probar con `./scripts/test-db.sh` (Docker), aplicar en staging
  (`psdhhwcxjcobwxjiemrr`) y después en prod (`kfmwhtbvgqurnpotypii`), con
  respaldo previo de las tablas.
- v2: `cd v2 && pnpm lint && pnpm typecheck && pnpm test && pnpm build` antes de
  commitear; `pnpm e2e` (Playwright contra staging) para el flujo de cierre.
- Idioma del código, commits y documentación: español.
