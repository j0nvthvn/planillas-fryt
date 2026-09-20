import { useEffect } from 'react'
import { ToastProvider, useToast } from 'frytcontrol'

const Lanzar = ({ tipo, mensaje, accion }: { tipo: 'ok' | 'error' | 'info'; mensaje: string; accion?: string }) => {
  const toast = useToast()
  useEffect(() => {
    toast.show({ message: mensaje, tipo, actionLabel: accion, onAction: () => {}, duration: null })
  }, [toast, mensaje, tipo, accion])
  return <p className="text-sm text-muted">El aviso aparece abajo, sobre todo lo demás.</p>
}

/** Confirmación de algo que salió bien. */
export const Ok = () => (
  <div className="card max-w-md min-h-[140px]">
    <ToastProvider><Lanzar tipo="ok" mensaje="Turno cerrado" /></ToastProvider>
  </div>
)

/** Error, con la acción para deshacer al lado. */
export const ConAccion = () => (
  <div className="card max-w-md min-h-[140px]">
    <ToastProvider><Lanzar tipo="error" mensaje="No se pudo guardar el turno" accion="Reintentar" /></ToastProvider>
  </div>
)
