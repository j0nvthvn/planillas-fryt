import type { Modo } from './api'

export interface EstadoDia {
  /** Turnos activos del día (sin eliminados). */
  turnos: { tipo: 'mañana' | 'tarde'; modo: Modo; is_draft: boolean }[]
  /** Día de turno único por configuración (domingos por defecto). */
  diaUnicoConfig: boolean
}

/**
 * Modo sugerido al abrir "Cerrar turno" para un día:
 *  - si hay un borrador, seguir con ese;
 *  - sin turnos: día completo (siempre; es lo más común);
 *  - hay mañana (no completa) y no es día único: tarde;
 *  - si ya está todo cerrado, día completo (la dueña corrige desde ahí).
 */
export function modoPorDefecto(e: EstadoDia): Modo {
  const borrador = e.turnos.find((t) => t.is_draft)
  if (borrador) return borrador.modo
  if (e.turnos.length === 0) return 'completo'
  const manana = e.turnos.find((t) => t.tipo === 'mañana')
  const tarde = e.turnos.find((t) => t.tipo === 'tarde')
  if (manana && manana.modo !== 'completo' && !tarde && !e.diaUnicoConfig) return 'tarde'
  if (manana?.modo === 'completo') return 'completo'
  if (tarde && !manana) return 'mañana'
  return manana ? 'mañana' : 'completo'
}

/**
 * Qué modos se pueden elegir sin chocar con las reglas de guardar_turno:
 *  - "tarde" no si el día está registrado como completo;
 *  - "completo" no si ya existe una tarde;
 *  - en día único por configuración se ofrece solo "completo"
 *    (salvo que ya existan turnos divididos).
 */
export function modosDisponibles(e: EstadoDia): Modo[] {
  const manana = e.turnos.find((t) => t.tipo === 'mañana')
  const tarde = e.turnos.find((t) => t.tipo === 'tarde')
  const completo = manana?.modo === 'completo'
  const todos: Modo[] = ['completo', 'mañana', 'tarde']
  return todos.filter((m) => {
    if (m === 'tarde' && completo) return false
    if (m === 'completo' && tarde) return false
    if (e.diaUnicoConfig) {
      // Día único por configuración: sin turnos solo "completo"; con una
      // mañana ya registrada se puede corregir o pasarla a completo, pero
      // no agregar tarde (salvo que el día ya venga dividido).
      if (e.turnos.length === 0 && m !== 'completo') return false
      if (m === 'tarde' && !tarde) return false
    }
    return true
  })
}

/** Texto para el botón principal. */
export function etiquetaCerrar(modo: Modo, yaCerrado: boolean): string {
  if (yaCerrado) return 'Guardar corrección'
  if (modo === 'completo') return 'Cerrar el día'
  return `Cerrar turno ${modo}`
}
