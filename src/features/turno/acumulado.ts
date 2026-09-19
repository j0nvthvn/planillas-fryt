/**
 * Métodos cuya máquina entrega el TOTAL DEL DÍA (metodos_pago.acumulado_diario):
 * al cerrar la tarde se escribe ese total y la parte de la tarde se deriva.
 * Lo guardado sigue siendo el monto por turno; la resta queda a la vista.
 */
export interface Derivado {
  tarde: number
  /** El total escrito es menor que lo registrado en la mañana: no puede ser. */
  invalido: boolean
}

export function derivarTarde(totalDia: number, manana: number): Derivado {
  const t = Math.round(totalDia)
  const m = Math.round(manana)
  if (t < m) return { tarde: 0, invalido: true }
  return { tarde: t - m, invalido: false }
}

/** Inversa: dado lo guardado en la tarde, qué total mostraba la máquina. */
export function totalDesdeTarde(tarde: number, manana: number): number {
  return Math.round(tarde) + Math.round(manana)
}
