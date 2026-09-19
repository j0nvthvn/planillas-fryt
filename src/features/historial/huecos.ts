import { sumarDias } from '@/lib/format'
import type { VResumenDia } from '@/features/turno/api'

/**
 * Un día sin jornada no existe en la base, así que el Historial se saltaba
 * la fecha en silencio: un feriado y un olvido de registro se veían igual,
 * es decir, no se veían. Acá el calendario se completa en el cliente, entre
 * las filas que ya llegaron, sin tocar la consulta ni su paginación.
 */
export type ItemHistorial =
  | { tipo: 'dia'; fecha: string; d: VResumenDia }
  | { tipo: 'hueco'; fecha: string }
  | { tipo: 'tramo'; fecha: string; hasta: string; dias: number }

/** Desde cuántos días seguidos sin registro conviene una sola fila resumida. */
export const TRAMO_MINIMO = 7

/**
 * Mezcla las filas con las fechas que faltan entre ellas, de la más nueva a
 * la más antigua.
 *
 * - `hasta` es el límite de arriba (normalmente ayer): hoy está en curso y
 *   ya lo muestra la pantalla Hoy.
 * - Por abajo no se inventa nada más allá de la fila más antigua cargada:
 *   la paginación todavía no llegó ahí.
 * - Una racha de `TRAMO_MINIMO` días o más se colapsa en un solo ítem. Sin
 *   eso, los meses en que la app no se usaba serían cientos de filas vacías.
 *   Las rachas no cruzan de mes, para que el agrupado por mes siga cuadrando.
 */
export function conHuecos(filas: readonly VResumenDia[], hasta: string): ItemHistorial[] {
  if (filas.length === 0) return []
  const items: ItemHistorial[] = []
  let racha: string[] = []

  // Las rachas se acumulan de la fecha más nueva a la más antigua.
  const cerrarRacha = () => {
    if (racha.length === 0) return
    if (racha.length >= TRAMO_MINIMO) {
      items.push({ tipo: 'tramo', fecha: racha[0]!, hasta: racha[racha.length - 1]!, dias: racha.length })
    } else {
      for (const f of racha) items.push({ tipo: 'hueco', fecha: f })
    }
    racha = []
  }

  const faltante = (f: string) => {
    // Un mes nuevo corta la racha: así ningún ítem pertenece a dos meses.
    if (racha.length && racha[racha.length - 1]!.slice(0, 7) !== f.slice(0, 7)) cerrarRacha()
    racha.push(f)
  }

  const primera = filas[0]!.fecha
  for (let f = hasta; f > primera; f = sumarDias(f, -1)) faltante(f)

  filas.forEach((d, i) => {
    cerrarRacha()
    items.push({ tipo: 'dia', fecha: d.fecha, d })
    const siguiente = filas[i + 1]
    if (!siguiente) return
    for (let f = sumarDias(d.fecha, -1); f > siguiente.fecha; f = sumarDias(f, -1)) faltante(f)
  })
  cerrarRacha()
  return items
}

/** Agrupa por mes conservando el orden en que llegaron (de nuevo a viejo). */
export function porMes(items: readonly ItemHistorial[]): { mes: string; items: ItemHistorial[] }[] {
  const meses: { mes: string; items: ItemHistorial[] }[] = []
  for (const it of items) {
    const mes = it.fecha.slice(0, 7)
    const ultimo = meses.at(-1)
    if (ultimo?.mes === mes) ultimo.items.push(it)
    else meses.push({ mes, items: [it] })
  }
  return meses
}

/** Lo que se muestra junto al nombre del mes. */
export function resumenMes(items: readonly ItemHistorial[]): { conRegistro: number; sinAbrir: number; neto: number; maxNeto: number } {
  let conRegistro = 0
  let sinAbrir = 0
  let neto = 0
  let maxNeto = 0
  for (const it of items) {
    if (it.tipo !== 'dia') continue
    if (it.d.cerrado) { sinAbrir++; continue }
    if (Number(it.d.turnos ?? 0) === 0) continue
    conRegistro++
    neto += Number(it.d.neto ?? 0)
    maxNeto = Math.max(maxNeto, Math.abs(Number(it.d.neto ?? 0)))
  }
  return { conRegistro, sinAbrir, neto, maxNeto }
}
