import { useEffect } from 'react'

function pintar(variable: string) {
  const meta = document.querySelector('meta[name="theme-color"]')
  const color = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  if (meta && color) meta.setAttribute('content', color)
}

/**
 * Color de la barra de estado del celular (app instalada) según la pantalla:
 * `variable` es un token de styles.css, así sigue el tema elegido en la app
 * (la clase `dark` de <html>). Al salir del Layout vuelve al fondo.
 */
export function useColorBarra(variable: string) {
  useEffect(() => {
    pintar(variable)
    const obs = new MutationObserver(() => pintar(variable))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => { obs.disconnect(); pintar('--canvas') }
  }, [variable])
}
