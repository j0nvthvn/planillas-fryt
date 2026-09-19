import type { Modo, TurnoConLineas } from '@/features/turno/api'

/**
 * Qué falta del día y cuál es la acción principal de Hoy, mirando los
 * turnos ya registrados. Todo lo que decide qué botón grande se ve.
 */

export interface Entrada {
  turnos: readonly TurnoConLineas[]
  /** La jornada está marcada como "no abrió". */
  noAbrio: boolean
  /** El día de la semana está configurado como de un solo turno. */
  diaUnico: boolean
}

export interface EstadoDia {
  hayManana: boolean
  hayTarde: boolean
  /** Lo registrado representa el día entero (no hay tarde aparte). */
  esCompleto: boolean
  /** Cuántos turnos se esperan ese día: 1 si es día completo, 2 si está dividido. */
  turnosEsperados: number
  /** El turno que falta por registrar, si el día ya empezó dividido. */
  pendiente: Modo | null
  /** Hay un turno a medio cerrar. */
  hayBorrador: boolean
  /** La acción principal, o null si no hay nada que cerrar. */
  cta: { label: string; modo: Modo } | null
}

export function estadoDia({ turnos, noAbrio, diaUnico }: Entrada): EstadoDia {
  const hayManana = turnos.some((t) => t.turno.tipo === 'mañana')
  const hayTarde = turnos.some((t) => t.turno.tipo === 'tarde')
  const esCompleto = turnos.some((t) => t.turno.modo === 'completo')
  const borrador = turnos.find((t) => t.turno.is_draft)

  // El local no abrió: no hay caja que cerrar, así que no va el botón.
  let cta: EstadoDia['cta'] = null
  if (noAbrio) cta = null
  else if (borrador) cta = { label: borrador.turno.modo === 'completo' ? 'Terminar de cerrar el día' : `Terminar de cerrar la ${borrador.turno.modo}`, modo: borrador.turno.modo }
  else if (!turnos.length) cta = { label: 'Cerrar el día', modo: 'completo' }
  else if (hayManana && !hayTarde && !esCompleto && !diaUnico) cta = { label: 'Cerrar turno tarde', modo: 'tarde' }

  return {
    hayManana,
    hayTarde,
    esCompleto,
    turnosEsperados: diaUnico || esCompleto ? 1 : 2,
    hayBorrador: !!borrador,
    pendiente: diaUnico || esCompleto || !turnos.length ? null : !hayManana ? 'mañana' : !hayTarde ? 'tarde' : null,
    cta,
  }
}
