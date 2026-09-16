import { clp, parseNum } from '@/lib/format'
import Icon from './Icon'

/** Estado del teclado: string de dígitos ("" = vacío). Máximo 9 dígitos. */
export function applyKey(cur: string, k: string): string {
  let v = String(cur ?? '')
  if (k === 'del') return v.slice(0, -1)
  if (k === '000') v = v === '' ? '' : v + '000'
  else v = v === '' || v === '0' ? k : v + k
  return v.replace(/^0+(?=\d)/, '').slice(0, 9)
}

export function digitosANumero(d: string): number {
  return parseNum(d)
}

export function numeroADigitos(n: number | null | undefined): string {
  const v = Math.max(0, Math.round(Number(n) || 0))
  return v === 0 ? '' : String(v)
}

interface KeypadProps {
  onKey: (k: string) => void
  onAccept: () => void
  disabled?: boolean
  label: string
}

export function Keypad({ onKey, onAccept, disabled, label }: KeypadProps) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '000', '0', 'del']
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => onKey(k)}
            aria-label={k === 'del' ? 'Borrar' : k}
            className={`h-[54px] md:h-[52px] rounded-[15px] text-[23px] font-semibold text-ink active:scale-95 flex items-center justify-center transition-transform duration-75 ${k === 'del' ? 'bg-soft' : 'bg-card border border-hairline'}`}>
            {k === 'del' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2">
                <path d="M20 6H9l-5 6 5 6h11a1 1 0 001-1V7a1 1 0 00-1-1zM15 10l-4 4M11 10l4 4" />
              </svg>
            ) : <span className={k === '000' ? 'text-[18px] text-ink2' : ''}>{k}</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={onAccept} disabled={disabled}
        className="h-12 rounded-2xl text-white text-base font-bold flex items-center justify-center gap-2 mt-1 bg-brand disabled:bg-muted2/60 disabled:cursor-not-allowed">
        <Icon name="check" className="w-5 h-5" stroke={2.4} />{label}
      </button>
    </div>
  )
}

/** Display grande del monto, coloreado según contexto. */
export function AmountDisplay({ digits, sub, color }: { digits: string; sub?: string; color?: string }) {
  const n = parseNum(digits)
  return (
    <div className="rounded-2xl bg-card border border-hairline px-4 py-3">
      {sub && <p className="eyebrow mb-1">{sub}</p>}
      <p className={`amount text-[44px] leading-none ${n ? 'text-ink' : 'text-muted2'}`} style={n && color ? { color } : undefined} aria-live="polite">
        {clp(n)}
      </p>
    </div>
  )
}

/** Entrada por teclado físico (escritorio): solo dígitos, formato en vivo. */
export function DesktopAmountInput({ digits, onChange, onEnter, color, label, autoFocus = true }: {
  digits: string; onChange: (d: string) => void; onEnter?: () => void; color?: string; label?: string; autoFocus?: boolean
}) {
  const n = parseNum(digits)
  return (
    <div className="rounded-2xl bg-canvas border border-hairline px-4 py-3 focus-within:border-brand transition-colors">
      {label && <p className="text-xs font-medium text-ink2 mb-0.5">{label}</p>}
      <input
        type="text" inputMode="numeric" autoFocus={autoFocus}
        value={digits ? clp(n) : ''}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9)
          e.target.value = next ? clp(parseNum(next)) : ''
          onChange(next)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }}
        placeholder="$0"
        aria-label={label ?? 'Monto'}
        className={`w-full bg-transparent border-0 p-0 outline-none focus:ring-0 text-4xl font-semibold tracking-tight tabular-nums placeholder:text-muted2 ${n ? '' : 'text-muted2'}`}
        style={n && color ? { color } : undefined}
      />
    </div>
  )
}

export function PayToggle({ value, onChange }: { value: 'efectivo' | 'transferencia'; onChange: (v: 'efectivo' | 'transferencia') => void }) {
  const opts = [
    { v: 'efectivo' as const, label: 'Efectivo', icon: 'cash' as const, on: 'bg-pos-tint text-pos border-pos' },
    { v: 'transferencia' as const, label: 'Transferencia', icon: 'bank' as const, on: 'bg-info-tint text-info border-info' },
  ]
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Forma de pago">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl text-sm font-semibold border ${value === o.v ? o.on : 'bg-card text-muted border-hairline'}`}>
          <Icon name={o.icon} className="w-[18px] h-[18px]" />{o.label}
        </button>
      ))}
    </div>
  )
}
