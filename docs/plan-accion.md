# Plan de acción y seguimiento — 2026-10-01

La ejecución va por etapas. No aplicar contracción mientras las pruebas de
staging no estén completas en verde. Conservar `jornadas`, los días «No
abrió», los roles dueño/trabajador y sus restricciones actuales. Mantener
las firmas de guardado, cierre y corrección durante la transición.

## 1. Operación y pruebas

| Comprobación | Resultado al 2026-10-01 |
|---|---|
| PR #10 (`2e1679c`), CI y Vercel | Correcto |
| Producción: respuesta 200 y headers de seguridad | Correcto |
| Respaldo de hoy e integridad | Correcto, ejecución `36859401601` |
| Simulacro de la última copia | Correcto, ejecución `36896940247` |
| Base local (`./scripts/test-db.sh`) | 197/197 pgTAP |
| Pruebas unitarias de la rama | 163 aprobadas; 6 de integración omitidas sin `SMOKE_PASSWORD` |
| Lint, tipos y build | Sin errores; lint mantiene 5 advertencias existentes |
| Playwright contra staging | 12/12 pruebas móviles aprobadas |
| Acceso del conector | Recuperado tras reinstalar; organización correcta |
| Reactivar staging | Activo; pausa temporal de `te-toco` autorizada |
| Esquemas API expuestos | Solo `public` y `graphql_public`, verificado por CLI |
| Historia de migraciones en producción | Alineada con el repo hasta `20261001173149_retirar_realtime_v1` |
| Protección contra contraseñas filtradas | Requiere Pro; no disponible en el plan gratuito |
| Auth y CLI al proyecto nuevo | Registro apagado y mínimo 10 en ambos entornos; CLI enlazada |

El conector y la CLI tienen acceso a la organización correcta.
Staging se reactivó con autorización del usuario para pausar temporalmente
`te-toco`. Al terminar, pausar staging y reactivar `te-toco`.
Registro público desactivado y mínimo 10 aplicados en ambos entornos;
configuración parcial, revisión previa y comprobación posterior. CLI
v2.117.0 enlazada a producción. En staging se retiró únicamente el registro
duplicado `20260916043424`; se conserva la migración canónica.

## 2. Navegación, celular y fechas históricas

- Implementado en `mejoras/plan-accion`, aún sin publicar: `/dia` sin fecha
  redirige al día actual de `America/Santiago`; fechas inválidas o imposibles
  muestran un mensaje en español y un enlace a Hoy. Probado con Chromium,
  autenticación y base locales, más pruebas de horario de verano e invierno.
- Se corrigió la lectura de «No abrió» al abrir Planilla y Cerrar turno:
  se consulta el servidor aunque la caché persistida sea reciente. El
  formulario espera la comprobación cuando hay conexión; se conserva la
  edición local sin conexión. Verificado por Playwright.
- `pnpm test` carga staging por defecto, como CI: importar el cliente de
  Supabase deja de fallar por variables ausentes. Sin `SMOKE_PASSWORD`, la
  integración remota se omite; esto no sustituye Playwright.
- Pendiente en dispositivos reales: altura de hojas y encabezado del
  Historial en Safari, compartir/descargar Excel, VoiceOver/TalkBack y PWA
  instalada desde `app.frytspa.cl`. Conservar los íconos del local.
- El usuario confirmó todas las fechas el 2026-10-01: `2026-01-01`,
  `2026-06-07`, `2026-06-21`, `2026-06-28`, `2026-07-12`, `2026-07-16` y
  `2026-09-06`. La consulta de producción confirmó **seis ya marcadas**, sin
  turnos activos; se conservaron sus motivos. Solo falta `2026-01-01`, que
  tampoco tiene turnos activos. Marcarla desde la app con sesión de la dueña
  y motivo vacío (no se indicó uno). Si alguna ya está marcada, conservarla;
  si tiene turnos activos, no borrar ni mover dinero para forzar la marca.

## 3. Retirar Realtime

Implementado y aplicado en local, staging y producción:
`20261001173149_retirar_realtime_v1.sql`. Retira únicamente `jornadas`,
`turnos`, `ventas_turno` y `proveedores_turno` de `supabase_realtime` y
restablece `replica identity default`. Conserva la publicación.

- Local: 197/197 pgTAP; staging: 12/12 Playwright después de aplicar.
- Respaldo previo restringido fuera del repo:
  `/tmp/fryt-respaldo-realtime-20261001.json`, más la copia cifrada diaria.
- Producción: huellas de todas las filas idénticas antes y después en las
  cinco tablas verificadas: 154 jornadas, 207 turnos, 207 ventas, 658
  proveedores de turno y 155 cierres. Ningún cambio monetario ni de snapshots.
- Publicación conservada, sin tablas adicionales en este entorno; identidad
  `d` en las cuatro tablas. Historia aplicada con las versiones del repo.

Reversión de esta migración (solo configuración, no restaura datos):

```sql
begin;
alter publication supabase_realtime add table
  public.jornadas, public.turnos, public.ventas_turno, public.proveedores_turno;
alter table public.jornadas replica identity full;
alter table public.turnos replica identity full;
alter table public.ventas_turno replica identity full;
alter table public.proveedores_turno replica identity full;
commit;
```

Ejecutar solo si las tablas todavía están fuera de la publicación; después
revertir el registro de la migración con CLI para alinear el historial.

## 4. Modernizar el esquema en tres entregas

1. **Día completo:** admitir `turnos.tipo='completo'`; convertir los turnos
   de mañana de jornadas de turno único, incluidos los eliminados. Mantener
   `jornadas` y adaptar guardado, vistas, integridad, papelera y tipos.
   Preservar la exclusión entre completo y dividido. Retirar
   `es_turno_unico` solo después de publicar consumidores compatibles.
2. **Ventas por método:** crear `ventas_turno_metodo` con clave compuesta
   `(turno_id, metodo_key)`, referencias y monto no negativo; migrar los seis
   métodos sin cambiar totales. Adaptar guardado, totales, exportaciones,
   correos y papelera. Conservar snapshots y compatibilidad hasta publicar.
3. **Proveedores:** obtener nombres actuales del catálogo y conservar
   nombres históricos en snapshots. Retirar columna duplicada y triggers
   después de adaptar consumidores. Eliminar `get_my_rol` solo tras revisar
   dependencias; mantener políticas de propiedad y pertenencia activa.

Estas entregas no están implementadas ni aplicadas. Las comprobaciones
remotas de la primera etapa ya están completas; siguen como entregas
separadas con expansión compatible y observación antes de retirar columnas.

## 5. Condiciones de cada despliegue

- Cero diferencias en conteos, ventas por método, proveedores, netos y
  totales de cierres antes y después. Preservar snapshots inmutables.
- Probar completo/dividido, unir/dividir, borradores, corrección, papelera,
  «No abrió», exportaciones y correos. Verificar dueño, trabajador, cuenta
  desactivada, sin perfil y anónimo.
- Actualizar tipos e invalidar caché persistida cuando cambie su forma.
- Secuencia: ampliar base compatible → publicar consumidores → observar
  un ciclo operativo → retirar estructuras antiguas. Siempre local,
  staging y producción, con respaldo y reversión probada.
- No aplicar durante el cierre del local. Avisar antes de actualizar `main`.
  No retirar el proyecto antiguo antes del 2026-10-17.
