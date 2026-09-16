# Mejoras de UI/UX de la v2

Revisión hecha el 16 de septiembre de 2026 sobre la v2 desplegada (`v2/`,
piloto Fase 3 semana A). **Casi todo está aplicado** desde el 16 de
septiembre de 2026; abajo se marca qué quedó pendiente y por qué.
Contexto general en `ESTADO.md`; reglas de diseño en `plan-v2.md` (§2.5).

## Aplicado

### Base accesible (`v2/src/styles.css`)

- **Foco visible global**: una regla `:focus-visible` con el color de marca,
  para todo lo enfocable (filas de ventas y proveedores, pestañas, chips,
  teclado), no solo los botones con `btn`.
- **`prefers-reduced-motion`**: bajo esa preferencia no hay animaciones de
  hoja, aparición ni toast, ni el salto del teclado.
- **Selección de texto**: el `user-select: none` global salió de `html`; ahora
  está solo en la navegación y el teclado (utilidad `no-select`), así se puede
  copiar un monto o una fila para pegarla en WhatsApp.
- **Hojas inferiores**: `BottomSheet` es un `<dialog>` con `showModal()`, que
  atrapa el foco, lo devuelve al botón que la abrió y maneja Escape. Los
  avisos (toasts) suben con la API de popover para no quedar detrás.
- **Contrastes**: `--warn` y `--muted2` se oscurecieron un paso (`warn` sobre
  `warn-tint` pasó de 4,4:1 a ~6:1; `muted2` cumple sobre `canvas` y `soft`).
  Sobre fondos sólidos de marca o estado se usa el token `--on-solid` en vez
  de blanco: en modo oscuro esos fondos son claros y el blanco no se leía.
- **Semántica**: los filtros de Historial son botones con `aria-pressed` (no
  `role="tablist"`, que anunciaba paneles inexistentes). El gráfico de
  Análisis tiene ejes de 12 px y un resumen en texto para lectores de
  pantalla con el mejor y el peor día del período.

### Tipografía

- **Escala en tokens**: seis pasos (12, 13, 15, 17, 24 px) más los de cifras
  (30, 44, 52, 60) en `@theme`. Los 165 tamaños escritos a mano —incluidos
  los 29 usos de 10 y 11 px— se reemplazaron: **nada bajo 12 px**.
- **Cifras tabulares de verdad**: Instrument Serif no trae `tabular-nums`, así
  que la utilidad `amount` quedó solo para las cifras grandes (Hoy, planilla,
  teclado) y las columnas usan `cifra` (Hanken Grotesk + `tabular-nums`):
  Historial, los KPI de Análisis y la lista de turnos de Hoy.
- **Fuentes en el repo** (`@fontsource`), sin Google Fonts y sin el peso 800
  que no se usaba: el service worker las precachea y ya no hay salto de
  `display=swap` con la app sin red.

### Flujo

- **Revisión antes de cerrar** (`RevisionSheet`, reglas en `revision.ts`): el
  botón de la barra abre una hoja con el resumen completo (quién atendió,
  ventas por método, proveedores, caja y neto) y los avisos de lo que falta
  —sin trabajador, sin conteo, caja descuadrada, turno vacío—, ninguno
  bloqueante. Reemplaza al diálogo de "¿Cerrar sin ventas?".
- **Conteo de caja por billetes** (`ConteoSheet`, suma en `conteo.ts`): se
  cuenta cuántas piezas hay de cada denominación y la app suma en vivo y
  compara con el efectivo esperado. Queda la salida "escribir el total a
  mano". Al servidor sigue viajando solo `efectivo_contado`; el desglose vive
  en el borrador del dispositivo.
- **Aviso de proveedor parecido** (`parecido.ts`): al escribir un nombre sin
  coincidencia exacta aparece "¿Quisiste decir Río Maipo?" con un botón para
  usar el existente (distancia de edición sobre el nombre normalizado).
- **Teclado encadenado**: con el monto vacío el botón dice "Omitir y seguir",
  así queda claro que dejar un método en cero es válido.
- **Título de la pantalla de cierre** según el modo ("Cerrar el día",
  "Cerrar la tarde", "Corregir…") y la fecha en el eyebrow.
- **Botón flotante**: "Cerrar caja" en vez de "Cerrar" (que también significa
  salir).
- **Barra lateral de escritorio**: el bloque de cuenta (nombre, rol, cerrar
  sesión) va al pie, sin depender de la pantalla Hoy.
- **Login**: botón para mostrar la contraseña.

## Pendiente

- **Historial más legible**: agrupar por mes con encabezado pegajoso y la
  fecha en una línea. La fecha ya no está en tipos diminutos, pero la fila
  sigue siendo densa.
- **Esqueletos en vez de spinner** en la primera carga.
- **Color de cada método de pago** (`metodos_pago.color`, dato de la base) en
  modo oscuro: `--cash` y `--wire` ya tienen variante oscura, pero el color
  que viene de la base se sigue usando tal cual como color de texto en el
  teclado y en las barras de Hoy.
