# Revisión general y mejoras incrementales de FrytControl

Fecha de revisión: **1 de octubre de 2026** (segunda pasada el mismo día,
contra el código y con consultas de solo lectura en producción).

## Resultado de la revisión

La base técnica pasa las comprobaciones locales: **180 pruebas unitarias,
tipos y compilación correctos**; lint sin errores y con cinco advertencias.
Las seis pruebas de integración quedaron omitidas por falta de
`SMOKE_PASSWORD`.

Las afirmaciones de la primera pasada se confirmaron en el código. La
segunda pasada encontró además **defectos de pérdida de datos en el
cierre** más graves que lo que era la Prioridad 1: pasan a ser la
Prioridad 0. No se modificó código ni se escribió en ninguna base. La
evaluación visual en navegador y dispositivos reales queda pendiente.

## Prioridad 0: pérdidas de datos en Cerrar turno

- **El conteo de caja se borra tras un autoguardado.** El autoguardado no
  envía `efectivo_contado` ([useTurnoForm.ts](../src/features/turno/useTurnoForm.ts),
  `sincronizar`). `guardarTurno` invalida `turnosDia`; el refetch cambia
  `dataUpdatedAt` y, como `sucio` ya es `false`, el efecto de carga vuelve a
  cargar desde el servidor. `desdeServidor`
  ([estadoTurno.ts](../src/features/turno/estadoTurno.ts)) deja
  `contoCaja: false`, `efectivoContado: null` y `desgloseConteo: null`,
  porque en un borrador `v_turnos.efectivo_contado` sale vacío (solo existe
  en `turno_cierres`). El borrador local, más viejo que el servidor, se
  borra. Basta contar la caja y pasar más de 1,5 s en la revisión, o irse a
  segundo plano (envío al ocultar + `refetchOnWindowFocus`).
  **En producción, de 16 cierres desde el 17 de septiembre de 2026, ninguno
  tiene conteo.** El e2e no lo detecta: cierra antes de 1,5 s y verifica
  `$120.000`, que también es la venta en efectivo.
- **La misma recarga cambia la `key` de los proveedores recién agregados**
  (de `nuevaKey()` al id de la base). Si la hoja de ese proveedor estaba
  abierta, guardarla agrega otra fila (**pago duplicado**) y «Eliminar» no
  hace nada, porque el reducer busca por `key`. Mientras el formulario siga
  `sucio`, cada autoguardado además vuelve a insertar y a borrar las filas
  sin id. En producción no hay duplicados desde el 17 de septiembre de 2026:
  es un riesgo, no un incidente.
- **La app se genera conflictos a sí misma y después los descarta.**
  `guardar_turno` siempre ejecuta `update turnos` y el trigger
  `set_turnos_updated_at` cambia `updated_at`. Dos solicitudes del mismo
  dispositivo con la misma base (autoguardado + envío al ocultar,
  autoguardado + Cerrar, o red lenta + otra edición) hacen que la segunda
  reciba `conflicto`. Aparece «Este turno cambió en otro dispositivo» y
  cerrar la hoja adopta el servidor y borra lo local. Es una sola cadena:
  la serialización de la Prioridad 1 es lo que la corta.
- **Si la consulta del día falla, el formulario se abre vacío.** Con error,
  `isPending` es `false` y la carga sigue sin servidor. El primer dato se
  envía con `base_updated_at: null`, y sin base la RPC no comprueba
  conflictos: **sobrescribe** el borrador existente (ventas en cero,
  proveedores borrados). Debe mostrarse el error con «Reintentar», nunca el
  formulario.
- **Los errores de guardado no quedan registrados.** `logError` solo se usa
  en `ErrorBoundary`, así que «0 errores en `logs_error`» no dice nada del
  guardado. Registrar `conflicto` y `error` en `sincronizar` (contexto
  `v2:guardar`) para medir en producción los dos puntos anteriores.
- **Menores del mismo flujo.** «Conservar lo mío y reemplazar» llama
  `sobrescribir(false)` aunque el conflicto viniera de cerrar: no cierra y
  no avisa. `onCerrar` lee `form.errorAutosave` de un render anterior y
  pierde el mensaje real. La hoja de conflicto también se cierra
  arrastrándola hacia abajo, no solo con la X, Escape o el fondo.
  `listarBorradoresLocales` no se usa en ninguna parte.

## Prioridad 1: proteger el trabajo durante el cierre

- **Serializar el guardado.** En
  [useTurnoForm.ts](../src/features/turno/useTurnoForm.ts), autoguardado,
  salida de pantalla y cierre pueden iniciar solicitudes simultáneas;
  `guardando` solo cubre cerrar y sobrescribir. Mantener una sola
  solicitud activa en un módulo puro (como `estadoTurno.ts`) probado con
  timers falsos; acumular cambios posteriores y esperar el guardado
  pendiente antes de cerrar. Conservar las firmas actuales de las RPC.
- **No recargar tras una escritura propia.** Si el `updated_at` del
  servidor es igual a `baseUpdatedAt`, el refetch trae lo que el propio
  dispositivo acaba de guardar: no reemplazar el estado, solo asignar el id
  a las líneas que no lo tienen, conservando su `key` y el conteo de caja.
  Esto corrige los dos primeros puntos de la Prioridad 0.
- **Evitar descartes involuntarios.** En
  [CerrarTurno.tsx](../src/features/turno/CerrarTurno.tsx), cerrar la hoja
  de conflicto adopta el servidor y borra el borrador local. La X, Escape,
  el fondo y el arrastre deben conservar los datos; descartar o sobrescribir
  requiere elegir la acción explícita. Si el conflicto viene de cerrar,
  ofrecer «Reemplazar y cerrar». Mientras el conflicto siga pendiente,
  suspender el autoguardado.
- **Mostrar el estado real del borrador.** Separar «Guardando…», «Guardado
  en este dispositivo», «Borrador sincronizado», error y conflicto.
  Actualmente `sucio` también muestra «Guardando…» para correcciones que
  no se autoguardan, y un turno ya cerrado muestra «Borrador guardado».
  Exponer desde el hook un estado de sincronización y el resultado de la
  persistencia local; IndexedDB puede fallar silenciosamente.
- **Recuperar pendientes al abrir, sin depender del reloj.** Hoy gana el
  borrador local si `guardadoEn` (reloj del dispositivo) es mayor que el
  `updated_at` del servidor, y se carga como limpio. Guardar en el borrador
  local un indicador `pendiente` y volver a escribirlo tras cada
  sincronización. Si su base coincide con la del servidor, usar lo local y
  marcarlo `sucio` para que se suba al recuperar conexión; si difiere y
  hay pendientes, mostrar el conflicto en vez de descartarlo en silencio.
  Cambiar de fecha o de modo con cambios pendientes debe enviarlos antes.

## Prioridad 2: información clara y consistente

- **Distinguir carga, error y vacío.** Análisis puede permanecer en un
  spinner tras un error; Historial puede mostrar «Nada que mostrar»; Hoy
  puede presentar ceros. Introducir estados compartidos con mensajes en
  español y «Reintentar». Con datos previos, conservarlos indicando que
  no pudieron actualizarse.
- **Mensajes de guardado en español.** `ErrorGuardado` muestra el texto
  crudo de Postgres; traducir por código (23514, 42501) antes de mostrarlo.
- **Corregir el detalle de proveedor.** La consulta limita a 100 compras
  antes de excluir la papelera, pero presenta la suma como «en total».
  Reutilizar el patrón de
  [proveedores/api.ts](../src/features/proveedores/api.ts) (`!inner`,
  `.is('turno.deleted_at', null)` y paginación) con «Cargar más», y mostrar
  un total real en vez de la suma de lo cargado. Ordenar por fecha de la
  jornada, no por `creado_en`. Mostrar «Día completo» usando el modo de
  jornada, en lugar del tipo interno `mañana`.
- **Completar invalidaciones.** Añadir `qk.todoProveedorHistorial` a
  `invalidarDia` ([query.ts](../src/lib/query.ts)), que ya usan guardar,
  eliminar y restaurar turnos. Crear `invalidarProveedores()` para
  renombrar, eliminar y fusionar, que hoy solo invalidan el catálogo:
  turnos del día, resumen, historial, exportación y compras.
- **Conservar enlaces al iniciar sesión.** Guardar en `volver` la ruta
  completa (`location.href`: fecha, modo y filtros) y navegar con `href`;
  actualmente se conserva solo `pathname`. Mantener la validación de
  [Login.tsx](../src/features/auth/Login.tsx) y rechazar también `\`.
- **Unificar fechas.** `/turno` valida con una regex que acepta el 31 de
  febrero; usar `z.iso.date()` en Cerrar turno y Reporte, como ya ocurre en
  Planilla. Derivar «hoy» y «Este mes» de `hoyChile`
  ([fechaPlanilla.ts](../src/lib/fechaPlanilla.ts)) en lugar de `hoy()`,
  que usa la zona del dispositivo.

## Prioridad 3: refactorización y ajustes de interfaz

- Dividir Cerrar turno por secciones de ventas, proveedores, caja y
  hojas, manteniendo la coordinación en la pantalla y las reglas en el
  reducer. Separar persistencia local y coordinación de solicitudes
  dentro del formulario.
- Extraer las consultas incrustadas en Historial y Detalle de proveedor
  hacia sus módulos de datos. Reutilizar `useIsDesktop` en `BottomSheet`.
- Separar utilidades y componentes en Keypad, ProveedorAvatar y Toast
  para resolver las cinco advertencias de Fast Refresh.
- Reutilizar esqueletos existentes para cargas iniciales. En la revisión
  del cierre, cambiar el botón secundario «Revisar» por «Volver a editar».
- Añadir «Ver datos por día» junto al gráfico de Análisis, accesible con
  teclado y lector de pantalla; el gráfico actual está oculto a
  tecnologías asistivas.

## Validación y entregas

Implementar en cuatro entregas: **pérdidas de datos (Prioridad 0) →
resto del guardado y conflictos → datos y navegación → refactorización e
interfaz**. La primera entrega lleva sus pruebas antes que el arreglo.

- Pruebas unitarias de la cola de guardado y de la carga inicial: edición
  durante un guardado, envío al ocultar, cierre inmediato, respuesta
  tardía, recarga tras escritura propia, borrador local pendiente y base
  distinta.
- Playwright con demora en las respuestas (`page.route`) en vez de probar
  la red lenta a mano. Corregir `e2e/cierre.spec.ts`: un monto contado
  distinto de la venta, esperar más de 1,5 s antes de confirmar y
  comprobar en la planilla que el conteo quedó registrado.
- Probar recuperación offline, fallo de IndexedDB, fallo de la consulta
  del día y conflicto sin pérdida al cerrar la hoja.
- Verificar errores sin caché y con datos previos; nunca presentar una
  falla como cero o ausencia de registros.
- Verificar proveedores con más de 100 compras, papelera, día completo e
  invalidaciones.
- Verificar retorno tras login, fechas imposibles y cambio de día/mes en
  Chile.
- Ejecutar lint, tipos, tests y build; después Playwright contra staging.
  Revisar claro/oscuro a 320 y 375 px, teclado, hojas, exportación y
  lectores de pantalla en dispositivos reales.
- Después de publicar la primera entrega, revisar en producción
  `logs_error` (`v2:guardar`) y que los cierres con conteo registren
  `efectivo_contado`.

Se conserva el diseño Fintech, navegación principal, logo y decisiones
actuales sobre selección de texto. Esta propuesta no requiere migraciones
ni la contracción del esquema de Fase 5. Antes de actualizar `main`, avisar
porque despliega producción.
