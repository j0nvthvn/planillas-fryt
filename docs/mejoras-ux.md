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

### Móvil (revisión con capturas, 16 de septiembre de 2026)

Capturas con Playwright en Pixel 7 (claro y oscuro) e iPhone SE (375 px)
contra staging. Lo que se veía mal y cómo quedó:

- **Fechas**: el `capitalize` de CSS daba "16 De Septiembre De 2026";
  `fechaLegible` pone mayúscula solo al comienzo (`mayusculaInicial`, `mesAnio`).
- **Negativos**: `clp` daba "$-404.199"; ahora "−$404.199".
- **Botón flotante**: no aparece en Cerrar turno, donde competía con "Cerrar el
  día" y tapaba su barra.
- **Hojas**: `BottomSheet` acepta `footer`; solo el cuerpo se desplaza, así el
  teclado, "Registrar conteo" y los botones de la revisión quedan siempre a la
  vista. Las teclas bajan a 46 px en pantallas de menos de 700 px de alto.
- **Margen inferior de las hojas**: `BottomSheet` tenía `p-0` junto con la
  clase `safe-bottom` de `@layer components`, y en Tailwind v4 la utilidad gana,
  así que el padding inferior quedaba en 0 (el contenido tocaba el borde y no
  respetaba la barra de inicio de iOS). Ahora usa
  `pb-[max(20px,env(safe-area-inset-bottom))]`. Regla: no mezclar clases de
  `@layer components` con utilidades que toquen la misma propiedad.
- **Cerrar turno**: sin la fecha repetida (en el celular de la dueña), el
  selector de modo en una línea, "Sí"/"No" del conteo de 44 px.
- **Historial**: agrupado por mes con encabezado pegajoso; una sola etiqueta de
  estado; fila en dos niveles (etiquetas arriba, montos y neto abajo) para que
  nada choque en 375 px; día sin cero inicial y sin la coma.
- **Análisis**: fechas en su propia fila a todo lo ancho; cifras de los KPI un
  paso más chicas bajo 390 px; "Caja (efectivo neto)" pasó a "Efectivo neto".
- **Ajustes → General**: etiqueta arriba y campo abajo en el celular.
- **Planilla**: "Corregido" en una línea, con 36 px de alto.
- **Carga**: esqueletos (`Esqueleto.tsx`) en lugar del spinner al abrir la app,
  en Hoy y en las pantallas diferidas. El login queda en "Ingresando…" hasta que
  la ruta carga y respeta `?volver=`.
- **Color de los métodos en oscuro**: `colorMetodo()` (`lib/theme.ts`) lo mezcla
  con blanco según `--metodo-mezcla` (100 % en claro, 55 % en oscuro).

### Exportación (Análisis → Exportar)

El CSV anterior tenía una fila por día y menos datos que el de la app actual.
Tenía además errores: "Efectivo esperado" por día contaba dos veces el fondo en
los días divididos, los estados salían en crudo (`sin_registro`) y un método
desactivado que tuvo ventas no tenía columna, así que la fila no cuadraba.
Ahora el botón **Exportar** abre una hoja con cuatro opciones:

- **Excel completo** (`features/exportar/xlsx.ts`, `write-excel-file` cargada
  solo al exportar): hojas Resumen, Días, Turnos, Cuadre de caja, Compras y Por
  proveedor, con fechas reales, montos numéricos con formato de pesos,
  encabezado fijo y fila TOTAL.
- **CSV por turno**: lo mismo que la app actual (trabajador, quién registró,
  estado, fondo, esperado, contado, diferencia y fila TOTAL).
- **CSV de compras a proveedores**: una fila por compra.
- **Reporte para imprimir o PDF** (`/analisis/reporte`, fuera del Layout): KPIs,
  ventas por método, días, compras por proveedor y cuadre de caja. Se imprime
  siempre en tema claro y en A4.

Todas las exportaciones usan las mismas tablas puras (`features/exportar/tablas.ts`,
con tests). Los montos vienen de la base; solo se suma la fila TOTAL, y el e2e
(`e2e/exportar.spec.ts`) comprueba que cuadra con el KPI. En el celular el
archivo se comparte (WhatsApp, correo, Drive) con `navigator.share` y, si no
se puede, se descarga (`lib/archivo.ts`). El CSV neutraliza los textos que
empiezan con `= + - @`.

### Rediseño Fintech (16 de septiembre de 2026)

Aplicado desde `docs/design_handoff_rediseno_fintech/` (README = especificación,
`Rediseño Fintech.dc.html` = referencia visual). Solo presentación.

- **Tokens** (`styles.css`): paleta gris/blanco/indigo en claro y oscuro,
  `--hairline-strong` para bordes de botones y campos, escala de cifras
  24/36/40 px y utilitarios nuevos `badge`, `segmented`, `row`, `tile`.
  `amount` y `cifra` pasan a Inter Tight tabular.
- **Fuentes** (`src/fonts.css`): Inter e Inter Tight variables, solo el
  subconjunto latino (los paquetes traen también cirílico, griego y
  vietnamita, que el service worker precachearía).
- **Shell**: barra lateral de 236 px, barra inferior de 58 px sin píldora, botón
  flotante cuadrado con el ícono de billete. `.pb-nav`, `.above-nav` y los
  toasts usan la altura nueva.
- **Encabezados** (`PageHeader`): barra blanca a todo el ancho en el celular y
  encabezado simple desde `md`.
- **Hoy**: neto en tinta con variación contra ayer, fila de ventas/proveedores/
  turnos, fórmula del efectivo esperado con montos reales (el fondo sale de
  `efectivo_esperado − efectivo_neto`), barra apilada por método, lista de tres
  que se expande en el lugar y grilla de turnos con el faltante "Pendiente".
- **Cierre**: segmented de modo y de trabajadores (hasta 4; con más, píldoras),
  proveedores con iniciales y forma de pago como badge, descuadre como badge,
  hojas blancas con teclado de teclas con borde.
- **Planilla/revisión** (`Ledger`): tabla con etiquetas de sección, total de
  ventas, proveedores en rojo con signo y neto en franja o bloque.
- **Análisis**: KPIs en una tarjeta 2×2 en el celular con **Neto primero**
  (el diseño lo ponía tercero; así el e2e de exportación sigue encontrando la
  tarjeta que empieza por "Neto"), barras en tinta, borradores en ámbar y
  promedio punteado.
- **Historial, Proveedores, Ajustes**: píldoras con la activa en tinta
  (`components/pildora.ts`), filas de 64–72 px, métodos con acciones en una
  segunda línea en el celular.
- **Cerrar turno sin barra inferior en el celular**: es una tarea con principio
  y fin; se sale con la flecha del encabezado y la barra del neto queda al
  borde. `Layout` marca `data-sin-nav` y `--nav-h` (alto de la barra) pasa a 0
  para `.pb-nav`, `.above-nav` y los toasts.
- `theme-color`, manifest, encabezado del Excel y `privacidad.html` con los
  colores nuevos. Se quitó `Amount.tsx` (sin uso).

## Pendiente

- Revisar en un celular real (Safari de iOS, con su barra inferior) la altura
  de las hojas y el encabezado pegajoso del Historial.
- Íconos de la PWA (`public/icon-*.png`, `logo.jpg`): son el logo café del
  local; el rediseño no los tocó.
- Probar **Exportar → compartir** en el celular de la dueña: si el navegador no
  permite compartir `.xlsx`, se descarga (Chrome para Android tiene una lista
  cerrada de tipos de archivo que se pueden compartir).
