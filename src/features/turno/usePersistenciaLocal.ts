import { useCallback, useState } from 'react'
import type { Modo } from './api'
import { guardarBorradorLocal } from './borradorLocal'
import type { FormState } from './estadoTurno'

/**
 * El borrador del dispositivo para una fecha y un modo: `persistir` guarda
 * el estado del formulario en IndexedDB, con lo que el servidor todavía no
 * tiene (`pendiente`), y `localOk` dice si el último intento funcionó
 * (falla en navegación privada o sin espacio).
 */
export function usePersistenciaLocal(fecha: string, modo: Modo) {
  const [localOk, setLocalOk] = useState(true)
  const persistir = useCallback((s: FormState) => {
    void guardarBorradorLocal({
      fecha, modo, trabajadorId: s.trabajadorId, fondoInicial: s.fondoInicial, ventas: s.ventas,
      proveedores: s.proveedores.map(({ key: _k, ...p }) => p), efectivoContado: s.efectivoContado, contoCaja: s.contoCaja,
      desgloseConteo: s.desgloseConteo,
      guardadoEn: Date.now(), baseUpdatedAt: s.baseUpdatedAt, pendiente: s.sucio,
    }).then(setLocalOk)
  }, [fecha, modo])
  return { persistir, localOk }
}
