/**
 * Barra de estado del celular (app instalada, `viewport-fit=cover`).
 *
 * Bajo la barra se ve la `franja-barra` del Layout, fija y del alto del
 * `safe-area`: en Hoy y en la portada de Ajustes continúa el degradado de la
 * banda (`data-banda`), y en el resto lleva el fondo de la página. El
 * `theme-color` sigue a esa franja, que es lo que el sistema tiene detrás al
 * elegir íconos claros u oscuros.
 */

function color(variable: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
}

function pintar() {
  const meta = document.querySelector('meta[name="theme-color"]')
  const c = color(document.documentElement.hasAttribute('data-banda') ? '--saludo-from' : '--canvas')
  if (meta && c) meta.setAttribute('content', c)
}

/** La banda avisa mientras cubre el tope de la pantalla (deja de hacerlo al bajar). */
export function marcarBanda(cubreElTope: boolean) {
  document.documentElement.toggleAttribute('data-banda', cubreElTope)
  pintar()
}

/** Repinta al cambiar el tema (la clase `dark` de <html>); devuelve la baja. */
export function observarTema() {
  pintar()
  const obs = new MutationObserver(pintar)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}
