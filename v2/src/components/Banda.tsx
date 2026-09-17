import { useEffect, useRef } from 'react'
import { marcarBanda } from '@/lib/barraEstado'

/**
 * Fondo de color con borde diagonal detrás del encabezado (Hoy, Ajustes).
 * Va absoluto con z negativo: el contenedor de la página debe ser
 * `relative isolate`, y la primera tarjeta queda montada encima.
 *
 * En el celular sube hasta el borde de la pantalla y la `franja-barra` del
 * Layout repite el degradado sobre la barra de estado: `alto` es el de la banda
 * ahí, y las dos lo usan para calcular el mismo degradado y verse como una sola.
 * Mientras la banda cubre el tope, la franja va de su color; al bajar, del fondo.
 */
export function Banda({ className = 'md:h-[210px]', alto = 176 }: { className?: string; alto?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    document.documentElement.style.setProperty('--banda-h', `${alto}px`)
    const obs = new IntersectionObserver((entradas) => marcarBanda(entradas.some((e) => e.isIntersecting)))
    obs.observe(el)
    return () => {
      obs.disconnect()
      marcarBanda(false)
      document.documentElement.style.removeProperty('--banda-h')
    }
  }, [alto])
  return <div ref={ref} aria-hidden="true" className={`saludo-banda absolute -z-10 top-[calc(-20px-var(--safe-top))] h-[calc(var(--banda-h)+var(--safe-top))] -inset-x-4 sm:-inset-x-6 md:top-0 md:inset-x-0 md:rounded-[24px] ${className}`} />
}
