import { ES_STAGING } from '@/lib/entorno'

/**
 * Píldora fija arriba al centro para no confundir staging con producción.
 * No intercepta toques ni sale al imprimir; las hojas (`<dialog>`) la tapan.
 */
export function EtiquetaEntorno() {
  if (!ES_STAGING) return null
  return (
    <div
      role="note"
      aria-label="Entorno de staging"
      className="fixed left-1/2 -translate-x-1/2 top-[calc(var(--safe-top)+4px)] z-[65] pointer-events-none print:hidden rounded-full bg-warn text-on-solid text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-hero"
    >
      Staging
    </div>
  )
}
