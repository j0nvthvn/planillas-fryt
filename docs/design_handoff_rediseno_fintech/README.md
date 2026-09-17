# Handoff: Rediseño de UI “Fintech” de FrytControl v2

## Overview

Repintado completo de la interfaz de **FrytControl v2** (`v2/` del repo `j0nvthvn/planillas-fryt`): se abandona la paleta “Cálido Editorial” (cafés, cremas, Instrument Serif) y se adopta una piel de app financiera — superficie gris ultraclaro, tarjetas blancas de 1px, acento indigo, semántica verde/roja solo en los números, una sola familia tipográfica (Inter + Inter Tight) y todas las cifras con `tabular-nums`.

**El flujo de usuario no cambia.** Ninguna ruta, ningún estado, ninguna regla de negocio, ningún texto de dominio se modifica. Esto es una migración de tokens + ajustes de layout en componentes existentes.

Pantallas cubiertas: Hoy · Cerrar turno · Planilla del día · Análisis (móvil y escritorio) · Historial · Proveedores · Ajustes (General y Métodos/Papelera) · las tres hojas del cierre (monto/teclado, conteo de caja, revisión previa) · Hoy en modo oscuro.

## About the Design Files

Los archivos `.dc.html` de este bundle son **referencias de diseño hechas en HTML**: prototipos estáticos que muestran el aspecto y el comportamiento esperado. **No son código de producción para copiar.**

La tarea es **recrear estos diseños dentro del entorno que ya existe en `v2/`**: Vite + React 19 + TypeScript estricto + Tailwind v4 con tokens en `src/styles.css`, TanStack Router/Query. Todo el rediseño se implementa tocando los tokens y las clases utilitarias de ese proyecto, no reescribiendo componentes desde cero.

Cómo mirar los HTML: son documentos con lienzo horizontal; cada teléfono es de 390×844 y está etiquetado con la pantalla y el archivo fuente del que salió. `Estado actual (recreación).dc.html` es la línea base (cómo se ve hoy) y `Rediseño Fintech.dc.html` es el objetivo.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, tamaños, radios, sombras, alturas de fila y copys son finales. Se espera recreación pixel-perfect usando los utilitarios de Tailwind v4 ya definidos en `styles.css` (`card`, `btn-primary`, `input`, `eyebrow`, `cifra`, `amount`, `pb-nav`, `above-nav`), con los valores nuevos de la sección **Design Tokens**.

Lo que **no** es final y queda a criterio: micro-animaciones (se mantienen las de `styles.css`) y el orden de los métodos de pago (viene de la base).

---

## Cambio de más alto impacto: cinco ediciones y el 80% del rediseño está hecho

1. **`src/styles.css` → bloque `:root`**: reemplazar los valores de la paleta (tabla completa abajo).
2. **`src/styles.css` → bloque `html.dark`**: idem con la paleta oscura.
3. **`src/styles.css` → `@theme inline`**: `--font-sans: Inter`, `--font-display: "Inter Tight"`, y la nueva escala de `--text-*`.
4. **`src/styles.css` → utilitarios**: `amount` pasa a `font-display tabular-nums tracking-tight` (esto convierte de golpe todas las cifras grandes de serif a sans tabular), `card` a radio 16px y sombra de 1px, `btn` a radio 14px.
5. **`src/main.tsx`**: cambiar los imports de `@fontsource` por Inter / Inter Tight.

Todo lo demás son ajustes puntuales por pantalla, listados en **Screens / Views**.

---

## Design Tokens

### Colores — claro (`:root`)

| Token | Antes | Ahora | Uso |
| --- | --- | --- | --- |
| `--brand` | `#5C3317` | `#4F46E5` | acento: botones primarios, FAB, tab activo, links |
| `--brand-hover` | `#4A2810` | `#4338CA` | hover del primario |
| `--brand-tint` | `#F5EAD4` | `#EEF0FE` | fondo de tab activo en sidebar, badges informativos |
| `--canvas` | `#FBF6EC` | `#F6F7F9` | fondo de la app |
| `--card` | `#FFFFFF` | `#FFFFFF` | tarjetas (sin cambio) |
| `--hairline` | `#F0E7D6` | `#EBEDF1` | bordes y divisores internos |
| `--soft` | `#F6EFE1` | `#F1F3F6` | superficie hundida: segmented, chips, filas destacadas |
| `--ink` | `#2A211A` | `#0F1115` | texto principal y cifras |
| `--ink2` | `#5F5245` | `#3C424E` | texto secundario |
| `--muted` | `#6F5F4E` | `#667085` | texto de apoyo (4,9:1 sobre blanco) |
| `--muted2` | `#6E5F45` | `#6B7280` | texto chico: %, ejes, leyendas (4,8:1 — **no bajar de acá**) |
| `--pos` | `#1E7A4F` | `#047857` | montos positivos, estado “cerrado/cuadra” |
| `--pos-tint` | `#E6F1EA` | `#E7F4EF` | fondo de badge positivo |
| `--pos-border` | `#B8DCC7` | `#A7D8C6` | borde de bloque positivo |
| `--neg` | `#B91C1C` | `#DC2626` | proveedores, descuadres, montos negativos |
| `--neg-tint` | `#FBE9E9` | `#FDECEC` | fondo de badge negativo |
| `--warn` | `#7A5514` | `#B45309` | borradores, días sin cerrar |
| `--warn-tint` | `#FBF1DD` | `#FDF2E3` | fondo de aviso ámbar |
| `--info` | `#33518C` | `#4F46E5` | transferencias, corregido (se unifica con el acento) |
| `--info-tint` | `#E8EDF6` | `#EEF0FE` | fondo de badge informativo |
| `--image-bg` | `#F3F4F6` | `#F3F4F6` | fondo de logos (sin cambio) |
| `--cash` | `#1E7A4F` | `#047857` | punto de “efectivo” |
| `--wire` | `#33518C` | `#4F46E5` | punto de “transferencia” |
| `--on-solid` | `#FFFFFF` | `#FFFFFF` | texto sobre acento sólido |
| `--shadow-card` | sombra café difusa | `0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)` | tarjetas |
| `--shadow-hero` | sombra café difusa | `0 6px 20px -8px rgba(16,24,40,.14)` | tarjeta destacada, barra fija, FAB |

Extra del FAB (no es token, va inline en el botón): `box-shadow: 0 8px 20px -6px rgba(79,70,229,.5)`.

### Colores — oscuro (`html.dark`)

`--brand #8B93F8` · `--brand-hover #A5ABFB` · `--brand-tint #1E2240` · `--canvas #0B0D10` · `--card #15181D` · `--hairline #242931` · `--soft #1D2128` · `--ink #F3F5F8` · `--ink2 #C6CBD5` · `--muted #9AA2B0` · `--muted2 #7C8492` · `--pos #34D399` · `--pos-tint #0F2A22` · `--pos-border #2E6048` · `--neg #FB7185` · `--neg-tint #2E1519` · `--warn #FBBF24` · `--warn-tint #2D2211` · `--info #8B93F8` · `--info-tint #1E2240` · `--image-bg #322D26` (sin cambio) · `--on-solid #0B0D10` · `--shadow-card 0 1px 2px rgba(0,0,0,.5)` · `--shadow-hero 0 10px 28px -12px rgba(0,0,0,.7)`.

Se mantiene `--metodo-mezcla: 55%` en oscuro (los logos y colores de método siguen aclarándose con `colorMetodo()`), y también el borde de 3px del FAB en color `--card` para separarlo de la barra.

### Tipografía

- **Familias**: `--font-sans: Inter, system-ui, sans-serif` · `--font-display: "Inter Tight", Inter, sans-serif`.
  Instrument Serif se elimina del proyecto.
- **Escala** (`@theme inline`): `--text-xs 12px` · `--text-sm 13px` · `--text-base 15px` · `--text-lg 17px` · `--text-2xl 22px` · `--text-amount-sm 24px` · `--text-amount 36px` · `--text-amount-lg 36px` · `--text-hero 40px`.
- **Cifras**: siempre `font-variant-numeric: tabular-nums`. En display (≥24px) además `letter-spacing: -0.025em` y peso 700; en fila (15–17px) peso 600 y `-0.01em`.
- **Eyebrow / etiquetas de sección**: 11px, peso 600, `uppercase`, `letter-spacing .1em`, color `--muted`.
- **Títulos de pantalla** (`PageHeader`): 20px, peso 600, Inter Tight, `letter-spacing -.02em`, color `--ink` (antes 30px serif).
- **Mínimo absoluto**: 11px solo para etiquetas de nav, ejes y `%`; nada de texto de contenido bajo 12px.

### Radios

`--radius-xl2: 16px` (era 20). Tarjetas 16px · tarjetas chicas/KPI 14px · botones y campos 14px · píldoras internas (segmented, badges de estado) 9–12px · contenedores de logo 10px · badges de texto 6–7px · FAB 19px (cuadrado redondeado) · hojas inferiores 28px arriba.

### Espaciado y alturas

- Tarjeta: padding 18px (`card` pasa de `p-5` a `p-[18px]`).
- Fila de lista tocable: `min-height: 64px` (antes 56–60), padding lateral 16px, `gap: 13px`.
- Fila de tabla/ledger (no tocable): `min-height: 40px`.
- Fila de Historial: `min-height: 72px`.
- Separación entre secciones: 20px; entre tarjetas 12px.
- Contenedor de logo de método: 40×40px, radio 10px, borde 1px `--hairline`, imagen 30×30 `object-contain`.
- Bottom nav: 58px de alto + `max(10px, env(safe-area-inset-bottom))`; FAB 58×58 saliendo 22px, borde 3px del color `--card`.
- Barra fija de Cerrar turno: padding 12px 16px 14px, `box-shadow: 0 -6px 20px -12px rgba(16,24,40,.18)`.

---

## Screens / Views

Cada pantalla indica **archivo del repo** → **qué cambia**. Todo lo no mencionado se mantiene.

### 1. Shell — `src/components/Layout.tsx`

- **Sidebar (escritorio)**: 236px, fondo `--card`, borde derecho `--hairline`. Ítems: radio 10px, padding 9px 11px, 14px peso 500, color `--ink2`; activo → fondo `--brand-tint`, texto `--brand`, peso 600, `stroke 2.1`. Header con “FrytControl” 14px Inter Tight + “Minimarket Fryt” 12px `--muted`, separado con borde inferior. Pie: `AvatarMenu variante="bloque"` con avatar **cuadrado** 34px radio 10px, fondo `--soft`, borde `--hairline`, inicial en `--ink2` (ya no círculo café).
- **Bottom nav (móvil)**: se elimina la píldora `bg-brand-tint` detrás del ícono. Tab activo = ícono + etiqueta en `--brand` (peso 600, `stroke 2.1`); inactivo `--muted` peso 500. Ícono 21px, etiqueta 11px, `gap 4px`, `min-height 58px`.
- **FAB**: cuadrado redondeado 58×58, radio 19px, fondo `--brand`, ícono `cash` (billete) en vez de `plus`, borde 3px `--card`, **sin etiqueta de texto** (mantener `aria-label="Cerrar caja"`). Sigue oculto en la ruta `/turno`.
- **Banners** (versión nueva / sin conexión): mismos textos; fondo `--info` / `--warn` con `text-on-solid`.

### 2. Hoy — `src/features/hoy/Hoy.tsx`

Orden nuevo: encabezado → tarjeta de neto → CTA → tarjeta de efectivo esperado → tarjetas de turnos.

- **Encabezado**: fecha completa arriba como eyebrow (`fechaLegible` sin el año en móvil: “Miércoles 16 de septiembre”), “Hoy” abajo en 20px Inter Tight. Avatar 40px **cuadrado** radio 12px, fondo `--soft`, borde `--hairline`, iniciales `--ink2` 14px peso 600.
- **Tarjeta de neto** (`card`, 18px): fila superior con eyebrow “Neto del día” + `EstadoChip` a la derecha; cifra **40px Inter Tight 700 tabular en `--ink`** (ya no verde: el color queda para la variación); debajo, badge de variación vs. ayer (`DeltaBadge`, fondo `--pos-tint`/`--neg-tint`, radio 7px) + “vs. ayer $398.100” en 12px `--muted`; separador `--hairline`; y una fila de tres columnas divididas por líneas de 1px: **Ventas** (`--ink`), **Proveedores** (`--neg`, con signo −) y **Turnos** (“1 de 2”), cada una con etiqueta 12px `--muted` y valor 15px peso 600 tabular.
- **CTA**: `btn-primary` de alto 52px, radio 14px, 15px peso 600; ícono según el caso (`moon` para cerrar la tarde, `check` para terminar un borrador, `plus` para empezar).
- **Tarjeta de efectivo esperado**: título 14px `--ink2` + cifra 20px peso 600 tabular a la derecha; bajo el título, la fórmula **con los números reales** (“Fondo $40.000 + efectivo $198.400 − proveedores en efectivo $42.800”) en 12px `--muted2`; luego **una sola barra apilada** de 6px (segmentos con el color de cada método, `gap 2px`, extremos redondeados) que reemplaza las cinco barras individuales; y debajo las filas de método (máx. 3) con contenedor de logo 40px, nombre 14px, `%` 12px `--muted2` y monto 15px tabular alineado a la derecha (ancho fijo 86px). Cierra con una fila-botón “Ver los N métodos” centrada en `--brand`, 52px.
- **Tarjetas de turno**: grid de 2, radio 14px. Turno registrado → badge “Cerrado” (`--pos-tint`), monto 20px tabular, “Camila · 14:52”. Turno faltante → **borde dashed `--hairline`**, badge “Pendiente” en `--soft`/`--muted`, guion largo como monto y “Sin registro”.
- `EstadoChip`: radio 7px, 11px peso 600, **sin `uppercase`**, padding 5px 8px. Mapa de colores igual al actual con los tokens nuevos.

### 3. Cerrar turno — `src/features/turno/CerrarTurno.tsx`

- **Encabezado fijo**: pasa a una barra superior con fondo `--card` y borde inferior `--hairline` (padding 16px): flecha atrás 36px, título 20px Inter Tight, subtítulo de estado (“Borrador guardado · 14:52”) 12px `--muted`, y a la derecha el botón de fecha (40px, radio 11px, borde `--bd`, ícono `calendar` + “16 sept”).
- **Segmented de modo**: contenedor `--soft` con **borde 1px `--hairline`**, padding 3px, radio 12px; opción activa = fondo `--card` + `shadow-card` + `--ink`; inactiva `--muted` peso 500; alto 40px; **se quitan los íconos** (solo texto: “Día completo / Mañana / Tarde”). Deshabilitada: `opacity .35` como hoy.
- **“Quién atendió”**: los chips redondos se reemplazan por un **segmented de 4 columnas** con el mismo patrón (grid `repeat(4,1fr)`, alto 40px). Si hay más de 4 trabajadores activos, mantener scroll horizontal con las mismas píldoras pero radio 9px.
- **Ventas**: encabezado de sección (eyebrow + total 13px tabular en `--ink`). Filas de **64px**: contenedor de logo 40px radio 10px con borde `--hairline` (el `MetodoLogo` pasa de `bg-image-bg` redondeado a borde + fondo transparente; el punto verde de “tiene monto” se elimina, el monto ya lo dice), nombre 15px peso 500, `sub` 12px `--muted`, monto **17px peso 600 tabular** (`--ink`, o `--muted2` si es 0), chevron 15px `--muted2`.
- **Proveedores**: filas de 64px con **avatar de iniciales** 40px radio 10px (fondo `--soft`, borde `--hairline`, texto `--ink2`) en vez del punto de color; debajo del nombre, un badge de forma de pago (“Efectivo” en `--pos-tint`/`--pos`, “Transferencia” en `--brand-tint`/`--brand`, radio 6px, 11px peso 600); monto en **`--neg` con signo −**. Botón “Agregar proveedor”: 48px, radio 12px, fondo `--card`, borde `--bd2`, texto `--brand` (ya no `bg-brand-tint` ni dashed).
- **Caja**: fila “Fondo inicial” 60px; **fila “Efectivo esperado” destacada** con fondo `--soft` y bordes arriba/abajo, etiqueta 15px peso 600 y cifra **20px peso 700 tabular**; bloque “¿Contaste la caja?” con segmented No/Sí (38px, radio 8px dentro de contenedor radio 11px) y, si contó, una fila separada por borde con “Contado $193.600” a la izquierda y el resultado como **badge** (“Descuadre −$2.000” en `--neg-tint`, o “Cuadra” en `--pos-tint`), radio 7px.
- **Barra fija**: fondo `--card` sólido (se puede quitar el `backdrop-blur`), borde superior `--hairline`, sombra hacia arriba. Izquierda: eyebrow “Neto del día” 10,5px + cifra **24px Inter Tight 700 tabular** + estado de guardado con punto de 6px (`--pos` guardado, `--warn` guardando/offline). Derecha: `btn-primary` de 50px, radio 13px, texto de `etiquetaCerrar()` sin cambios.

### 4. Hojas del cierre — `BottomSheet`, `MontoSheet`, `Keypad`, `ConteoSheet`, `RevisionSheet`

- **`BottomSheet`**: fondo pasa de `--canvas` a **`--card`**, radio superior 28px, padding `8px 20px 20px`, handle 40×4 en `--bd2`. Título 17px Inter Tight peso 600. Botón de cerrar: 34px, fondo `--soft`, ícono 15px `--ink2`. Pie con borde superior `--hairline`. Backdrop `rgba(0,0,0,.38)`.
- **`MontoSheet` + `AmountDisplay`**: el display pasa a fondo `--soft` con borde `--hairline`, radio 14px, padding 14px 16px; eyebrow del `sub` arriba y cifra **40px Inter Tight 700 tabular** (`--muted2` si está vacío). El “2 de 5” va a la derecha del título en 12px peso 600 `--muted` tabular.
- **`Keypad`**: teclas 54px, radio 15px, fondo `--card` con borde 1px `--bd2`, dígitos **24px Inter Tight 600 tabular**; `000` en 17px `--ink2`; la tecla de borrar con fondo `--soft` y el mismo ícono actual. `gap` 10px. Botón de aceptar: 50px, radio 14px, `--brand`, 15px peso 600, con ícono `check`. “Guardar y volver” debajo, 40px, texto 13px peso 600 `--ink2`.
- **`ConteoSheet`**: tarjeta “Contado” igual que el display (36px la cifra) con la línea “Esperado $195.600 · diferencia −$2.000” en 13px (`--muted`, con la diferencia en `--neg`/`--pos` peso 600). Filas por denominación: etiqueta 66px (14px Inter Tight tabular), botones −/+ de **42px radio 11px** (fondo `--soft`, borde `--hairline`, deshabilitado `opacity .5`), casilla de cantidad 54×42 radio 11px borde `--bd2` centrada tabular, y subtotal a la derecha 13px peso 600 (`--muted2` si es 0). Pie: “Registrar conteo” primario + los dos enlaces (“Escribir el total a mano” en `--ink2`, “Empezar de nuevo” en `--neg`).
- **`RevisionSheet`**: los avisos pasan a tarjetas de radio 12px con borde `--hairline` y fondo `--neg-tint`/`--warn-tint`, ícono 17px y texto 13px peso 500 del color correspondiente (textos de `revision.ts` sin cambios). El `Ledger` se reestiliza (ver punto 5). El **neto final** va en un bloque propio: fondo `--soft`, borde `--hairline`, radio 12px, etiqueta 14px peso 600 y cifra 22px Inter Tight 700 tabular. Pie: “Revisar” secundario (flex 1) + primario (flex 2), ambos 50px radio 14px.

### 5. Planilla del día — `src/features/planilla/Planilla.tsx` + `src/components/Ledger.tsx`

- **Encabezado**: misma barra superior con fondo `--card` que Cerrar turno; título `fechaLegible` corto (“Miércoles 16 sept”) 20px, subtítulo “Planilla del día”; botones de día anterior/siguiente 38×38 radio 10px borde `--bd2` (deshabilitado `opacity .5`).
- **Tarjeta resumen**: eyebrow + `EstadoChip`; neto **36px Inter Tight 700 tabular en `--ink`**; abajo la misma fila de tres columnas divididas de Hoy (Ventas / Proveedores en `--neg` / En caja).
- **`Ledger` (el “cuaderno”)**: se elimina todo el rayado café. `Ledger` sin borde superior; `LedgerHead` pasa a **etiqueta de sección** (10,5px peso 600 uppercase `letter-spacing .1em`, color `--muted2`, sin borde ni el “$” de la derecha); `LedgerLine` a `min-height 40px`, etiqueta 14px `--ink2`, valor 14px peso 500 tabular `--ink`, divisor 1px `--hairline` (última sin divisor); los `hint` (“ef.”, “tr.”, “cuadra”) en 11px peso 500 `--muted`, salvo el de descuadre que va como badge `--neg-tint`; `dot` de 7px sigue marcando efectivo/transferencia (`--pos` / `--brand`). `LedgerTotal` grande se convierte en **franja inferior de la tarjeta**: fondo `--soft`, borde superior `--hairline`, padding 14px 18px, etiqueta 14px peso 600 y cifra 22px Inter Tight 700 tabular. El total chico (“Ventas − proveedores”) se mantiene como fila normal.
- **Acciones de la tarjeta**: botones ghost pasan a 40px radio 10px con borde `--bd2` (Corregir, Dividir) y “Eliminar” sin borde en `--neg`, alineado a la derecha.

### 6. Análisis — `src/features/analisis/Analisis.tsx`

- **Encabezado**: eyebrow con el rango (“10 – 16 septiembre”), título 20px, botón “Exportar” (móvil: 40px con borde; escritorio: primario indigo).
- **Rangos**: las tres píldoras pasan a un **segmented** (`--soft` + borde, activo `--card` + sombra). Los `input[type=date]` quedan como hoy en móvil (fila propia) y en escritorio van junto al segmented.
- **KPIs**: en móvil, **una sola tarjeta dividida en 2×2 por bordes de 1px** (en vez de cuatro tarjetas con `gap`): etiqueta 12px `--muted`, valor 20px peso 600 tabular, `DeltaBadge` sin fondo (solo ícono + % en `--pos`/`--neg`, 12px peso 600). En escritorio, cuatro tarjetas de 14px radio; la de **Neto** lleva una barra vertical de 3px en `--brand` al borde izquierdo en vez de fondo tintado, y el valor en peso 700.
- **Gráfico**: barras en **`--ink`** (neutro), días negativos en `--neg`, días con borrador en `--warn`; radio superior 4–5px; `CartesianGrid` con líneas `--hairline` sólidas y la base en `--bd2`; **línea de promedio** punteada en `--brand` con leyenda; ejes 11px `--muted2`; en escritorio se agrega leyenda arriba (día cerrado / con borrador / promedio) y el label del eje X muestra “jue 10”. El `Tooltip` mantiene su estructura con los tokens nuevos (fondo `--card`, borde `--hairline`, `shadow-hero`).
- **Ventas por método**: deja de ser solo barra: cada fila es contenedor de logo 40px + nombre 14px + **barra de 4px** bajo el nombre con el color del método + monto 15px tabular y `%` 11px `--muted2` a la derecha; filas de 60px separadas por `--hairline`.
- **Top proveedores**: avatar 36px radio 9px, nombre 13px peso 500, “N compras” 11px `--muted`, monto en `--neg` con signo −.

### 7. Historial — `src/features/historial/Historial.tsx`

- Barra superior `--card` con eyebrow (“Últimos 30 días”), título 20px y botón de búsqueda 40px.
- **Filtros**: píldoras de 34px radio 9px; activa = fondo **`--ink`** con texto `--card` (contraste máximo, distinto del acento que se reserva para acciones); inactiva `--card` + borde `--bd2` + `--ink2`.
- **Encabezado de mes**: eyebrow 11px `--muted` (se mantiene sticky, ahora sobre `--canvas`).
- **Fila de día (72px)**: caja de fecha a la izquierda (46px, radio 10px, fondo `--soft`, borde `--hairline`; día abreviado 10px uppercase `--muted` + número 18px Inter Tight tabular; si el día tiene borrador, fondo `--warn-tint`); al centro los badges (`EstadoChip`, “Corregido” en `--brand-tint`, “Descuadre” en `--neg-tint`, “Borrador sin cerrar” en `--warn-tint`) y bajo ellos “$X ventas · $Y prov.” en 12px `--muted` tabular; a la derecha neto 17px peso 600 tabular con la palabra “neto” en 11px `--muted`; chevron 15px.
- “Ver más días”: 46px, radio 12px, borde `--bd2`.

### 8. Proveedores — `src/features/proveedores/Proveedores.tsx`

- Barra superior con eyebrow (“Catálogo · N activos”), título 20px y botón **“Nuevo” primario indigo** 40px radio 11px.
- **Buscador**: `input` de 44px radio 12px, fondo `--soft`, borde `--hairline`, ícono `search` 17px a 13px del borde, placeholder `--muted`.
- “Mostrar inactivos”: checkbox 20px radio 5px con borde `--bd2`, etiqueta 13px `--ink2`, fila de 40px.
- **Aviso de duplicados**: tarjeta `--warn-tint` radio 14px con borde `--hairline`, ícono en cuadrado 30px radio 9px, título 13px peso 600 `--warn`, lista de grupos en 12px `--ink2` y el cierre “Ábrelos y usa «Fusionar con…»” en 12px peso 600 `--warn`.
- **Filas (64px)**: `ProveedorAvatar` pasa a **radio 10px** (ya no `rounded-xl` de 12) manteniendo su paleta `COLORS` y la imagen cuando existe; nombre 15px peso 500; “N compras recientes” 12px `--muted`; inactivos con `opacity .55`.

### 9. Ajustes — `src/features/ajustes/Ajustes.tsx`

- Barra superior con eyebrow (nombre del local), título 20px y botón “Salir” 40px con borde.
- **Pestañas**: mismas píldoras de Historial (activa `--ink`); se mantienen los seis destinos y el scroll horizontal, **sin íconos**.
- **Tarjeta de acceso a Proveedores**: radio 14px, cuadrado de ícono 40px radio 11px en `--brand-tint`/`--brand`.
- **Secciones**: se agrupan bajo eyebrows (“Operación”, “Aplicación”). `Fila` pasa a `min-height 60px`, etiqueta 15px peso 500, `hint` 12px `--muted`.
- **Campos**: `input` dentro de filas con fondo `--soft`, borde `--hairline`, radio 10px, alto 38px, `text-right`; los numéricos (fondo de caja, hora) en Inter Tight peso 600 tabular.
- **Días de un solo turno**: los siete días pasan a **grid de 7 columnas** de 38px radio 9px; activo fondo `--ink` texto `--card`; inactivo `--card` + borde `--bd2`.
- **Apariencia**: segmented de 3 (Sistema/Claro/Oscuro) con el patrón estándar, 36px.
- **Métodos de pago**: filas de 68px con contenedor de logo 40px; acciones como **badges/botones chicos de 34px radio 9px**: “Total del día” (activo `--brand-tint`/`--brand`, inactivo borde + `--muted`) y “Activo/Inactivo” (`--pos-tint`/`--pos` o `--neg-tint`/`--neg`); los inactivos con nombre en `--muted` y logo a `opacity .5`. Las flechas de orden se mantienen (38px) en escritorio; en móvil pueden quedar tras un menú.
- **Papelera**: filas de 68px, “Restaurar” con borde `--bd2` y el ícono de basurero en `--neg` (34px).

---

## Interactions & Behavior

Sin cambios funcionales. Lo que sí queda definido por el rediseño:

- **Estados de toque**: fila de lista → `active` con fondo `--soft`; botón primario → `hover` `--brand-hover`; secundario → `hover` fondo `--soft`. Nada depende solo del color para comunicar estado (siempre hay texto o ícono).
- **Foco**: se mantiene `:focus-visible { outline: 2px solid var(--brand) }` de `styles.css`, ahora indigo.
- **Segmented**: la opción activa es un `<button aria-pressed>` (o `role="radio" aria-checked`) con fondo `--card` + sombra; la transición es solo de color (`transition-colors`), sin deslizamiento.
- **Hojas**: se conserva todo el comportamiento de `BottomSheet` (`showModal`, arrastre para cerrar, foco atrapado, `prefers-reduced-motion`).
- **Teclado encadenado**: igual que hoy — aceptar salta al método siguiente, “Guardar y volver” cierra; el botón dice “Omitir y seguir” cuando el monto es 0.
- **Responsive**: móvil primero (390px de referencia); a `md` (768px) aparece la sidebar, desaparece el bottom nav y el contenido va centrado con `max-w-2xl` (Hoy/Cerrar turno) o `max-w-3xl` (Análisis/Historial/Proveedores/Ajustes). Análisis en escritorio usa `grid-cols-[1.55fr_1fr]` para gráfico + columnas laterales.
- **Accesibilidad**: se mantienen las reglas del README de `v2` (nada bajo 12px en contenido, `text-on-solid` sobre fondos sólidos, foco visible). Contraste verificado: `--muted` 4,9:1 y `--muted2` 4,8:1 sobre `--card`.

## State Management

Ninguna variable de estado nueva. El rediseño no agrega ni quita lógica: `useTurnoForm`, `useResumenDia`, `useTurnosDia`, `useBorradores`, `useCatalogo`, `useConfig`, `useMetodos`, `useTrabajadores`, `usePapelera` y el store de sesión quedan idénticos.

Dos detalles de presentación que leen datos ya disponibles:
- En Hoy, la fórmula del efectivo esperado muestra `fondo_inicial`, `efectivo` y proveedores en efectivo — los tres ya vienen en `v_resumen_dia` / `v_turnos`.
- En Hoy, “Turnos 1 de 2” se deriva de `turnos.length` y de `config.diasTurnoUnico` (ya calculado ahí para `diaUnico`).

## Assets

- **Logos de métodos de pago**: `v2/public/metodos/{getnet,mercadopago,edenred,amipass}.png` — los mismos archivos que ya usa `MetodoLogo`. No se crearon nuevos.
- **Íconos**: todos salen de `src/components/Icon.tsx` (mismos `path`). El FAB usa `cash`; el CTA de tarde usa `moon`. No hay íconos nuevos que dibujar.
- **Tipografías**: Inter e Inter Tight. El proyecto aloja las fuentes con `@fontsource`, así que:
  ```sh
  cd v2
  pnpm remove @fontsource/hanken-grotesk @fontsource/instrument-serif   # los que estén instalados
  pnpm add @fontsource-variable/inter @fontsource-variable/inter-tight
  ```
  y en `src/main.tsx` reemplazar los imports de fuentes por `@fontsource-variable/inter` y `@fontsource-variable/inter-tight`.
- **Avatares de proveedor**: se mantiene la paleta `COLORS` de `ProveedorAvatar.tsx`; solo cambia el radio a 10px.

## Files

En este bundle:

- `Rediseño Fintech.dc.html` — el diseño objetivo (todas las pantallas, incluido oscuro y escritorio).
- `Estado actual (recreación).dc.html` — la línea base recreada desde el repo, para comparar.
- `support.js` — runtime necesario para abrir los dos HTML en el navegador (ambos lo cargan como `<script src="support.js">`; deben quedar en la misma carpeta).
- `styles.tokens.css` — el bloque de tokens listo para pegar en `v2/src/styles.css` (claro, oscuro, `@theme` y utilitarios).
- `PLAN_CLAUDE_CODE.md` — plan de trabajo por archivo, en orden, pensado para pegárselo a Claude Code.

En el repo, archivos que toca el rediseño: `v2/src/styles.css`, `v2/src/main.tsx`, `v2/src/components/{Layout,PageHeader,Amount,Ledger,MetodoLogo,ProveedorAvatar,BottomSheet,Keypad,AvatarMenu,DeltaBadge}.tsx`, `v2/src/features/hoy/Hoy.tsx`, `v2/src/features/turno/{CerrarTurno,MontoSheet,ConteoSheet,RevisionSheet}.tsx`, `v2/src/features/planilla/Planilla.tsx`, `v2/src/features/analisis/Analisis.tsx`, `v2/src/features/historial/Historial.tsx`, `v2/src/features/proveedores/Proveedores.tsx`, `v2/src/features/ajustes/Ajustes.tsx`.

No se toca: rutas, `api.ts`, `useTurnoForm`, `totales.ts`, `format.ts`, migraciones, funciones de Supabase ni los tests (salvo que algún test dependa de un texto que no cambia — no debería).
