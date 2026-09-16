/**
 * Conteo de caja por denominaciones. En toda la historia del negocio no hay
 * un solo conteo registrado: pedir una cifra total de memoria a las 20 h no
 * funciona. Acá se cuenta lo que hay en el cajón, billete por billete, y la
 * app suma.
 *
 * Solo se guarda el total (`efectivo_contado`); el desglose vive en el
 * borrador del dispositivo para poder retomar el conteo.
 */

/** Billetes y monedas en circulación en Chile, de mayor a menor. */
export const DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10] as const

export type Denominacion = (typeof DENOMINACIONES)[number]
/** Cuántas piezas hay de cada denominación (sin entrada = 0). */
export type Conteo = Partial<Record<number, number>>

export function totalConteo(c: Conteo): number {
  return DENOMINACIONES.reduce((suma, d) => suma + d * cantidad(c, d), 0)
}

export function cantidad(c: Conteo, d: number): number {
  const n = c[d]
  return Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 0
}

export function hayConteo(c: Conteo): boolean {
  return DENOMINACIONES.some((d) => cantidad(c, d) > 0)
}

/** Suma `delta` piezas de una denominación; nunca baja de 0. */
export function ajustar(c: Conteo, d: number, delta: number): Conteo {
  return fijar(c, d, cantidad(c, d) + delta)
}

/** Deja la cantidad exacta de una denominación (se descarta si queda en 0). */
export function fijar(c: Conteo, d: number, n: number): Conteo {
  const limpio = Number.isFinite(n) ? Math.max(0, Math.min(Math.floor(n), 99999)) : 0
  const next = { ...c }
  if (limpio === 0) delete next[d]
  else next[d] = limpio
  return next
}

/** Lo que el usuario escribe en la casilla de cantidad: solo dígitos. */
export function cantidadDesdeTexto(texto: string): number {
  const d = texto.replace(/\D/g, '').slice(0, 5)
  return d === '' ? 0 : Number(d)
}
