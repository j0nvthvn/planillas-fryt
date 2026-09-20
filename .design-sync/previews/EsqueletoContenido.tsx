import { EsqueletoContenido } from 'frytcontrol'

/** Con título: la silueta de una pantalla que todavía no llegó. */
export const ConTitulo = () => (
  <div className="p-4 bg-canvas">
    <EsqueletoContenido />
  </div>
)

/** `sinTitulo`: cuando el encabezado ya está pintado y falta el contenido. */
export const SinTitulo = () => (
  <div className="p-4 bg-canvas">
    <EsqueletoContenido sinTitulo />
  </div>
)
