import { ES_STAGING } from '@/lib/entorno'

/**
 * Píldora fija abajo a la izquierda, sobre la navegación y la barra del
 * cierre, para no confundir staging con producción. Arriba tapaba las
 * bandas de «Sin conexión» y «Hay una versión nueva». No intercepta toques
 * ni sale al imprimir; los toasts y las hojas (`<dialog>`) la tapan.
 */
export function EtiquetaEntorno() {
  if (!ES_STAGING) return null
  return (
    <div
      role="note"
      aria-label="Entorno de staging"
      className="fixed left-2 bottom-[calc(var(--nav-h,0px)+var(--sticky-bar-h,0px)+8px)] md:bottom-[calc(var(--sticky-bar-h,0px)+8px)] z-[55] pointer-events-none print:hidden rounded-full bg-warn text-on-solid text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-hero"
    >
      Staging
    </div>
  )
}
