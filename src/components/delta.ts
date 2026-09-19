import { clp } from '@/lib/format'

export type Delta =
  | { tipo: 'nuevo' }
  | { tipo: 'igual' }
  /** `sube` es hacia dónde se movió la cifra; `bueno`, si eso es buena noticia. */
  | { tipo: 'cambio'; sube: boolean; bueno: boolean; texto: string }

/**
 * Variación contra el período anterior. Sin dato previo no hay nada; si
 * cambia el signo (caja negativa → positiva) el % engaña, así que se da la
 * diferencia en pesos. Con `menosEsMejor` (gastos) la flecha sigue a la
 * cifra y solo el color se da vuelta: bajar 24 % es ▼ 24 % en verde.
 */
export function calcularDelta(actual: number, anterior: number | null | undefined, menosEsMejor = false): Delta | null {
  if (anterior == null) return null
  if (anterior === 0) return actual === 0 ? null : { tipo: 'nuevo' }
  const diff = actual - anterior
  if (diff === 0) return { tipo: 'igual' }
  const sube = diff > 0
  const bueno = sube !== menosEsMejor
  if ((actual >= 0) !== (anterior >= 0)) return { tipo: 'cambio', sube, bueno, texto: `${sube ? '+' : '−'}${clp(Math.abs(diff))}` }
  const pct = (diff / Math.abs(anterior)) * 100
  if (Math.abs(pct) < 0.5) return { tipo: 'igual' }
  return { tipo: 'cambio', sube, bueno, texto: `${Math.abs(pct).toFixed(0)}%` }
}
