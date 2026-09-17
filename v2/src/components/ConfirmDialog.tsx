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
  return (
    <BottomSheet title={title} onClose={onCancel}>
      {message && <p className="text-sm text-ink2">{message}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-secondary flex-1 min-h-[50px] text-[15px]" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1 min-h-[50px] text-[15px]`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Un momento…' : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
