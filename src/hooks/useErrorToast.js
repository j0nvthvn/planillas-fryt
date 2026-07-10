import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { logError } from '../utils/errorLog'

/**
 * Muestra `error` como un toast persistente (sin auto-cerrar) mientras
 * tenga un valor, y lo oculta apenas se limpia. Estaba duplicado con
 * el mismo código exacto en varias páginas (Turno, EditarTurno,
 * Login, Configuracion, Usuarios, Proveedores) — ahora vive en un
 * solo lugar.
 *
 * Como es el punto donde convergen prácticamente todos los mensajes de
 * error de la app (formulario o base de datos), también es el lugar más
 * simple para registrarlos en logs_error — así el dueño puede revisar
 * después qué falló, sin depender de que alguien se lo describa.
 */
export function useErrorToast(error) {
  const toast = useToast()
  const location = useLocation()
  useEffect(() => {
    if (!error) return
    const id = toast.show({ message: error, duration: null })
    logError(error, { contexto: 'useErrorToast', ruta: location.pathname })
    return () => toast.hide(id)
  }, [error, toast, location.pathname])
}
