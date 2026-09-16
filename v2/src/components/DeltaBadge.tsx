import { clp } from '@/lib/format'
import Icon from './Icon'

/**
 * Variación contra el período anterior del mismo largo. Sin dato previo no
 * hay %; si cambia el signo (caja negativa → positiva) el % engaña, así que
 * se muestra la diferencia en pesos.
 */
export function DeltaBadge({ actual, anterior }: { actual: number; anterior: number | null | undefined }) {
  if (anterior == null) return null
  if (anterior === 0) {
    if (actual === 0) return null
    return <span className="text-xs font-semibold text-muted2">nuevo</span>
  }
  const diff = actual - anterior
  const sube = diff > 0
  const cls = `inline-flex items-center gap-0.5 text-xs font-bold ${sube ? 'text-pos' : 'text-neg'}`
  if ((actual >= 0) !== (anterior >= 0)) {
    return <span className={cls}><Icon name={sube ? 'caretUp' : 'caretDown'} className="w-3 h-3" stroke={3} />{sube ? '+' : '−'}{clp(Math.abs(diff))}</span>
  }
  const pct = (diff / Math.abs(anterior)) * 100
  if (Math.abs(pct) < 0.5) return <span className="text-xs font-medium text-muted2">≈ igual</span>
  return <span className={cls}><Icon name={sube ? 'caretUp' : 'caretDown'} className="w-3 h-3" stroke={3} />{Math.abs(pct).toFixed(0)}%</span>
}
