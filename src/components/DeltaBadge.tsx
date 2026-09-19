import Icon from './Icon'
import { calcularDelta } from './delta'

/** Variación contra el período anterior del mismo largo (ver `calcularDelta`). */
export function DeltaBadge({ actual, anterior, fondo = false, menosEsMejor = false }: { actual: number; anterior: number | null | undefined; fondo?: boolean; menosEsMejor?: boolean }) {
  const d = calcularDelta(actual, anterior, menosEsMejor)
  if (!d) return null
  if (d.tipo === 'nuevo') return <span className={`text-xs font-semibold text-muted2 ${fondo ? 'rounded-[7px] bg-soft px-[7px] py-1' : ''}`}>nuevo</span>
  if (d.tipo === 'igual') return <span className={`text-xs font-medium text-muted2 ${fondo ? 'rounded-[7px] bg-soft px-[7px] py-1' : ''}`}><span aria-hidden="true">≈ </span>igual</span>
  const cls = `inline-flex items-center gap-[3px] text-xs font-semibold tabular-nums ${d.bueno ? 'text-pos' : 'text-neg'} ${fondo ? `rounded-[7px] px-[7px] py-1 ${d.bueno ? 'bg-pos-tint' : 'bg-neg-tint'}` : ''}`
  return <span className={cls}><Icon name={d.sube ? 'caretUp' : 'caretDown'} className="w-[11px] h-[11px]" stroke={3} /><span className="sr-only">{d.sube ? 'sube' : 'baja'} </span>{d.texto}</span>
}
