/**
 * Diálogo de confirmación genérico (fondo oscuro + tarjeta centrada +
 * cancelar/confirmar). Reemplaza el mismo bloque de markup que estaba
 * copiado en ~8 lugares distintos de la app. `children` es opcional y
 * se renderiza entre la descripción y los botones, para casos como
 * "Registrar un día anterior" que además necesitan un input.
 *
 * `zIndex` existe porque un par de estos diálogos se abren por encima
 * de otro modal/menú ya visible (p. ej. eliminar proveedor desde el
 * sheet de edición, o cerrar sesión desde el menú de usuario) y
 * necesitan quedar por encima de ese z-index base.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  zIndex = 40,
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/70" style={{ zIndex }} onClick={onCancel} />
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: zIndex + 10 }}>
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
          {title && (
            <div>
              <p className="font-bold text-ink text-base">{title}</p>
              {description && <p className="text-sm text-ink2 mt-1">{description}</p>}
            </div>
          )}
          {children}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 btn-secondary">{cancelLabel}</button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
