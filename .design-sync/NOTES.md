# Notas de design-sync para este repo

FrytControl es una aplicación, no una librería de componentes publicada: no hay
Storybook ni build de librería. Todo lo que sigue existe para que el conversor
(forma `package`) pueda tratar `src/components/` como sistema de diseño.

## Lo que hay que saber antes de re-sincronizar

- **Alcance**: solo los componentes autónomos de `src/components`, enumerados en
  `.design-sync/entry.tsx` y en `cfg.componentSrcMap`. Quedan fuera a propósito
  `Layout`, `SaludoHeader`, `ErrorBoundary`, `CorreccionModal` y
  `DiaCerradoSheet`: dependen del router, de la sesión o de la API.
- **Entrada del bundle**: `.design-sync/entry.tsx` (barril propio, no lo usa la
  app). Se pasa con `--entry`. Si se agrega un componente, hay que tocarlo a él
  y a `cfg.componentSrcMap`, y regenerar los tipos.
- **Tipos**: `.design-sync/tipos.sh` genera `types/` (tsc) e `index.d.ts` (espejo
  del barril). Sin eso, el conversor no encuentra ninguna prop y todos los
  `.d.ts` salen con `[key: string]: unknown`. Los dos están en `.gitignore`;
  **correr el script antes del conversor, siempre**.
- **CSS**: `.design-sync/css-entry.css` se compila con el CLI de Tailwind fijado
  a la versión del repo (4.1.13) a `.design-sync/dist-css/styles.css`
  (gitignorado), que es el `cfg.cssEntry`. **Recompilar cada vez que cambien
  `src/styles.css` o las previews**, porque Tailwind v4 solo emite las clases
  que ve usadas.
  - Por eso mismo el archivo termina con bloques `@source inline(...)` que fijan
    el vocabulario del sistema (utilidades propias, colores, tamaños, sombras):
    las pantallas que arme el agente de diseño usan clases que no aparecen en
    `src/`, y sin esa lista no viajarían en el CSS.
- **Fuentes**: `.design-sync/fonts.css` repite los `@font-face` de
  `src/fonts.css` con rutas que el conversor puede resolver
  (`../node_modules/@fontsource-variable/...`), y va en `cfg.extraFonts`.
- **Proveedor**: `.design-sync/proveedor.tsx` exporta `ProveedorPreview`, un
  router en memoria de TanStack, porque `PageHeader` usa `Link`, `useRouter` y
  `useCanGoBack`. Entra al bundle por `cfg.extraEntries` y se usa como
  `cfg.provider`. Es lo que hace que el bundle pese ~240 KB en vez de ~40 KB.
- **`guidelinesGlob` está vacío a propósito**: con el valor por defecto el
  conversor copiaba `docs/` entero (`ESTADO.md`, `operacion.md`, `plan-v2.md`)
  al proyecto de Claude Design. Es documentación interna de operación; no se
  sube.
- **Agrupación**: los stubs de `.design-sync/docs/<Nombre>.md` solo llevan
  `category:` en el frontmatter; de ahí salen los seis grupos (Cifras, Entrada,
  Superposiciones, Estructura, Estado, Identidad). El cuerpo del `.prompt.md` lo
  sintetiza el conversor con el JSDoc, las props y los ejemplos de la preview.

## Cambios en el código de la app que pidió esta sincronización

- `src/components/Dato.tsx` importaba `etiquetaEstado` desde
  `@/features/turno/api`, y esa barrica arrastra `@/lib/supabase`, que **lanza al
  cargar** sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`: rompía todas las
  vistas previas. Ahora importa desde `@/features/turno/estado`, donde la función
  vive de verdad (aprobado por el usuario el 2026-09-20; lint, typecheck y las
  155 pruebas pasan).
- `.design-sync/entry.tsx` también exporta `applyKey`, `digitosANumero` y
  `numeroADigitos`: son la API con la que se maneja el `Keypad`.

## Avisos conocidos (no son nuevos)

- `[FONT_MISSING] "Inter", "Inter Tight"`: son los *fallbacks* de la pila
  (`"Inter Variable", Inter, system-ui`). Las familias de marca que la app sirve
  —Inter Variable e Inter Tight Variable— sí viajan en `fonts/`. Verificado en
  las capturas: el texto se renderiza en Inter.
- `[GRID_OVERFLOW]` en `ToastProvider`: los avisos son `position: fixed`; se
  resolvió con `cfg.overrides.ToastProvider = {"cardMode": "single"}`.
- `BottomSheet` y `ConfirmDialog` usan `<dialog showModal()>`: van con
  `cardMode: "single"` y `viewport: "420x760"` para que la hoja entre en la
  tarjeta.

## Detalles de componentes que salieron en la revisión

- `DeltaBadge`: `anterior={null}` **no** muestra nada (no hay con qué comparar);
  «nuevo» es `anterior={0}`. El `.d.ts` se corrige a mano con
  `cfg.dtsPropsFor.DeltaBadge`, porque el extractor aplana el tipo a `number`.
- `MetodoLogo`: sin `metodo.color` el vector no se ve (el trazo queda sin color).
- `DesktopAmountInput`: `invalido` solo pone `aria-invalid`; la señal visible la
  pone quien lo usa.
- Las previews viven en `.design-sync/previews/*.tsx` y sus exports tienen que
  ser **componentes** (`export const X = () => (...)`), no elementos JSX: el
  renderizador hace `typeof === 'function'`.
- **Registro de los textos**: la app trata de **tú** («puedes», «toca», «(tú)» en
  `Correos.tsx`), en español de Chile. Nada de voseo («anotá», «cerrá»), que es
  argentino. Las copias de ejemplo de las previews siguen la misma regla.

## Riesgos para la próxima sincronización

- **`types/`, `index.d.ts` y `dist-css/` son generados y gitignorados**: en un
  clon nuevo hay que correr `.design-sync/tipos.sh` y el CLI de Tailwind antes
  del conversor, o el resultado sale mudo (sin props) y sin estilos.
- La versión del CLI de Tailwind está fijada a mano en `.ds-sync`
  (`@tailwindcss/cli@4.1.13`): si el repo sube de versión, hay que subirla ahí
  también o el CSS deja de coincidir con el de la app.
- Los colores de los métodos de pago en las previews (`#E4002B` de Getnet, etc.)
  están escritos a mano: en la app vienen de la tabla `metodos_pago`. Si cambian
  ahí, las previews quedan desactualizadas sin que nada avise.
- `ProveedorPreview` mete TanStack Router en el bundle. Si algún día `PageHeader`
  deja de depender del router, se puede sacar `cfg.provider` y `cfg.extraEntries`
  y el bundle vuelve a pesar ~40 KB.
- La primera sincronización se subió el 2026-09-20 al proyecto
  `4b6bf2d0-0fe5-480f-bf31-f9dfa4d23d2c` (anclado en `cfg.projectId`): 141
  archivos, 26 componentes, ancla `_ds_sync.json` puesta. Las próximas corridas
  bajan esa ancla a `.design-sync/.cache/remote-sync.json` y usan `resync.mjs`
  con `--remote`, así solo se vuelve a verificar lo que cambió.
- `DesignSync` necesita `/design-login` en cada sesión nueva antes de subir.
