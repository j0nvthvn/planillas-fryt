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
    <div className="flex flex-col">
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => onKey(k)}
            aria-label={k === 'del' ? 'Borrar' : k}
            className={`h-[54px] [@media(max-height:700px)]:h-[46px] md:h-[52px] rounded-[15px] font-display text-amount-sm font-semibold tabular-nums text-ink active:scale-95 flex items-center justify-center transition-transform duration-75 ${k === 'del' ? 'bg-soft border border-hairline' : 'bg-card border border-hairline-strong active:bg-soft'}`}>
            {k === 'del' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink2" aria-hidden="true">
                <path d="M20 6H9l-5 6 5 6h11a1 1 0 001-1V7a1 1 0 00-1-1zM15 10l-4 4M11 10l4 4" />
              </svg>
            ) : <span className={k === '000' ? 'font-sans text-lg text-ink2' : ''}>{k}</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={onAccept} disabled={disabled}
        className="h-[50px] rounded-[14px] text-on-solid text-base font-semibold flex items-center justify-center gap-2 mt-3.5 bg-brand hover:bg-brand-hover disabled:bg-soft disabled:text-muted disabled:border disabled:border-hairline disabled:cursor-not-allowed">
        <Icon name="check" className="w-[18px] h-[18px]" stroke={2.4} />{label}
      </button>
    </div>
  )
}

/** Display grande del monto, coloreado según contexto. */
export function AmountDisplay({ digits, sub, color }: { digits: string; sub?: string; color?: string }) {
  const n = parseNum(digits)
  return (
    <div className="rounded-[14px] bg-soft border border-hairline px-4 py-3.5">
      {sub && <p className="eyebrow mb-2">{sub}</p>}
      <p className={`amount text-hero leading-none ${n ? 'text-ink' : 'text-muted2'}`} style={n && color ? { color } : undefined} aria-live="polite">
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
    <div className="rounded-[14px] bg-soft border border-hairline px-4 py-3.5 focus-within:border-brand transition-colors">
      {label && <p className="eyebrow mb-2">{label}</p>}
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
        className={`w-full bg-transparent border-0 p-0 outline-none focus:ring-0 font-display text-hero leading-none font-bold tracking-[-0.025em] tabular-nums placeholder:text-muted2 ${n ? '' : 'text-muted2'}`}
        style={n && color ? { color } : undefined}
      />
    </div>
  )
}

export function PayToggle({ value, onChange }: { value: 'efectivo' | 'transferencia'; onChange: (v: 'efectivo' | 'transferencia') => void }) {
  const opts = [
    { v: 'efectivo' as const, label: 'Efectivo', icon: 'cash' as const, on: 'bg-pos-tint text-pos border-pos-border' },
    { v: 'transferencia' as const, label: 'Transferencia', icon: 'bank' as const, on: 'bg-brand-tint text-brand border-brand/40' },
  ]
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Forma de pago">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-[12px] text-sm font-semibold border transition-colors ${value === o.v ? o.on : 'bg-card text-muted border-hairline-strong'}`}>
          <Icon name={o.icon} className="w-[18px] h-[18px]" />{o.label}
        </button>
      ))}
    </div>
  )
}
