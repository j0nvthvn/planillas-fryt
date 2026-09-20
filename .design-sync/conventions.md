# FrytControl — cómo construir con este sistema

Interfaz de una PWA de caja para un local chileno: superficie gris clarísima,
tarjetas blancas de 1 px, acento índigo y color semántico **solo en las cifras**
(verde lo que suma, rojo lo que resta, ámbar lo que avisa). Todo el texto está
en español de Chile y trata de tú, sin voseo («cuenta el efectivo», «puedes
cerrar el turno»); los montos van en pesos chilenos sin decimales
(`$1.284.500`) y las cifras, siempre tabulares.

## Cómo se monta

No hace falta ningún proveedor para la mayoría de los componentes: leen sus
tokens del CSS, no de un contexto. Dos excepciones:

- **`useToast`** solo funciona dentro de **`ToastProvider`**. Envolvé la pantalla
  entera una vez; los avisos se dibujan sobre todo lo demás.
- **`PageHeader`** usa `Link`, `useRouter` y `useCanGoBack` de TanStack Router:
  necesita un router. Si la pantalla no lo tiene, envolvela en
  **`ProveedorPreview`** (va en este bundle y trae un router en memoria) o no
  uses la prop `back`.

El tema oscuro se activa con la clase `dark` en `<html>`: todos los tokens
cambian solos, no hay que escribir variantes `dark:` salvo para casos puntuales.

```jsx
const { ToastProvider, PageHeader, Ledger, LedgerHead, LedgerLine, LedgerTotal } = window.FrytControl

<ToastProvider>
  <div className="min-h-screen bg-canvas px-4 pt-5">
    <PageHeader eyebrow="Martes 16 de septiembre" title="Planilla del día" />
    <div className="card overflow-hidden max-w-md">
      <Ledger className="px-[18px] pb-2">
        <LedgerHead label="Ventas" />
        <LedgerLine label="Efectivo" value={412500} />
        <LedgerLine label="Getnet" value={631000} />
      </Ledger>
      <LedgerTotal label="Neto del día" value={1082000} className="border-t border-hairline" />
    </div>
  </div>
</ToastProvider>
```

## El idioma visual: Tailwind v4 con vocabulario propio

Se estila **con clases de Tailwind sobre los tokens del sistema**, nunca con
hex sueltos ni con la paleta de Tailwind (`bg-slate-100` y compañía están fuera
del sistema). Las familias que existen:

| Familia | Nombres |
|---|---|
| Superficies (`bg-*`) | `canvas` (fondo de pantalla), `card` (tarjeta), `soft` (riel, relleno de campo), `image-bg` |
| Tinta (`text-*`) | `ink` (principal), `ink2` (secundaria), `muted`, `muted2` (las dos pasan AA sobre `card` y sobre los tintes) |
| Marca y estado | `brand`, `brand-hover`, `brand-tint`, `pos`, `pos-tint`, `pos-border`, `neg`, `neg-tint`, `warn`, `warn-tint`, `info`, `info-tint`, `on-solid` (texto sobre fondo sólido de marca) |
| Bordes (`border-*`) | `hairline` (1 px de tarjeta), `hairline-strong` (botón secundario, separador fuerte), `control-border` (campos: 3:1 contra la tarjeta) |
| Tipografía | `font-sans` (Inter Variable), `font-display` (Inter Tight Variable); tamaños `text-xs` 12 · `text-sm` 13 · `text-md` 14 · `text-base` 15 · `text-lg` 17 · `text-xl` 20 · `text-2xl` 22 · `text-amount-sm` 24 · `text-amount` 36 · `text-hero` 40 |
| Sombras | `shadow-card`, `shadow-hero`, `shadow-fab`, `shadow-bar` |

Y las utilidades propias, que son el atajo a los patrones del sistema:

| Utilidad | Para qué |
|---|---|
| `card`, `card-hero` | Tarjeta blanca de 16 px de radio, 18 px de padding |
| `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost` | Botones; con `btn-lg` (50 px, hoja o formulario) o `btn-bar` (40 px, barra superior) |
| `input`, `label` | Campo de texto y su etiqueta |
| `badge`, `badge-sm` | Píldora de estado o de forma de pago; se combina con `bg-*-tint text-*` |
| `aviso` | Aviso en línea; también con `bg-*-tint text-*` |
| `eyebrow` | Antetítulo de sección: 11 px, versalitas, `muted` |
| `amount`, `cifra` | Cifras: `amount` para el número grande, `cifra` para la fila de lista |
| `segmented`, `segmented-item`, `segmented-item-on` | Control segmentado |
| `row` | Fila tocable de lista (64 px) |
| `hit` | Área táctil de 44×44 sin agrandar lo que se ve — va en todo control chico |

Reglas del sistema que conviene no romper: **nada de texto bajo 12 px**, todo
control tocable llega a 44 px (`hit` lo resuelve), y el acento índigo se reserva
para acciones — el estado se dice con verde, rojo o ámbar, y siempre sobre su
tinte, nunca en texto de color sobre fondo de color.

## Dónde está la verdad

- `styles.css` y lo que importa (`_ds_bundle.css`): los tokens, los tamaños y
  las utilidades de arriba, con los comentarios que explican cada decisión.
  Leelo antes de inventar una clase.
- `components/<grupo>/<Nombre>/<Nombre>.prompt.md` y `.d.ts`: la API real de
  cada componente y ejemplos armados con datos de verdad.
- Los seis grupos: **Cifras** (Ledger, Dato, DeltaBadge, EstadoChip),
  **Entrada** (Keypad, MontoInput, PayToggle…), **Superposiciones**
  (BottomSheet, ConfirmDialog), **Estructura** (PageHeader, Banda,
  ToastProvider), **Estado** (AvisoAmbar, Esqueleto…, Spinner) e **Identidad**
  (Icon, MetodoLogo, ProveedorAvatar, BarraMetodos).
