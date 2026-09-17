import type { ReactNode } from 'react'
import { clp } from '@/lib/format'

/**
 * "Cuaderno" pasado a tabla financiera: etiquetas de sección, filas de 40 px
 * con la cifra alineada a la derecha y divisores de 1 px. Se usa donde
 * importa comparar y leer denso (planilla del día, resumen de un turno), no
 * donde se escribe. La última fila de cada sección va sin divisor.
 */
export function Ledger({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function LedgerHead({ label, right }: { label: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-3.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted2">
      <span>{label}</span>{right != null && <span>{right}</span>}
    </div>
  )
}

/** Divisor inferior salvo cuando lo que sigue no es otra fila (fin de sección). */
const FILA = 'border-b border-hairline last:border-b-0 [&:not(:has(+[data-ledger-fila]))]:border-b-0'

export function LedgerLine({ label, hint, hintTone, value, color, muted, onClick, dot }: {
  label: ReactNode; hint?: ReactNode; hintTone?: 'pos' | 'neg'; value: number | null | undefined; color?: string; muted?: boolean; onClick?: () => void; dot?: 'pos' | 'info'
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} data-ledger-fila=""
      className={`w-full flex items-center justify-between gap-3 py-1.5 min-h-[40px] text-sm text-left ${FILA} ${onClick ? 'hover:bg-soft/60 active:bg-soft' : ''}`}>
      <span className="min-w-0 flex items-center gap-[7px] text-ink2">
        {dot && <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dot === 'pos' ? 'bg-pos' : 'bg-brand'}`} />}
        <span className="truncate">{label}</span>
        {hint && (hintTone
          ? <span className={`badge shrink-0 ${hintTone === 'neg' ? 'bg-neg-tint text-neg' : 'bg-pos-tint text-pos'}`}>{hint}</span>
          : <span className="text-[11px] font-medium text-muted shrink-0">{hint}</span>)}
      </span>
      <span className={`tabular-nums shrink-0 ${muted ? 'text-muted2' : 'font-medium text-ink'}`} style={color ? { color } : undefined}>{value == null ? '—' : clp(value)}</span>
    </Tag>
  )
}

/**
 * `lg`: el neto, en una franja `bg-soft` (al pie de una tarjeta, o como
 * bloque con `className`). `sm`: un total intermedio, como fila más.
 */
export function LedgerTotal({ label, value, color, size = 'lg', className = '' }: { label: string; value: number; color?: string; size?: 'lg' | 'sm'; className?: string }) {
  if (size === 'sm') {
    return (
      <div data-ledger-fila="" className={`flex items-center justify-between gap-3 py-1.5 min-h-[40px] ${FILA} ${className}`}>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="cifra text-base text-ink shrink-0" style={color ? { color } : undefined}>{clp(value)}</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-between gap-3 bg-soft px-[18px] py-3.5 ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="amount text-2xl text-ink" style={color ? { color } : undefined}>{clp(value)}</span>
    </div>
  )
}
