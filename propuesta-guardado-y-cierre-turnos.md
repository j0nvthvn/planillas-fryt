# Propuesta: simplificar el guardado y cierre de turnos

FrytControl — Minimarket Fryt · Preparado a partir de la revisión del código actual (`Turno.jsx`, `EditarTurno.jsx`, `turnoApi.js`, `useJornadaRealtime.js`) y de cómo resuelven el mismo problema sistemas de punto de venta con historial probado (Toast, Square, Lightspeed).

## 1. Diagnóstico: qué hace la app hoy

Hoy existen dos caminos distintos para lo que conceptualmente es la misma operación — "guardar los datos de un turno" — y difieren en casi todo: cuándo escriben a la base de datos, cómo manejan proveedores, y cómo detectan conflictos.

**Camino A — `Turno.jsx` (turno de hoy).** Autoguarda cada proveedor apenas se agrega, edita o borra, encolando las escrituras en una cola de promesas hecha a mano (`enqueueSave` / `saveQueueRef`) para que no se pisen entre sí. El turno se crea de forma perezosa la primera vez que hay algo que guardar (`asegurarTurno`), marcado `is_draft: true`. Las ventas, en cambio, viven solo en memoria hasta que el usuario presiona "Guardar turno" — ahí recién se escriben (`guardarVentas`) y se marca el turno como cerrado (`finalizarTurno`, que pone `is_draft: false`).

**Camino B — `EditarTurno.jsx` (turnos históricos, solo dueño).** No autoguarda nada. Junta proveedores y ventas en memoria y, al presionar "Guardar cambios", reemplaza todo de una vez: actualiza ventas, borra **todos** los proveedores existentes y los vuelve a insertar desde cero (`escribirTurno`). Antes de escribir, compara el `updated_at` remoto contra el que se cargó al abrir la pantalla, para detectar si alguien más editó el turno mientras tanto.

Esto se traduce en `turnoApi.js` en cerca de diez funciones distintas (`asegurarTurno`, `insertarProveedor`, `actualizarProveedor`, `eliminarProveedor`, `guardarVentas`, `finalizarTurno`, `crearTurno`, `escribirTurno`, `versionTurno`, `borrarTurno`) cubriendo, en el fondo, la misma responsabilidad. Esta duplicación no es solo un problema estético: ya causó un bug real — las políticas RLS para permitir que un trabajador actualizara su propio turno se agregaron pensando en un camino y se olvidaron en el otro (corregido en la sesión anterior).

Además hay dos inconsistencias de fondo que vale la pena resolver, no solo prolijar:

- **Confiabilidad dispareja entre ventas y proveedores.** Si un trabajador completa las seis casillas de venta y pierde conexión o cierra la app antes de tocar "Guardar turno", pierde todas las ventas — pero los proveedores que ya había cargado sí quedaron a salvo, porque esos sí se autoguardan. Son datos igual de importantes con garantías distintas.
- **Reemplazo total sin transacción en `escribirTurno`.** Borra todos los proveedores y luego reinserta los nuevos en dos llamadas separadas. Si la segunda falla (por ejemplo, se corta la conexión justo después del borrado), el turno queda sin ningún proveedor, sin forma de recuperar los datos previos salvo que el usuario recuerde reingresarlos.

## 2. Cómo lo resuelven los sistemas de punto de venta

El estándar de la industria (Toast, Square, Lightspeed, y en general cualquier sistema serio de cierre de caja) separa dos conceptos que esta app mezcla en un solo booleano `is_draft`:

Un **X report** es una foto intermedia del turno en curso: se puede consultar, corregir, no tiene consecuencias. Un **Z report** es el cierre final — al generarlo, ese conjunto de datos queda fijado y no se edita directamente; cualquier corrección posterior se registra como un ajuste visible, no como una sobreescritura silenciosa del número original ([ConnectPOS – Z Report](https://www.connectpos.com/glossary/z-report/); [Toast – Close Out Day, Z Report, and Auto-Capture](https://support.toasttab.com/en/article/Close-Out-Day-Z-Report-Auto-Capture)). El flujo de cierre de caja de Toast, por ejemplo, distingue explícitamente entre un cajón "abierto" y uno "cerrado", y cerrarlo implica contar y confirmar un balance final que queda registrado ([Toast – Cash drawer states](https://doc.toasttab.com/doc/platformguide/adminCashDrawerStates.html); [Toast – Shift Review Overview](https://support.toasttab.com/en/article/Shift-Review-Overview)).

En esta app, hoy, el dueño puede editar o borrar cualquier turno ya "cerrado" (`is_draft: false`) sin que quede ningún rastro de cuál era el valor original ni quién ni cuándo lo cambió. No existe un equivalente al Z report inmutable — solo un flag que se puede revertir en cualquier momento.

## 3. Diseño propuesto

### 3.1 Una sola función de guardado, no diez

Reemplazar las funciones actuales de `turnoApi.js` por una única función `guardarTurno({ fecha, tipo, usuarioId, ventas, proveedores })` que:

- Si no existe el turno (fecha + tipo), lo crea.
- Actualiza las ventas (upsert por `turno_id`, igual que hoy).
- Sincroniza proveedores por diferencia en vez de "borrar todo y reinsertar": los que tienen `id` existente se actualizan, los nuevos se insertan, y solo se borran los que el usuario quitó explícitamente de la lista. Esto elimina el riesgo de perder todos los proveedores si la escritura falla a mitad de camino.

Tanto `Turno.jsx` como `EditarTurno.jsx` llamarían a esta misma función — la única diferencia entre "turno de hoy" y "turno histórico" pasa a ser de UI (autoguardado continuo vs. un solo botón "Guardar"), no de lógica de escritura.

### 3.2 Autoguardar ventas igual que proveedores

Aplicar al ingreso de ventas el mismo autoguardado por campo que ya existe para proveedores (debounce corto tras cada monto ingresado), en vez de mantenerlas solo en memoria hasta el botón final. Esto empareja la garantía de durabilidad de ambos tipos de dato y hace que "Guardar turno" deje de ser el único punto de escritura — pasa a ser solo el evento de **cierre**.

### 3.3 Cerrar un turno como evento auditado, no como un flag reversible

Esta es la pieza que traduce la idea de "Z report" a este esquema. En vez de que `finalizarTurno` solo ponga `is_draft = false`, se introduce una función de Postgres (`cerrar_turno(turno_id)`, `security definer`, ejecutada como una sola transacción vía `supabase.rpc(...)`) que, atómicamente:

1. Lee las ventas y proveedores actuales del turno.
2. Inserta una fila en una tabla nueva, **`turno_cierres`**, con una fotografía inmutable de esos valores.
3. Recién ahí marca `turnos.is_draft = false`.

Esquema propuesto para `turno_cierres`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | primary key |
| `turno_id` | `uuid` | referencia a `turnos(id)` |
| `cerrado_por` | `uuid` | referencia a `usuarios(id)` |
| `cerrado_en` | `timestamptz` | `default now()` |
| `ventas_snapshot` | `jsonb` | `{efectivo, getnet, mercadopago, edenred, amipass, transferencia}` al momento del cierre |
| `proveedores_snapshot` | `jsonb` | lista `[{nombre, monto, forma_pago}, ...]` al momento del cierre |
| `total_ventas` | `numeric` | calculado, para no tener que reprocesar el JSON en cada consulta |
| `total_proveedores` | `numeric` | ídem |
| `es_correccion` | `boolean` | `false` en el cierre original |
| `cierre_anterior_id` | `uuid` | nulo en el cierre original; apunta al cierre previo cuando es una corrección |

Con `es_correccion` y `cierre_anterior_id` se arma una cadena de versiones. RLS: cualquier autenticado puede leer, pero **nadie** tiene permiso de `update` ni `delete` sobre esta tabla — solo `insert` a través de la función `cerrar_turno` (y de la función equivalente de corrección). Eso es lo que la hace un verdadero registro inmutable, no una bitácora que también se puede editar.

**Flujo de corrección.** Cuando el dueño edita un turno que ya tiene un cierre previo en `turno_cierres`, en vez de sobreescribir en silencio, el guardado invoca una función `corregir_turno(turno_id)` que inserta una **nueva** fila en `turno_cierres` con `es_correccion: true` y `cierre_anterior_id` apuntando al cierre anterior, antes de aplicar el cambio a `ventas_turno` / `proveedores_turno`. En `Resumen.jsx` e `Historial.jsx`, si un turno tiene más de un cierre, se muestra un badge "Corregido" que al expandirse compara el snapshot original contra el actual — igual que un Z report reimpreso se compara contra el original, en vez de simplemente desaparecer.

### 3.4 Detección de conflictos: simplificar, no eliminar

La comparación de `updated_at` (concurrencia optimista) y el aviso de "cambios en otro dispositivo" están duplicados con variaciones entre `Turno.jsx` y `EditarTurno.jsx`. Con el guardado unificado (3.1) y el autoguardado de ventas (3.2), tiene sentido extraer esa lógica a un solo hook reutilizable (`useConflictoRemoto(turnoId)`) que ambas pantallas consuman, en vez de mantener dos implementaciones ligeramente distintas del mismo aviso. No se propone eliminar la detección de conflictos en sí — sigue siendo útil si dos personas tocan el mismo turno — pero si en la práctica esto casi nunca ocurre (un trabajador por turno), vale la pena confirmarlo con el uso real antes de invertir en mantenerla duplicada.

## 4. Qué cambia para cada pantalla

`Turno.jsx` deja de tener su propia cola de promesas (`enqueueSave`) — cada campo de venta o proveedor dispara un autoguardado con debounce que llama a `guardarTurno(...)`, y el botón "Guardar turno" pasa a invocar únicamente `cerrar_turno(turnoId)`. `EditarTurno.jsx` usa la misma `guardarTurno(...)` para el botón "Guardar cambios", y si el turno editado ya estaba cerrado, dispara `corregir_turno(turnoId)` en vez de un `update` directo. `Resumen.jsx` e `Historial.jsx` ganan la posibilidad de mostrar el badge "Corregido" cuando corresponda.

## 5. Plan de migración sugerido (fases)

1. Crear la tabla `turno_cierres` y las funciones `cerrar_turno` / `corregir_turno` en una migración nueva, sin tocar todavía el código del cliente — los turnos ya cerrados históricamente no tienen cierre registrado, lo cual es aceptable (se documenta como "cierre no auditado, anterior a esta fecha").
2. Reemplazar `finalizarTurno(turnoId)` (cliente) por una llamada a `supabase.rpc('cerrar_turno', { turno_id })`, dejando el resto del flujo de `Turno.jsx` intacto — este paso por sí solo ya resuelve el punto 3.3 sin tocar el autoguardado.
3. Escribir `guardarTurno(...)` unificada y migrar `Turno.jsx` y `EditarTurno.jsx` a usarla, retirando las funciones redundantes de `turnoApi.js`.
4. Agregar autoguardado de ventas en `Turno.jsx` con el mismo patrón de debounce que ya usan los proveedores.
5. Extraer `useConflictoRemoto` y limpiar la duplicación entre pantallas.

Cada fase es independiente y dejable en producción por separado — no hace falta hacerlas todas juntas ni en una sola sesión.

## Fuentes consultadas

- [ConnectPOS — Z Report](https://www.connectpos.com/glossary/z-report/)
- [ConnectPOS — X Report](https://www.connectpos.com/glossary/x-report/)
- [Toast — Close Out Day, Z Report, and Auto-Capture Overview](https://support.toasttab.com/en/article/Close-Out-Day-Z-Report-Auto-Capture)
- [Toast — Cash drawer states](https://doc.toasttab.com/doc/platformguide/adminCashDrawerStates.html)
- [Toast — Shift Review Overview](https://support.toasttab.com/en/article/Shift-Review-Overview)
- [Lightspeed Retail POS — X and Z Reports](https://shopkeep-support.lightspeedhq.com/hc/en-us/articles/47480030210971-X-and-Z-Reports)
