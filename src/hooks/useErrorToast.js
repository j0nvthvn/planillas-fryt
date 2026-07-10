import { useEffect } from 'react'
import { useToast } from '../components/Toast'

/**
 * Muestra `error` como un toast persistente (sin auto-cerrar) mientras
 * tenga un valor, y lo oculta apenas se limpia. Estaba duplicado con
 * el mismo código exacto en varias páginas (Turno, EditarTurno,
 * Login, Configuracion, Usuarios, Proveedores) — ahora vive en un
 * solo lugar.
 */
export function useErrorToast(error) {
  const toast = useToast()
  useEffect(() => {
    if (!error) return
    const id = toast.show({ message: error, duration: null })
    return () => toast.hide(id)
  }, [error, toast])
}
