# Piloto de la v2 (Fase 3)

> **Terminado.** El 2026-09-17 la v2 pasó a ser la app principal y la base se
> movió a `aecopggpahxjaglakqwd` (ver `docs/ESTADO.md` y `docs/cambio-fase4.md`).
> Este documento queda como referencia.

Ambas apps contra la **misma base de producción**. La app actual sigue en
`planillas-fryt.vercel.app`; la v2 en `frytcontrol-v2.vercel.app`
(producción) apunta a prod, y sus previews (rama `v2`) a staging.

## Cómo se decide a qué base apunta la v2

Está en el repo, no en el dashboard:

| Deploy de Vercel | `VERCEL_ENV` | Archivo que carga Vite | Base |
|---|---|---|---|
| Producción (rama de producción del proyecto) | `production` | `v2/.env.production` | prod `kfmwhtbvgqurnpotypii` |
| Preview (cualquier otra rama) | `preview` | `v2/.env.staging` | staging `psdhhwcxjcobwxjiemrr` |

Requisito único: que la rama de producción del proyecto `frytcontrol-v2`
contenga `v2/` (Settings → Git → Production Branch = `v2`, o push de `main`).

## Semana A: solo lectura

Objetivo: la v2 muestra las mismas cifras que la app actual.

- Comparación automática (hecha el 2026-09-16, 59 días): 0 diferencias en
  ventas, proveedores, neto y efectivo esperado entre la fórmula de la app
  actual (sumas en el cliente) y `v_resumen_dia`. Query en
  `docs/limpieza-datos-2026-09.sql` → sección "piloto".
- A mano, en el celular: Hoy, Historial (30 días) y Análisis (7 y 30 días)
  de la v2 contra las mismas pantallas de la app actual. Anotar cualquier
  número distinto.
- Nadie cierra turnos en la v2 esta semana.

## Semana B: registro parcial

- Algunos días se cierran en la v2 desde el móvil del local (cuenta del
  local, rol trabajador); el resto en la app actual.
- Verificar cada día: la app actual muestra bien lo cerrado en la v2 (un
  "día completo" aparece como "Turno único"), y viceversa.
- Correcciones de la dueña: desde la v2 (Planilla del día → Corregir) para
  probar el flujo auditado.

## Semana C: v2 principal

- Todo se cierra en la v2; la app actual queda de respaldo.
- Si algo falla, se vuelve a la app actual sin hacer nada más: la base es
  la misma.

## Qué revisar cada día (dueña o Jonathan)

1. `logs_error` con `contexto` que empieza por `v2:` (Ajustes → Errores en
   la v2, o SQL: `select * from logs_error where contexto like 'v2:%' order by created_at desc`).
2. Borradores de días pasados en Hoy (aviso amarillo): deben ser 0 al
   terminar la semana.
3. Ajustes → General → "Tiempo de cierre en este dispositivo": promedio.

## Criterios de salida (para pasar a la Fase 4)

- 0 errores nuevos de la v2 en `logs_error` durante la semana C.
- Totales idénticos entre apps (semana A) y sin descuadres inexplicables.
- 0 borradores de días pasados al final de la semana C.
- Tiempo de cierre medido menor que el actual (referencia: estimar con la
  dueña cuánto tarda hoy; la v2 lo mide sola).
- La dueña aprueba: "puedo cerrar el día sin ayuda".

## Fase 4 después del piloto

Ver `docs/plan-v2.md` (migración a sa-east-1 en ventana nocturna y cambio
de variables en Vercel de las dos apps).
