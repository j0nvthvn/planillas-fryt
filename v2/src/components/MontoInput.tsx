import { clp, parseNum } from '@/lib/format'

/** Campo de pesos en línea: muestra "$20.000" y devuelve el número. */
export function MontoInput({ value, onChange, id, className = '', ariaLabel }: { value: number; onChange: (n: number) => void; id?: string; className?: string; ariaLabel?: string }) {
  const n = Math.max(0, Math.round(Number(value) || 0))
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      className={`input tabular-nums ${className}`}
      value={n ? clp(n) : ''}
      placeholder="$0"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9)
        e.target.value = digits ? clp(parseNum(digits)) : ''
        onChange(digits ? parseNum(digits) : 0)
      }}
    />
  )
}

/** Hora en punto (0–23) mostrada como selector de hora del sistema. */
export function HoraInput({ value, onChange, id, className = '', ariaLabel }: { value: number; onChange: (h: number) => void; id?: string; className?: string; ariaLabel?: string }) {
  const h = Math.min(23, Math.max(0, Math.round(Number(value) || 0)))
  return (
    <input
      id={id}
      type="time"
      step={3600}
      aria-label={ariaLabel}
      className={`input tabular-nums ${className}`}
      value={`${String(h).padStart(2, '0')}:00`}
      onChange={(e) => {
        const hh = parseInt(e.target.value.split(':')[0] ?? '', 10)
        if (!Number.isNaN(hh)) onChange(hh)
      }}
    />
  )
}
