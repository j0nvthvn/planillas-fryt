# Plan de trabajo para Claude Code

Pégale este archivo (o los pasos de a uno) a Claude Code dentro del repo. El orden importa: los pasos 1–3 hacen que **toda** la app cambie de piel de golpe, y los siguientes son ajustes por pantalla que se pueden verificar uno a uno.

Contexto que conviene darle en el primer mensaje:

> Estamos repintando la UI de `v2/` (Vite + React 19 + TS + Tailwind v4, tokens en `src/styles.css`). Hay un handoff en `design_handoff_rediseno_fintech/` con `README.md` (especificación completa), `styles.tokens.css` (tokens listos) y dos HTML de referencia. **No cambies lógica, rutas, queries ni textos de dominio**: es un cambio de tokens y de layout de presentación. Antes de commitear: `cd v2 && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

---

## Paso 1 — Fuentes

```sh
cd v2
pnpm remove @fontsource/hanken-grotesk @fontsource/instrument-serif
pnpm add @fontsource-variable/inter @fontsource-variable/inter-tight
```

En `src/main.tsx`, reemplazar los imports de fuentes por:

```ts
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
```

(Si los paquetes de fuentes actuales tienen otro nombre, borrar los que estén y dejar solo estos dos. Grep: `@fontsource`.)

## Paso 2 — Tokens

Reemplazar en `src/styles.css` los bloques `:root`, `html.dark`, `@theme inline` y los `@utility` por los de `design_handoff_rediseno_fintech/styles.tokens.css`. Mantener intactos: `@import "tailwindcss"`, `@custom-variant dark`, `@page`/`@media print`, `@layer base`, `@layer components` (`.pb-nav`, `.above-nav`, `.app-shell`) y los `@keyframes`.

Notas:
- Hay un token nuevo, `--hairline-strong` (`#DFE2E8` / `#2E343E`), para bordes de botón secundario y campos. Se expone como `border-hairline-strong`.
- Hay utilitarios nuevos: `badge`, `segmented`, `segmented-item`, `segmented-item-on`, `row`, `tile`. Usarlos en los pasos siguientes en vez de repetir clases.
- `amount` deja de ser serif: con este cambio todas las cifras grandes de la app ya quedan en Inter Tight tabular.

**Verificación**: `pnpm dev` y recorrer las pantallas. Debe verse gris/blanco/indigo, sin nada café y sin serif. Lo que se vea raro son los pasos 3–10.

## Paso 3 — Shell (`src/components/Layout.tsx`)

- Bottom nav: quitar la píldora `bg-brand-tint` detrás del ícono; activo = ícono + label en `text-brand` peso 600 y `stroke 2.1`; inactivo `text-muted`. Ícono 21px, label 11px, `min-h-[58px]`, `gap-1`.
- FAB: cuadrado redondeado (`w-[58px] h-[58px] rounded-[19px]`), `border-[3px] border-card`, `bg-brand`, ícono `cash` en vez de `plus`, **sin el texto “Cerrar caja”** debajo (mantener `aria-label`), sombra `0 8px 20px -6px rgba(79,70,229,.5)`.
- Sidebar: ancho 236px; ítem activo `bg-brand-tint text-brand font-semibold`; header con borde inferior; en `AvatarMenu variante="bloque"`, avatar cuadrado `w-[34px] h-[34px] rounded-[10px] bg-soft border border-hairline text-ink2`.
- `AvatarMenu variante="avatar"` (Hoy): `w-10 h-10 rounded-[12px] bg-soft border border-hairline text-ink2 text-sm font-semibold` con las iniciales.

## Paso 4 — `PageHeader`, `Amount`, `Ledger`, `MetodoLogo`, `ProveedorAvatar`

- `PageHeader`: título `font-display text-[20px] font-semibold tracking-[-0.02em] text-ink` (ya no `text-amount-sm` serif); eyebrow en `text-muted` (sin `text-brand`).
- `Amount`: variantes → `hero: text-hero`, `card: text-amount-sm`, `inline: text-base`, `sm: text-sm`; el color por defecto pasa a `ink`.
- `Ledger`: quitar `border-t-2 border-brand`. `LedgerHead` → `text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted2`, sin borde y sin el `$` de la derecha. `LedgerLine` → `min-h-[40px]`, etiqueta `text-sm text-ink2`, valor `text-sm font-medium tabular-nums`, `border-b border-hairline`. `LedgerTotal` tamaño `lg` → franja: `bg-soft border-t border-hairline px-[18px] py-3.5`, etiqueta `text-sm font-semibold`, cifra `amount text-2xl`.
- `MetodoLogo`: caja `tile` (40px, radio 10px, borde `hairline`, fondo `card`), imagen 30px `object-contain`; **eliminar el punto verde `active`** (el monto ya comunica que hay valor) y el prop si queda sin uso.
- `ProveedorAvatar`: radio a `rounded-[10px]`; tamaño `md` sigue 40px, `sm` 36px.

## Paso 5 — Hoy (`src/features/hoy/Hoy.tsx`)

Seguir el README §2. Puntos que Claude Code suele pasar por alto:
- La fecha va arriba como eyebrow y “Hoy” abajo como título.
- El neto va en **`text-ink`**, no en verde; el color vive en el `DeltaBadge`.
- La fila de tres columnas (Ventas / Proveedores / Turnos) usa divisores `w-px bg-hairline`, no bordes.
- La fórmula del efectivo esperado ahora muestra los montos reales (fondo, efectivo, proveedores en efectivo).
- Las cinco barras por método se reemplazan por **una barra apilada** de 6px arriba de la lista, y la lista muestra máx. 3 métodos + fila “Ver los N métodos”.
- `EstadoChip` → utilitario `badge` con los pares tint/color; sin `uppercase`.

## Paso 6 — Cerrar turno (`src/features/turno/CerrarTurno.tsx`)

README §3. Orden sugerido: barra superior → segmented de modo (sin íconos) → segmented de trabajadores → lista de ventas (`row` + `tile`) → proveedores (avatar de iniciales + badge de forma de pago + monto en `text-neg` con signo) → caja (fila destacada `bg-soft` + badge de descuadre) → barra fija (cifra 24px + punto de estado).

## Paso 7 — Hojas (`BottomSheet`, `MontoSheet`, `Keypad`, `ConteoSheet`, `RevisionSheet`)

README §4. Empezar por `BottomSheet` (fondo `bg-card`, radio 28px, handle, botón de cerrar `bg-soft`) porque las tres hojas heredan de ahí; después `Keypad` (teclas 54px radio 15px con borde, aceptar 50px radio 14px) y los displays de monto (`bg-soft` + borde, cifra 40px).

## Paso 8 — Planilla (`src/features/planilla/Planilla.tsx`)

README §5. El grueso ya lo resuelve el nuevo `Ledger` del paso 4; acá va la barra superior, la tarjeta resumen con la fila de tres columnas y los botones de acción (40px radio 10px con borde; “Eliminar” en `text-neg` al final).

## Paso 9 — Análisis (`src/features/analisis/Analisis.tsx`)

README §6. Cuidado con recharts: barras `fill="var(--ink)"`, negativos `var(--neg)`, días con borrador `var(--warn)`, `radius={[5,5,0,0]}`, `CartesianGrid stroke="var(--hairline)"` sin `strokeDasharray`, y `ReferenceLine` punteada en `var(--brand)` para el promedio. En móvil los cuatro KPIs van en **una tarjeta partida 2×2 con bordes**, no en cuatro tarjetas.

## Paso 10 — Historial, Proveedores, Ajustes

README §7, §8 y §9. Las tres comparten: barra superior `bg-card` con borde inferior, píldoras de filtro/pestaña de 34px radio 9px con la activa en `bg-ink text-card`, y filas de 64–72px. En Ajustes, los campos de `Fila` pasan a `bg-soft` con borde y los días de turno único a grid de 7.

---

## Criterios de aceptación

- No queda ningún valor café/crema ni `Instrument Serif` en `v2/src` (`grep -ri "5C3317\|FBF6EC\|F5EAD4\|instrument serif\|hanken" v2/src` sin resultados).
- Ninguna cifra monetaria sin `tabular-nums`.
- Modo oscuro revisado pantalla por pantalla (el toggle vive en Ajustes → Apariencia).
- Objetivos de contraste: texto normal ≥ 4,5:1 sobre su fondo; los grises permitidos para texto son `--muted` y `--muted2` (nada más claro).
- Áreas tocables ≥ 44px (filas de lista 64px; controles de conteo 42px es el único caso menor y es intencional porque van en pares con la casilla).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde, y `pnpm e2e` (Playwright, flujo de cierre contra staging) sin cambios de selectores.
