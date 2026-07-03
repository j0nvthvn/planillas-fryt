# Rediseño "Cálido Editorial" 1a — Planilla Fryt

**Fecha:** 2026-07-03
**Estado:** Borrador pendiente de aprobación
**Alcance de esta iteración:** Tema claro únicamente (dark mode queda como fallback neutro).

## 1. Contexto y motivación

El handoff de diseño en `design_handoff_rediseno_1a/` define un rediseño completo de Planilla Fryt (móvil-first) con la dirección "Cálido Editorial". Resuelve tres problemas concretos del producto actual:

1. **Duplicación de información** entre "Resumen del día" y "Dashboard".
2. **Navegación confusa** (5 tabs + "Más").
3. **Baja jerarquía** de las cifras clave (el neto no destaca).

El objetivo es implementar este rediseño en el stack actual (React + Vite + Tailwind + Supabase), reutilizando componentes, hooks y queries ya existentes.

## 2. Cambios de arquitectura de información

### Navegación: 5 + "Más" → 4 destinos + menú avatar

| Antes | Ahora | Ruta | Rol |
|---|---|---|---|
| Turno | **Ingresar** | `/turno` | Captura rápida del turno |
| Resumen del día (tab) | **Hoy** (home) | `/hoy` | Estado del día actual de un vistazo |
| Dashboard | **Análisis** | `/analisis` | Tendencias multi-día |
| Historial | **Historial** | `/historial` | Lista de jornadas |
| Más (tab) | Menú del avatar | (bottom sheet) | Proveedores / Usuarios / Config / Cerrar sesión |

- **Trabajador:** solo ve **Hoy** e **Ingresar**.
- **Dueño:** ve los 4 destinos; el menú avatar contiene el resto.
- Login navega a `/hoy` (no `/turno`).
- **Hoy** muestra `Resumen.jsx` con `fecha = hoy()` (sin navegación de fechas).
- **Detalle por fecha** (antes el cuerpo de `Resumen.jsx`) se abre desde Historial → tocar un día, pasando `fecha` y `onBack`.

### Rutas nuevas / cambios

| Ruta | Página | Notas |
|---|---|---|
| `/login` | `Login.jsx` (reestilizado) | Sin cambios estructurales |
| `/hoy` | **nuevo** `Hoy.jsx` | Resumen del día actual; el actual `Resumen.jsx` con `fecha=hoy()` y sin onBack |
| `/turno` | `Turno.jsx` (reestilizado) | "Ingresar turno" |
| `/analisis` | **nuevo alias** | Apunta a `Dashboard.jsx` (o renombrar a `Analisis.jsx`) |
| `/historial` | `Historial.jsx` (reestilizado) | Lista de jornadas + "Registrar un día anterior" |
| `/resumen` (con prop `fecha`) | `Resumen.jsx` (reestilizado) | Detalle histórico, abierto desde Historial |
| `/proveedores`, `/usuarios`, `/configuracion` | (sin cambios funcionales) | Alcanzables desde menú avatar |

> Las URLs viejas (`/resumen`, `/dashboard`) se mantienen como **redirects** a las nuevas para no romper bookmarks/back.

## 3. Design tokens

### Colores (hex exactos, claros)

| Token | Hex | Uso |
|---|---|---|
| `brand` | `#5C3317` | Primario, títulos de marca, botones, nav activa |
| `brand-hover` | `#4A2810` | Hover primario |
| `brand-tint` | `#F5EAD4` | Fondos activos, pills de nav, chips |
| `canvas` | `#FBF6EC` | Fondo app (body) |
| `card` | `#FFFFFF` | Superficie tarjetas |
| `hairline` | `#F0E7D6` | Bordes tarjetas / divisores fuertes |
| `hairline-soft` | `#F6EFE1` | Divisores internos |
| `ink` | `#2A211A` | Texto principal |
| `ink-2` | `#5F5245` | Texto secundario |
| `muted` | `#9C8B78` | Texto terciario |
| `muted-2` | `#B3A48F` | Placeholders, iconos inertes |
| `pos` | `#1E7A4F` | Montos positivos / neto / efectivo |
| `pos-tint` | `#E6F1EA` | Fondos verdes suaves |
| `neg` | `#B91C1C` | Montos negativos / proveedores |
| `neg-tint` | `#fbe9e9` | Fondos rojos suaves |
| `wire` | `#33518C` | Transferencia |
| `wire-tint` | `#E8EDF6` | Fondo azul suave |

### Tipografía

- **Body/UI:** `Hanken Grotesk` 400/500/600/700/800 (reemplaza Inter).
- **Display:** `Instrument Serif` regular (títulos + cifras grandes de dinero).
- Números siempre con `tabular-nums`.

### Escala

| Rol | Font | Tamaño / peso |
|---|---|---|
| Título de pantalla ("Hoy", "Análisis") | Instrument Serif | 28–34px / 400 |
| Cifra hero (neto del día) | Instrument Serif | 56px / 400 |
| Cifra de tarjeta | Instrument Serif | 18–24px |
| Eyebrow / label sección | Hanken Grotesk | 10–12px / 700, uppercase, tracking .10–.14em |
| Cuerpo / filas | Hanken Grotesk | 13–15px / 400–600 |
| Nav labels | Hanken Grotesk | 10px / 600 (700 activo) |

### Forma y elevación

- Radios: tarjetas `20–24px`, inputs/filas `14–15px`, pills `100px`.
- Bordes: `1px solid #F0E7D6` en tarjetas.
- Sombra hero: `0 8px 24px -14px rgba(92,51,23,.28)`. Tarjetas normales: sin sombra o `0 6px 20px -14px rgba(92,51,23,.2)`.
- Espaciado entre bloques: 12–14px. Padding tarjeta: 18–22px. Padding pantalla: 16px 22px.

### Tema oscuro (fuera de alcance)

En esta iteración, el toggle de tema oscuro seguirá funcionando pero aplicará un fallback neutro (gris oscuro básico). Refinaremos tokens `dark:` en una iteración posterior.

## 4. Componentes a crear / modificar

### Nuevos

- `src/pages/Hoy.jsx` — Resumen del día actual (wrapper de `Resumen` con `fecha=hoy()`).
- `src/pages/Analisis.jsx` — Wrapper/rebrand de `Dashboard` (mismo contenido, estilo aplicado).
- `src/components/AvatarMenu.jsx` — Bottom sheet (móvil) / popover (desktop) con Proveedores/Usuarios/Config/Cerrar sesión. Reemplaza el botón "Más" y la lógica del avatar actual.
- `src/components/Amount.jsx` — Cifra de dinero con `font-display` + `tabular-nums` + color semántico opcional. Variantes: `hero` (56px), `card` (18–24px), `inline` (15px).

### Modificados (estructura)

- `src/components/Layout.jsx` — Reducir tabs a 4 destinos; abrir `AvatarMenu` desde el avatar; quitar botón "Más" y su sheet asociado.
- `src/components/TurnoInput.jsx` — `Keypad` con botones `rounded-[15px]`, 54px alto, dígitos 23px; `BottomSheet` con `rounded-t-[30px]`, fondo `canvas`, sombra café. (El comportamiento se mantiene.)
- `src/pages/Login.jsx` — Título en `font-display` 34px `brand`. Logo circular 104px. Inputs `rounded-[14px]` borde `#E4D6BF`, fondo `canvas`, font-size 16px. Botón radio 15px.
- `src/pages/Turno.jsx` — Header `font-display`. Segmented Mañana/Tarde con contenedor `brand-tint`. Filas de método con chip de color + lápiz. Botón Guardar fijo muestra `total` en `font-display`.
- `src/pages/Resumen.jsx` — Chips mañana/tarde con `pos-tint` y borde `#b8dcc7`. Card ventas como lista (no tabla) con total en `font-display`. Botón "‹ Historial" arriba cuando hay `onBack`.
- `src/pages/Historial.jsx` — Header `font-display`. Card "Registrar un día anterior" en una sola fila (icono + label + chevron). Lista de días en card con fecha bold, chips de turno, total a la derecha en `font-display` 22px `brand`.
- `src/pages/Analisis.jsx` — Página nueva (renombre de `Dashboard.jsx` con cambios de estilo). Toggle 7/30 en contenedor `brand-tint`. Card hero `font-display` 46px `pos`. Trío de KPIs en cards tintadas. "Ventas por día" barras con Recharts. "Top proveedores" con barras de progreso. `Dashboard.jsx` se elimina (o se deja como alias de compatibilidad vía redirect).
- `src/pages/Proveedores.jsx`, `Usuarios.jsx`, `Configuracion.jsx` — Botón "‹ Volver" arriba (no usar header del shell cuando se llega desde el avatar). Aplicar tokens visuales (tarjetas, radios, etc.) sin cambiar lógica.

### Sin cambios funcionales

- `src/hooks/useAuth.jsx`, `useConfig.jsx`, `useJornadaRealtime.js`.
- `src/components/turno/*.jsx` (lógica).
- `src/lib/supabase.js`, queries Supabase.
- `src/components/Spinner.jsx`, `Toast.jsx`, `ProtectedRoute.jsx`.
- `Icon.jsx` (puede requerir 1–2 iconos nuevos: `pencil`, `back` ya existe como `arrowLeft`).

## 5. Fases de implementación

> **Verificación entre fases:** `npm run build` debe pasar. En cada fase, revisar diff y commit.

### Fase 1 — Fundación (tokens, fuentes, base components)
1. `index.html` — Reemplazar Inter por Hanken Grotesk + Instrument Serif.
2. `tailwind.config.js` — Añadir `font-display`, todos los tokens de color, `boxShadow` hero/card, `borderRadius` xl2/3xl.
3. `src/index.css` — Añadir componentes: `.card`, `.card-hero`, `.eyebrow`, `.amount`, actualizar `.btn-primary`, `.input`.
4. Crear `src/components/Amount.jsx`.
5. Verificación visual: Login con tipografía y colores nuevos (sin tocar más).

### Fase 2 — Shell de navegación + AvatarMenu
1. `src/components/Layout.jsx` — Reducir tabs a 4 (`Hoy`, `Ingresar`, `Análisis`, `Historial`). Item activo: pill `brand-tint` + `text-brand`. Quitar botón "Más" y su sheet. Quitar `PAGE_TITLES` (los títulos se renderizan dentro de cada página en `font-display`).
2. `src/components/AvatarMenu.jsx` — Bottom sheet (móvil) con Proveedores/Usuarios/Configuración + "Cerrar sesión" en rojo. Popover (desktop). Disparado desde el avatar del header.
3. `src/App.jsx` — Añadir rutas `/hoy` y `/analisis`; redirects desde `/resumen` y `/dashboard`. Login navega a `/hoy` por defecto. Lazy load de páginas admin igual que ahora.
4. Verificación: login → llegar a `/hoy` (404 si no existe la página todavía, OK); tabs se ven; avatar abre menú.

### Fase 3 — Login + Hoy + Ingresar (flujo crítico)
1. `src/pages/Login.jsx` — Aplicar tokens (logo 104px circular, título `font-display` 34px, card con borde `#EDE0C8`, inputs `rounded-[14px]`, botón radio 15px). Funcionalidad intacta.
2. `src/pages/Hoy.jsx` — Página nueva. Usa `Resumen` internamente pasando `fecha=hoy()` y sin `onBack`. Header con eyebrow "MINIMARKET FRYT" + título "Hoy" + fecha + avatar (que abre menú). Cards rediseñadas (ver §6).
3. `src/pages/Turno.jsx` (Ingresar) — Header `font-display`. Segmented Mañana/Tarde en `brand-tint`. Filas de método: chip de color 30px + label + monto en `font-display` + lápiz `muted-2`. Lista de proveedores con avatar `avatarColor`. Botón Guardar fijo con total en `font-display`.
4. `src/components/TurnoInput.jsx` — `Keypad` reestilizado: `rounded-[15px]`, 54px alto, dígitos 23px, `⌫` con fondo `#F5EFE2`. `BottomSheet` con `rounded-t-[30px]`, fondo `canvas`, sombra `0 -22px 55px -22px rgba(0,0,0,.45)`. `AmountDisplay` con `font-display` 46px.
5. Verificación: navegar Login → Hoy → Ingresar → teclado abre con método → guardar → vuelve a Hoy.

### Fase 4 — Análisis + Historial + Resumen (detalle)
1. `src/pages/Analisis.jsx` — Wrapper de `Dashboard.jsx`. Toggle 7/30 en contenedor `brand-tint`. Card hero `font-display` 46px. Trío de KPIs en cards tintadas. Barras Recharts con colores del handoff (`brand` actual, `#8B5D39` resto). Top proveedores con barras de progreso.
2. `src/pages/Historial.jsx` — Header `font-display`. Card "Registrar un día anterior" en una fila. Lista de días: `rounded-3xl`, fecha bold + chips + total `font-display` 22px `brand`.
3. `src/pages/Resumen.jsx` — Versión histórica (cuando se pasa `fecha` + `onBack`): botón "‹ Historial" arriba, fecha `muted`, título "Resumen del día" `font-display` 28px. Chips mañana/tarde en `pos-tint`. Ventas como lista con total en `font-display`. Balance con neto grande. (Reusar la mayor parte del código actual; solo aplicar tokens.)
4. Verificación: navegar Historial → tocar día → Resumen del día → volver.

### Fase 5 — Menú avatar: Proveedores, Usuarios, Configuración
1. `src/pages/Proveedores.jsx` — Botón "‹ Volver" arriba. Título "Proveedores". Botón "+" circular. Lista: avatar cuadrado `avatarColor` + nombre + "N compras · $acumulado" + chevron.
2. `src/pages/Usuarios.jsx` — Botón "‹ Volver". Lista: avatar redondo, nombre, email, badge de rol.
3. `src/pages/Configuracion.jsx` — Botón "‹ Volver". Grupos con eyebrow. Filas con divisores `hairline-soft`. Toggles con pista `brand`/`#E4D6BF` y perilla blanca 20px.
4. Verificación: desde el avatar, navegar a las 3 páginas y volver atrás.

## 6. Patrones de UI recurrentes (cheat sheet)

### Header de página
```
eyebrow  brand (11px / 700 / tracking .12em)
Title    font-display 28-34px ink
Date     muted 13-15px (debajo del título)
[avatar] 42px circular brand (a la derecha)
```

### Card base
```
bg-white, rounded-[20px], border 1px hairline, p-5
shadow card (0 6px 20px -14px rgba(92,51,23,.20))
```

### Card hero
```
.card + box-shadow 0 8px 24px -14px rgba(92,51,23,.28)
```

### Cifra de dinero
```
<Amount variant="hero|card|inline" color="pos|neg|brand|ink" value={n} />
→ renderiza font-display + tabular-nums + color semántico
```

### Bottom sheet teclado
```
overlay rgba(27,18,11,.45), touch-outside cierra
sheet canvas, rounded-t-[30px], handle
display card blanca, font-display 46px, color del método
grid 3x4: 7 8 9 / 4 5 6 / 1 2 3 / 000 0 ⌫
botones rounded-[15px] 54px, dígitos 23px
⌫ con fondo #F5EFE2
botón "Listo" full-width color del método
```

## 7. Cambios fuera de alcance (no se tocan)

- Lógica de Supabase / queries.
- Lógica de autenticación.
- Realtime / versionado de turnos.
- Tema oscuro refinado (queda fallback neutro).
- Internacionalización.
- Animaciones más allá de las existentes.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Regresión visual en páginas no tocadas | Fase 1 afecta solo tokens base; verificamos Login entre fases |
| Romper lógica de `Resumen` al dividir entre Hoy y Resumen-detalle | `Hoy` es un wrapper que pasa props; `Resumen` mantiene su API actual |
| Rutas viejas rompen navegación | Redirects `/resumen` → `/hoy` y `/dashboard` → `/analisis` |
| Build falla tras cambios de Tailwind config | `npm run build` después de cada fase |

## 9. Criterios de aceptación

- [ ] Login se ve según `screenshots/01-fryt.png`.
- [ ] Hoy muestra neto, chips mañana/tarde, efectivo en caja, CTA "Ingresar turno".
- [ ] Ingresar tiene segmented Mañana/Tarde en `brand-tint`, lista de 6 métodos, total en vivo.
- [ ] Teclado numérico abre con bottom sheet `canvas`, monto grande en `font-display`, color del método.
- [ ] Análisis tiene toggle 7/30, neto hero, KPIs tintados, gráfico de barras.
- [ ] Historial lista jornadas con chips de turno y total a la derecha.
- [ ] Tocar un día abre "Resumen del día" con botón volver.
- [ ] Avatar abre menú con Proveedores/Usuarios/Configuración + Cerrar sesión (rojo).
- [ ] Tipografía: `font-display` en títulos y cifras grandes; `font-sans` en cuerpo.
- [ ] `npm run build` pasa sin warnings.
- [ ] Navegación: tabs son 4 (no 5 + "Más"); trabajadores ven solo Hoy + Ingresar.

## 10. Orden de ejecución

1. **Fase 1** — Fundación (1 commit)
2. Verificar build + captura Login
3. **Fase 2** — Shell + AvatarMenu (1 commit)
4. Verificar build + navegar tabs
5. **Fase 3** — Login + Hoy + Ingresar (1 commit)
6. Verificar build + flujo completo
7. **Fase 4** — Análisis + Historial + Resumen (1 commit)
8. Verificar build + detalle histórico
9. **Fase 5** — Menú avatar: Proveedores + Usuarios + Config (1 commit)
10. Verificación final con capturas del handoff
