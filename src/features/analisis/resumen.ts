import { clp, fechaDiaMes } from '@/lib/format'
import type { VResumenDia } from '@/features/turno/api'

export type DiaGrafico = VResumenDia & { label: string; neto: number; total_ventas: number }

/**
 * Los días que aportan al promedio y a la comparación: los que tuvieron
 * movimiento. Quedan fuera tanto los días en que el local no abrió como las
 * jornadas que existen pero sin turnos, que si no aparecían como "el peor
 * día del período" con $0.
 *
 * La exportación usa otra regla a propósito (`diasExportables`, en
 * features/exportar/tablas.ts): ahí los días sin abrir sí aparecen, con
 * montos en cero y su motivo.
 */
export function diasConRegistro<T extends { turnos?: number | null }>(dias: readonly T[]): T[] {
  return dias.filter((d) => Number(d.turnos ?? 0) > 0)
}

export function promedioNeto(dias: readonly DiaGrafico[]): number {
  const con = diasConRegistro(dias)
  return con.length ? con.reduce((a, d) => a + d.neto, 0) / con.length : 0
}

/** Lo que dice el gráfico, en una frase, para quien no lo ve. */
export function resumenGrafico(todos: readonly DiaGrafico[]): string {
  const dias = diasConRegistro(todos)
  const sinAbrir = todos.filter((d) => d.cerrado).length
  const cola = sinAbrir ? ` ${sinAbrir} día${sinAbrir === 1 ? '' : 's'} el local no abrió.` : ''
  const [primero, ...resto] = dias
  if (!primero) return `Sin días con registro en el período.${cola}`
  let mejor = primero
  let peor = primero
  for (const d of resto) {
    if (d.neto > mejor.neto) mejor = d
    if (d.neto < peor.neto) peor = d
  }
  const borradores = dias.filter((d) => d.estado === 'borrador').length
  const base = `Neto por día en ${dias.length} día${dias.length === 1 ? '' : 's'} con registro${borradores ? `, ${borradores} con borrador sin cerrar` : ''}.`
  if (dias.length === 1) return `${base} ${fechaDiaMes(mejor.fecha)}: ${clp(mejor.neto)}.${cola}`
  return `${base} El mejor fue ${fechaDiaMes(mejor.fecha)} con ${clp(mejor.neto)}; el peor, ${fechaDiaMes(peor.fecha)} con ${clp(peor.neto)}.${cola}`
}
