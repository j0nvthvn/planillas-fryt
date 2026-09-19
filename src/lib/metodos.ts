import { toNum } from './format'

/**
 * Leer las ventas por método de una fila de vista o de un objeto de totales.
 *
 * Hasta la Fase 5 cada método es una columna de `ventas_turno`, así que las
 * vistas traen `efectivo`, `getnet`, … sueltas y no se dejan indexar por
 * `metodos_pago.key`. Esto lo resuelve en un solo lugar, en vez de repetir
 * el mismo `as unknown as Record<string, …>` en cada pantalla.
 */
export function montoDe(fila: unknown, key: string): number {
  if (!fila || typeof fila !== 'object') return 0
  return toNum((fila as Record<string, unknown>)[key])
}

/**
 * Los métodos con venta, de mayor a menor. Los que quedaron en cero no se
 * muestran (decisión de diseño: la lista dice lo que se movió, no el catálogo).
 */
export function porMetodo<M extends { key: string }>(fila: unknown, metodos: readonly M[] | undefined): (M & { monto: number })[] {
  return (metodos ?? [])
    .map((m) => ({ ...m, monto: montoDe(fila, m.key) }))
    .filter((m) => m.monto > 0)
    .sort((a, b) => b.monto - a.monto)
}
