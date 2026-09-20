import { ConfirmDialog } from 'frytcontrol'

/** Confirmación destructiva: el foco entra por la opción segura. */
export const Peligrosa = () => (
  <ConfirmDialog
    title="¿Borrar el turno?"
    message="Se van a perder las ventas y los proveedores que anotaste en la mañana. No se puede deshacer."
    confirmLabel="Borrar"
    danger
    onConfirm={() => {}}
    onCancel={() => {}}
  />
)

/** Confirmación normal, mientras la acción está en curso (`loading`). */
export const Cargando = () => (
  <ConfirmDialog
    title="¿Cerrar el día?"
    message="Después del cierre, corregir el día queda registrado en el historial."
    confirmLabel="Cerrar el día"
    loading
    onConfirm={() => {}}
    onCancel={() => {}}
  />
)
