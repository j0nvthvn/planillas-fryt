import { useCallback, useState } from 'react'
import { useToast } from '@/components/Toast'
import { mensajeDeError } from '@/lib/errorLog'
import { marcarDiaCerrado } from './api'

/**
 * Quitar la marca de "no abrió" de un día. Lo ofrecen Hoy, la planilla y
 * Cerrar turno, las tres con el mismo aviso de error y el mismo estado de
 * ocupado mientras viaja la petición.
 */
export function useQuitarMarcaDia(fecha: string) {
  const toast = useToast()
  const [ocupado, setOcupado] = useState(false)

  const quitar = useCallback(async (): Promise<boolean> => {
    setOcupado(true)
    try {
      await marcarDiaCerrado(fecha, false)
      return true
    } catch (e) {
      toast.error(mensajeDeError(e, 'No se pudo quitar la marca'))
      return false
    } finally {
      setOcupado(false)
    }
  }, [fecha, toast])

  return { quitar, ocupado }
}
