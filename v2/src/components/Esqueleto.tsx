/**
 * Silueta gris de la pantalla mientras carga: se ve dónde va a quedar cada
 * cosa en vez de un spinner en una página vacía.
 */
function Bloque({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-soft animate-pulse ${className}`} />
}

/** Contenido de una pantalla: título, cifra y tarjetas. */
export function EsqueletoContenido({ sinTitulo }: { sinTitulo?: boolean }) {
  return (
    <div className="max-w-2xl mx-auto" role="status" aria-label="Cargando">
      {!sinTitulo && <>
        <Bloque className="h-3 w-16 mb-2 rounded-full" />
        <Bloque className="h-8 w-48 mb-6" />
      </>}
      <Bloque className="h-24 w-full mb-4" />
      <Bloque className="h-14 w-full mb-4" />
      <Bloque className="h-40 w-full" />
    </div>
  )
}

/** Pantalla entera, antes de que exista el Layout (se está leyendo la sesión). */
export function EsqueletoPagina() {
  return (
    <div className="app-shell flex flex-col bg-canvas">
      <div className="flex-1 min-h-0 px-4 sm:px-6 md:px-8 pt-5">
        <EsqueletoContenido />
      </div>
      <div className="md:hidden h-[68px] shrink-0 bg-card border-t border-hairline" />
    </div>
  )
}
