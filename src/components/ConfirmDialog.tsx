import { useEffect, useId, useRef } from 'react'
import { BottomSheet } from './BottomSheet'

interface Props {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger, loading, onConfirm, onCancel }: Props) {
  const mensajeId = useId()
  const cancelar = useRef<HTMLButtonElement>(null)
  // El foco entra por la opción segura, no por la × ni por la destructiva.
  useEffect(() => { cancelar.current?.focus() }, [])
  return (
    <BottomSheet title={title} onClose={onCancel} role="alertdialog" describedBy={message ? mensajeId : undefined}>
      {message && <p id={mensajeId} className="text-sm text-ink2">{message}</p>}
      <div className="flex gap-2 pt-1">
        <button ref={cancelar} type="button" className="btn-secondary flex-1 btn-lg" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1 btn-lg`} onClick={onConfirm} disabled={loading}>
          <span aria-live="polite">{loading ? 'Un momento…' : confirmLabel}</span>
        </button>
      </div>
    </BottomSheet>
  )
}
