import type { ReactNode } from 'react'
import { clp } from '@/lib/format'

/**
 * "Cuaderno": filas regladas con la cifra alineada a la derecha, como la
 * planilla de papel. Se usa donde importa comparar y leer denso (planilla
 * del día, resumen de un turno), no donde se escribe.
 */
export function Ledger({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border-t-2 border-brand ${className}`}>{children}</div>
}

export function LedgerHead({ label, right = '$' }: { label: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-3.5 pb-1.5 border-b border-brand text-xs font-bold uppercase tracking-[0.12em] text-brand">
      <span>{label}</span><span>{right}</span>
    </div>
  )
}

export function LedgerLine({ label, hint, value, color, muted, onClick, dot }: {
  label: ReactNode; hint?: ReactNode; value: number | null | undefined; color?: string; muted?: boolean; onClick?: () => void; dot?: 'pos' | 'info'
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`w-full flex items-baseline justify-between gap-3 py-2 min-h-[44px] border-b border-hairline text-base text-left ${onClick ? 'hover:bg-soft/60 active:bg-soft' : ''}`}>
      <span className="min-w-0 flex items-baseline gap-2 text-ink">
        {dot && <span className={`w-2 h-2 rounded-full shrink-0 self-center ${dot === 'pos' ? 'bg-pos' : 'bg-info'}`} />}
        <span className="truncate">{label}</span>
        {hint && <span className="text-xs text-muted shrink-0">{hint}</span>}
      </span>
      <span className={`tabular-nums font-semibold shrink-0 ${muted ? 'text-muted2 font-medium' : ''}`} style={color ? { color } : undefined}>{value == null ? '—' : clp(value)}</span>
    </Tag>
  )
}

export function LedgerTotal({ label, value, color, size = 'lg' }: { label: string; value: number; color?: string; size?: 'lg' | 'sm' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${size === 'lg' ? 'pt-2.5 mt-0.5 border-t border-dashed border-brand' : 'pt-1'}`}>
      <span className={size === 'lg' ? 'font-bold text-ink' : 'text-sm text-muted'}>{label}</span>
      <span className={`${size === 'lg' ? 'amount text-2xl' : 'tabular-nums font-semibold text-base'}`} style={color ? { color } : undefined}>{clp(value)}</span>
    </div>
  )
}
