# Auditoría de accesibilidad y UI de la v2 (17 de septiembre de 2026)

Revisión de `v2/` en la rama `rediseno-fintech`, después del rediseño Fintech.
Se comparó contra el handoff (`docs/design_handoff_rediseno_fintech/README.md`)
y contra WCAG 2.2 AA. **Cuando la accesibilidad chocó con el handoff, ganó la
accesibilidad** (decisión del usuario). Los arreglos están en cuatro commits:
tokens y contraste, accesibilidad, consistencia y colores de método.

## Cómo se verificó

- Contraste calculado con la fórmula WCAG sobre los tokens de `styles.css`.
- axe (`@axe-core/playwright`) en Hoy, Cerrar turno, Historial, Análisis,
  Proveedores y Ajustes, en claro y oscuro, más la hoja del teclado:
  - antes: **15 fallas de contraste serias** y 1 `aria-hidden-focus` (el SVG
    enfocable de recharts dentro de un contenedor oculto);
  - ahora: **0 violaciones**.
  - Queda como `e2e/a11y.spec.ts`, que falla con violaciones serias o críticas.
- Capturas lado a lado antes/después con Playwright: Pixel 7, 320 px y
  escritorio, en claro y oscuro.
- Teclado: el primer Tab lleva a «Saltar al contenido», las flechas cambian
  los radios, al navegar el foco va al contenido y Escape cierra las hojas
  devolviendo el foco al botón que las abrió.
- `pnpm lint`, `typecheck`, `test`, `build` y `e2e` en verde.

## Contraste de los tokens (antes → ahora)

| Par (texto / fondo) | Claro | Oscuro |
|---|---|---|
| `muted` / `card` | 4,97 → 5,35 | 6,92 |
| `muted` / `soft` (segmented inactivo, placeholder, «Pendiente») | **4,48** → 4,81 | 6,28 |
| `muted2` / `card` | 4,83 → 5,67 | 4,72 → 5,46 |
| `muted2` / `soft` | **4,35** → 5,10 | **4,29** → 4,96 |
| `muted2` / `warn-tint` | **4,37** → 5,13 | **4,13** → 4,78 |
| `neg` / `neg-tint` (badge «Descuadre») | **4,23** → 5,02 | 6,31 |
| `neg` / `card` | 4,83 → 5,74 | 6,61 |
| blanco / `neg` (botón peligro, aviso de error) | 4,83 → 5,74 | 7,23 |
| `pos` / `pos-tint` | 4,85 | 7,95 |
| `warn` / `warn-tint` | 4,54 | 9,33 |
| `brand` / `brand-tint` | 5,55 | 5,62 |
| `control-border` / `card` (contorno de campos, 1.4.11) | nuevo: 3,17 | nuevo: 3,68 |

Valores nuevos:
- claro: `--muted #626B7F`, `--muted2 #5F6779`, `--neg #C81E1E`;
- oscuro: `--muted2 #878F9D`;
- `--control-border` nuevo;
- `--image-bg` en oscuro deja de ser café (`#322D26`) y pasa a `#F3F4F6`: los
  logos PNG son para fondo claro, igual que ya hacía `MetodoLogo`.

## Qué se arregló

**Tipografía y escala**
- `--text-md` (14 px) y `--text-xl` (20 px) nuevos.
- Los 58 `text-[13px]`, `text-[15px]` y `text-[20px]` pasan a tokens.
- Nada bajo 11 px: el día abreviado del Historial y las etiquetas de 10,5 px
  suben a 11 px, y el estado de guardado a 12 px.
- Se quitaron los `tracking` que pisaban `amount` y `cifra`, y las teclas del
  teclado quedan en 24 px, como pide el handoff.

**Tamaños táctiles**
- El utilitario `hit` agranda el área tocable a 44 × 44 px sin cambiar lo que
  se ve.
- Se aplica a: cerrar de hojas y avisos, píldoras, acciones de Ajustes,
  flechas de Planilla, volver, ± del conteo, segmented bajos, «vs. ayer»,
  «Ver planilla» y los enlaces de borradores.

**Lectores de pantalla**
- Hojas: `aria-labelledby` al título (`h2`).
- Confirmaciones: `alertdialog`, con el mensaje enlazado y el foco en Cancelar.
- Regiones vivas estables: avisos (toasts), estado de guardado, banners de
  versión nueva y sin conexión, sugerencias de proveedor.
- El monto se anuncia al dejar de teclear (`useAnuncio`), no dígito a dígito.
  El conteo anuncia también la diferencia, y el teclado encadenado, el paso
  («Getnet, 2 de 6»).
- Radios con flechas y una sola parada de Tab (`useRovingRadio`): forma de
  pago, ¿contaste la caja?, total/tarde y apariencia.
- «Quién atendió» pasa a botones `aria-pressed`, porque se puede desmarcar.
  Ajustes navega con enlaces `aria-current` (antes era un `tablist` sin
  paneles).
- Nombres que dicen de qué fila hablan: «Subir Getnet», «Borrar
  definitivamente 12 sept», «Activar a Camila». Las etiquetas accesibles
  coinciden con el texto visible.
- Estado que solo iba por color:
  - sube/baja en `DeltaBadge`;
  - forma de pago en compras y correcciones;
  - destino de fusión elegido;
  - proveedor ya agregado;
  - leyenda del gráfico también en el celular (borrador y negativo);
  - «antes/ahora» en la corrección.
- Encabezados `h2` en Hoy y Análisis. Skip link, foco al contenido y título de
  pestaña por pantalla.
- Login con `aria-invalid` y `aria-describedby` en los campos. Formulario de
  cuentas con etiquetas visibles y «Mínimo 8 caracteres» enlazado.
- Los avisos con acción («Ver papelera») duran 10 s y se pausan con el dedo,
  el puntero o el foco.

**Consistencia**
- `btn-lg` (50 px), `btn-bar` (barra superior), `aviso`, `badge-sm` y
  `AvisoAmbar` en lugar de clases repetidas.
- Radios fuera de escala corregidos (22, 20, `rounded-lg`/`xl`, botones
  circulares).
- Sombras del FAB y de la barra fija como tokens por tema. `--sidebar-w`
  compartido entre la barra lateral y la barra fija.
- Avatares de proveedor sin café (todos a 5:1 o más con la inicial blanca).
- Hoy y el conteo a 320 px sin cifras cortadas.

**Base de datos**
- La migración `20260919000000_colores_metodos_fintech.sql` cambia efectivo,
  getnet y transferencia a la paleta nueva, solo si siguen con el color de la
  semilla.
- Aplicada en staging y en prod el 17 de septiembre (prod con respaldo previo
  de `metodos_pago`). La app actual no lee esa columna.

## Pendiente o decidido no hacer

- **Íconos de la PWA y `favicon.svg`.** Son el logo real del local (espigas,
  «Fryt»), no un resto del tema. Cambiarlos es decisión de la dueña.
- **Plantillas de correo** (`enviar-resumen-*`). Siguen con encabezado café:
  solo cambiaron los colores de método. Rediseñarlas afecta también los
  correos de la app actual.
- **`user-select: none` global.** Se mantiene (decisión anterior: para llevarse
  datos está Compartir). Tiene un costo: no se puede copiar un mensaje de error
  ni usar «Traducir» al mantener presionado en iOS.
- **Campos de Ajustes de 38 px.** Son campos anchos (el objetivo AA 2.5.8 es
  24 px) y se dejaron con el alto del diseño.
- **Borde punteado del turno «Pendiente».** Usa `hairline-strong`, no el
  `hairline` del handoff, que casi no se ve.
- **`/dia` sin `?fecha=`** muestra el error crudo del router (en inglés). No es
  de esta revisión: conviene un valor por defecto o un `errorComponent`.
- **Probar con VoiceOver** (iOS) y TalkBack en un celular real.
