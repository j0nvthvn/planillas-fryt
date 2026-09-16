# Mejoras de UI/UX propuestas para la v2

Revisión hecha el 16 de septiembre de 2026 sobre la v2 desplegada
(`v2/`, piloto Fase 3 semana A). Son propuestas, no trabajo hecho: ninguna
está implementada. Cada una nace de algo concreto en el código o en los datos
de producción, así que se pueden abordar de a una y en el orden que convenga.
Contexto general en `ESTADO.md`; reglas de diseño en `plan-v2.md` (§2.5).

## Prioridad sugerida

1. **Base accesible** (un commit, riesgo cero): foco visible global,
   `prefers-reduced-motion`, ningún texto bajo 12 px, limitar `user-select`.
2. **Hoja de revisión antes de cerrar** y **conteo de caja por billetes**.
   Atacan dos problemas medidos en producción: 29 % de cierres corregidos y
   cero conteos de caja en toda la historia.
3. **Cifras tabulares en listas**, escala tipográfica y fuentes alojadas en el
   repo.
4. **Aviso de proveedor parecido**, junto con la limpieza de datos pendiente
   con la dueña (`plan-v2.md` §0.5).

## Tipografía y estilo

- **Instrument Serif no tiene cifras tabulares.** La utilidad `amount`
  (`v2/src/styles.css`) combina esa fuente con `tabular-nums`, pero la fuente
  no trae esa característica y la orden se ignora. Donde hay cifras en
  columna (neto de cada fila en Historial) los dígitos no alinean. Propuesta:
  serif solo para la cifra grande de Hoy, la planilla y los títulos; en toda
  lista o columna usar Hanken Grotesk semibold con `tabular-nums`.
- **Escala tipográfica.** Conviven tamaños de 10, 10.5, 11, 11.5, 12, 12.5,
  13, 13.5, 14.5, 15, 16 y 17 px escritos a mano en las clases. Definir seis
  pasos como tokens (por ejemplo 12, 13, 15, 17, 24 y 60) y eliminar el resto.
- **Nada bajo 12 px.** Hay nueve usos de `text-[10px]` y varios de 11 px:
  chips de estado, etiquetas de la barra de pestañas móvil, columna de fecha
  de Historial, ejes del gráfico. Mínimo 12 px; etiquetas de navegación 12 o
  13. La dueña cierra caja a las 20 h en un móvil.
- **Pesos y carga de fuentes.** `v2/index.html` carga cinco pesos de Hanken
  Grotesk y el 800 no se usa. `display=swap` produce un salto visible en la
  cifra grande al cargar. Para una PWA que a veces está sin red, alojar las
  fuentes en el repo con `@fontsource` y quitar la dependencia de Google
  Fonts.
- **Colores fuera de tokens.** `--color-cash` y `--color-wire` son
  hexadecimales fijos y en modo oscuro quedan apagados sobre el fondo. Lo mismo
  con el color de cada método de pago que viene de `metodos_pago.color` y se
  usa como color de texto en el teclado y en las barras de Hoy. Necesitan una
  variante clara para modo oscuro o pasar por un token.
- **Contrastes al límite.** `warn` sobre `warn-tint` ronda 4,4:1, un poco bajo
  el mínimo de 4,5:1 para texto normal. `muted2` cumple sobre tarjeta blanca
  pero no sobre `canvas` ni `soft`, y ahí va el "$0" de los montos vacíos y
  los placeholders. Oscurecer `warn` y `muted2` un paso más y volver a medir.
- **Barra lateral de escritorio.** Solo muestra el nombre de la app. Poner
  abajo el bloque de cuenta que hoy vive en el avatar de Hoy (nombre, rol,
  salir), para que el escritorio no dependa de una pantalla concreta para
  cerrar sesión.

## Accesibilidad

- **Foco visible.** Solo los botones con la utilidad `btn` y el avatar tienen
  anillo de foco. Las filas de las listas de ventas y proveedores en Cerrar
  turno, las pestañas, los chips de trabajador y el teclado no muestran nada
  al navegar con Tab. Una regla global de `:focus-visible` con el color de
  marca lo resuelve de una vez.
- **Hojas inferiores** (`v2/src/components/BottomSheet.tsx`). El diálogo no
  atrapa el foco, no lo mueve adentro al abrir ni lo devuelve al botón que lo
  abrió al cerrar. Con `<dialog>` nativo y `showModal()` se obtienen las tres
  cosas sin código extra.
- **Movimiento.** No hay `prefers-reduced-motion`. Desactivar bajo esa
  preferencia las animaciones `sheetUp`, `fadeIn`, `toastUp` y el
  `active:scale` del teclado.
- **Selección de texto bloqueada.** El `user-select: none` global en `html`
  impide copiar un monto o una fila de la planilla para pegarla en WhatsApp.
  Limitarlo a la barra de navegación y al teclado.
- **Semántica de filtros.** Los filtros de Historial usan `role="tablist"`,
  pero filtran una lista, no cambian paneles. Corresponde un grupo de botones
  con `aria-pressed`.
- **Gráfico de Análisis.** Etiquetas de ejes a 10 px: subir a 12. Agregar un
  resumen oculto para lectores de pantalla con el mejor y peor día del
  período.
- **Etiqueta del botón flotante.** En móvil dice "Cerrar", que en una app
  también significa salir. "Cierre" o "Cerrar caja" es inequívoco.

## Flujo

- **Revisión antes de cerrar.** El botón de la barra fija cierra de inmediato.
  Proponer una hoja de confirmación con el resumen (quién atendió, ventas por
  método, proveedores, caja) y avisos de lo que falta ("sin trabajador", "sin
  conteo"). Un toque más, pero evita la mayoría de las correcciones.
- **Conteo de caja por billetes.** Una hoja donde se escriba cuántos billetes
  y monedas de cada denominación hay, con la suma en vivo, en lugar de pedir
  una cifra total de memoria. Es lo que le da sentido al "efectivo esperado".
- **Duplicados de proveedor** (`v2/src/features/turno/ProveedorSheet.tsx`).
  Al escribir un nombre sin coincidencia exacta se crea uno nuevo. Agregar un
  aviso "¿Quisiste decir Río Maipo?" cuando hay un parecido cercano (distancia
  de edición pequeña sobre `normalizar()`), con un botón para usarlo.
- **Teclado encadenado.** Al aceptar con el monto vacío la etiqueta dice
  "Siguiente", que funciona, pero un botón explícito "Omitir" deja claro que
  dejar un método en cero es válido.
- **Título de la pantalla de cierre.** Dice "Cerrar turno" aunque el modo sea
  día completo, y el eyebrow "Otro día" no aporta. Título según el modo
  ("Cerrar el día", "Cerrar la tarde") y la fecha en el eyebrow.
- **Historial más legible.** Filas densas con la fecha en tres líneas
  diminutas. Agrupar por mes con un encabezado pegajoso, fecha en una línea,
  neto en la sans tabular.
- **Esqueletos en vez de spinner.** Con la caché en IndexedDB casi siempre hay
  datos al instante; en la primera carga el spinner y luego el salto de
  contenido se sienten. Un esqueleto con la forma de la cifra y la tarjeta.
- **Contraseña visible.** El login no tiene botón para mostrar la contraseña.
  En un móvil compartido con teclado pequeño evita reintentos.
