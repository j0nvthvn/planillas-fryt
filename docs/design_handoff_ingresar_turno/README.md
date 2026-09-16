# Handoff: Ingresar turno (Planilla Caja Fryt)

## Overview
Rediseño del flujo diario de **Ingresar turno**: el trabajador, al cierre de su turno
(mañana/tarde), registra los **proveedores** pagados (nombre, monto, efectivo o
transferencia) y las **ventas** por método de pago. Reemplaza la tabla de 12 filas fijas
de la versión actual por un flujo móvil-primero más rápido: proveedores agregados de a uno
desde una hoja inferior, buscador de frecuentes, teclado tipo calculadora, montos con
separador de miles y total siempre visible.

El enfoque elegido es el **A — Lista + hoja inferior** (de tres explorados). Acento de marca
seleccionado: **Ciruela `#7A4F86`**.

## About the Design Files
Los archivos en `reference/` son **referencias de diseño hechas en HTML** (prototipos que
muestran el look & feel y el comportamiento), **no** código de producción para copiar tal
cual. Están construidos con React + Babel inline y estilos en línea, dentro de un marco de
iPhone simulado. La tarea es **recrear este diseño dentro del codebase real** (React + Vite +
Tailwind + Supabase) usando sus patrones existentes.

Para ahorrar trabajo se incluye **`Turno.jsx`**, una implementación de producción ya adaptada
al stack (Tailwind + `useAuth` + `supabase` + utilidades de `format.js`), pensada como
**reemplazo directo** de `src/pages/Turno.jsx`. Revísala y pruébala antes de hacer merge — no
pudo ejecutarse contra tu entorno real.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado e interacciones son finales.
La referencia usa la fuente *Schibsted Grotesk*; en la app puedes mantener la fuente del
sistema/Tailwind o sumar Schibsted Grotesk si quieres calzar 1:1.

---

## Cambio de base de datos (REQUERIDO)
El diseño agrega **Mercado Pago** como método de venta (máquina de tarjetas, igual que Getnet).
La tabla `ventas_turno` **no** tiene esa columna. Corre la migración incluida antes de usar el
nuevo `Turno.jsx`:

```
design_handoff_ingresar_turno/002_add_mercadopago.sql
```
```sql
alter table public.ventas_turno
  add column mercadopago numeric not null default 0 check (mercadopago >= 0);
```
Recuerda también incluir `mercadopago` en cualquier vista/consulta de reportes (Resumen,
Dashboard) que sume métodos de venta.

---

## Screens / Views

### 1. Principal — Ingresar turno
- **Propósito:** capturar proveedores y ventas del turno.
- **Layout:** columna única centrada (`max-w-lg mx-auto`), scroll vertical, con una **barra
  inferior fija** (total + Guardar). Deja un espaciador de ~80px al final para que la barra
  fija no tape contenido.
- **Componentes (de arriba a abajo):**
  - **Fecha** — texto pequeño gris, capitalizado (`fechaLegible(hoy())`).
  - **Título** "Ingresar turno" — 24px, bold, `text-gray-900`.
  - **Selector de turno** — segmented control de 2 (Mañana/Tarde) con íconos sol/luna.
    Fondo `bg-gray-100`, pastilla activa blanca con sombra. Radio 12px.
  - **Aviso turno existente** (condicional) — banner ámbar si ya existe ese turno hoy.
  - **Sección Proveedores:**
    - Encabezado "PROVEEDORES" (uppercase, 12px, gris) + contador a la derecha en color acento.
    - Estado vacío: botón punteado de alto generoso, "Agrega el primer proveedor" + ícono +.
    - Con datos: tarjeta con filas (divididas por línea). Cada fila: punto de color
      (verde=efectivo, navy=transferencia) · nombre (15px medium) + forma de pago (12px gris)
      · monto (bold, tabular) · chevron. Toda la fila es tocable → abre hoja de edición.
    - Botón "Agregar proveedor" en color acento tenue (`#EFEFE F2` bg, `#7A4F86` texto).
  - **Sección Ventas del turno:** tarjeta con 5 filas tocables (Efectivo, Getnet,
    **Mercado Pago**, Edenred, Transferencia). Cada fila: label + subtítulo · monto (gris
    tenue si 0) · chevron. Toca → abre hoja de teclado.
- **Barra inferior fija:** "Total ventas del turno" (12px gris) + monto (24px bold, tabular)
  a la izquierda; botón **Guardar** (acento, 48px alto) a la derecha. Deshabilitado mientras
  guarda o si el turno ya existe.

### 2. Hoja inferior — Agregar/Editar proveedor
- **Disparador:** botón "Agregar proveedor" o tocar una fila existente.
- **Layout:** bottom sheet (radio superior 24px, sombra fuerte, animación slide-up 0.26s),
  fondo oscurecido (`bg-black/30`) que cierra al tocar fuera.
- **Componentes:**
  - Tirador (barra gris 36×4) centrado.
  - Título ("Agregar/Editar proveedor") + en edición, botón borrar (rojo) y botón cerrar (X).
  - **Campo buscador** con ícono de tienda a la izquierda, placeholder "Buscar o escribir
    proveedor". Es el nombre y a la vez filtra los chips.
  - **Chips de frecuentes** en **una sola fila horizontal deslizable** que se **filtra** según
    lo escrito. Chip ya usado en este turno: relleno acento tenue + check.
  - **Display de monto** grande (40px, tabular) sobre fondo gris suave; color según forma de
    pago (verde/navy).
  - **Toggle Efectivo / Transferencia** (2 botones con ícono; activo coloreado).
  - **Teclado tipo calculadora**: grilla 3×4 (7 8 9 / 4 5 6 / 1 2 3 / 000 0 ⌫) + botón de
    confirmación de ancho completo en color acento ("Agregar proveedor"/"Guardar cambios"),
    deshabilitado si el monto es 0.

### 3. Hoja inferior — Monto de venta
- Igual que la anterior pero solo display de monto + teclado; botón "Listo".

### 4. Pantalla de éxito
- Check en círculo (acento tenue), "Turno guardado", subtítulo "{tipo} · {fecha}".
- Tarjeta resumen: Ventas del turno, Efectivo a proveedores (verde), Transferencia a
  proveedores (navy).
- Lista de proveedores ingresados (nombre + monto coloreado por forma de pago).
- Botón secundario "Ingresar otro turno" (resetea el formulario).

---

## Interactions & Behavior
- **Agregar de a uno:** no hay filas fijas. La lista parte vacía y crece con cada proveedor.
- **Buscar/filtrar:** escribir en el campo nombre filtra los chips frecuentes en vivo
  (case-insensitive, `includes`).
- **Teclado:** cada tecla muta un string de dígitos; `000` agrega tres ceros; `⌫` borra el
  último; el monto se formatea con separador de miles al mostrarse (`clp`).
- **Editar/borrar:** tocar una fila de proveedor abre la hoja en modo edición con botón borrar.
- **Validación al guardar:** si no hay proveedores válidos NI ventas, pide confirmación
  (`window.confirm`) antes de guardar vacío. Si el turno ya existe para hoy, bloquea y avisa.
- **Animación:** la hoja entra con slide-up (0.26s, `cubic-bezier(.2,.8,.2,1)`); cursor
  parpadeante opcional en el display (presente en la referencia HTML, omitido en `Turno.jsx`).
- **Responsive:** móvil-primero; en escritorio queda centrado (`max-w-lg`). La barra de total
  es fija al fondo.

## State Management
- `tipo`: `'mañana' | 'tarde'`.
- `provs`: `Array<{ nombre: string, monto: number, forma_pago: 'efectivo'|'transferencia' }>`.
- `ventas`: `{ efectivo, getnet, mercadopago, edenred, transferencia }` (numbers).
- `sugerencias`: `string[]` desde `proveedores_frecuentes`.
- `sheet`: `null | { mode:'prov', idx, nombre, monto, forma_pago } | { mode:'venta', key, monto }`.
- `turnoExistente`, `guardando`, `error`, `exito`.
- **Datos:** se conserva 1:1 la lógica de Supabase de la versión actual:
  - `useEffect([tipo])` verifica si ya existe el turno (jornada→turno).
  - `useEffect([])` carga proveedores frecuentes.
  - `guardarTurno()`: obtiene/crea `jornadas` → crea `turnos` → inserta `proveedores_turno`
    válidos → upsert en `proveedores_frecuentes` → inserta `ventas_turno` (ahora con
    `mercadopago`). Maneja error `23505` (turno duplicado).

## Design Tokens
**Colores**
| Token | Hex | Uso |
|---|---|---|
| Acento (Ciruela) | `#7A4F86` | acción, total, contador, confirmar, chips usados |
| Acento tenue | `#EFE6F2` | fondos de botón/chip acento |
| Efectivo (verde) | `#1E7A4F` | punto/monto efectivo, toggle |
| Efectivo tenue | `#E6F1EA` | toggle efectivo activo |
| Transferencia (navy) | `#33518C` | punto/monto transferencia, toggle |
| Transferencia tenue | `#E8EDF6` | toggle transferencia activo |
| Tinta | `#191B1F` | texto principal |
| Tinta suave | `#4A4D54` | texto secundario / chips |
| Gris medio | `#8C8E88` | subtítulos, labels |
| Gris tenue | `#B7B9B2` | placeholders, montos en 0 |
| Línea | `rgba(22,24,28,.09)` | bordes/divisores |

> En `Turno.jsx` el acento se define como constante (`ACCENT`, `ACCENT_TINT`). Si prefieres,
> muévelo a `tailwind.config.js` como color `marca` y reemplaza las clases arbitrarias.

**Tipografía** — escala: título 24px/bold · monto barra 24px/bold · display monto 40px/600 ·
filas 15px/medium · subtítulos 12px · labels de sección 12px uppercase. Números siempre
`tabular-nums`.

**Radios** — tarjetas 12px (`rounded-xl`), teclas/hoja 16–24px, chips/toggles full o 12px.
**Sombras** — `shadow-sm` en tarjetas; sombra fuerte en la hoja inferior.

## Assets
Sin imágenes. Todos los íconos son SVG inline de stroke (componente `Icon` en `Turno.jsx`:
plus, check, trash, chevR, close, store, cash, bank, sun, moon). No requieren librerías nuevas.

## Files
- `Turno.jsx` — **implementación de producción** (drop-in para `src/pages/Turno.jsx`).
- `002_add_mercadopago.sql` — migración requerida.
- `reference/Ingresar turno (Enfoque A).html` — prototipo del enfoque elegido (+ panel de
  Tweaks: acento, tipografía, ambiente claro/oscuro). Ábrelo en el navegador para ver el
  comportamiento real.
- `reference/Ingresar turno - 3 enfoques.html` — los 3 enfoques explorados lado a lado.
- `reference/kit.jsx`, `approachA.jsx`, `approachB.jsx`, `approachC.jsx`, `ios-frame.jsx`,
  `tweaks-panel.jsx` — fuentes del prototipo (referencia visual; no son código de la app).

### Cómo integrar
1. Corre la migración `002_add_mercadopago.sql` en Supabase.
2. Respalda tu `src/pages/Turno.jsx` actual y reemplázalo por el de este bundle.
3. Verifica que existen `../hooks/useAuth`, `../lib/supabase`, `../components/Layout` y las
   utilidades `clp, hoy, fechaLegible, parseNum` en `../utils/format` (ya están en tu repo).
4. Revisa que las pantallas de reportes (Resumen/Dashboard) incluyan `mercadopago` al sumar.
5. Prueba: crear turno con/sin proveedores, editar/borrar, turno duplicado, guardar.
