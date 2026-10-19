/**
 * Una consulta que falló sin datos previos: se dice y se ofrece reintentar,
 * en vez de mostrar ceros, «sin registros» o un spinner eterno.
 */
export function ErrorCarga({ que, onReintentar }: { que: string; onReintentar: () => void }) {
  return (
    <div role="alert" className="card text-center py-8 mb-3">
      <p className="text-ink2 font-medium">No pudimos cargar {que}.</p>
      <p className="text-sm text-muted mt-1">Revisa la conexión y vuelve a intentarlo.</p>
      <button type="button" className="btn-primary mt-4" onClick={onReintentar}>Reintentar</button>
    </div>
  )
}

/** Hay datos de antes, pero el último intento de actualizarlos falló. */
export function AvisoDesactualizado({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div role="status" className="mb-3 aviso bg-warn-tint text-warn">
      No se pudo actualizar: lo que ves puede no estar al día.{' '}
      <button type="button" className="underline font-semibold" onClick={onReintentar}>Reintentar</button>
    </div>
  )
}
