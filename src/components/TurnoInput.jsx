import { useState, useRef, useEffect } from 'react'
import { parseNum, clp } from '../utils/format'

/* ── Colores de marca ─────────────────────────────────────── */
export const ACCENT = '#5C3317'
export const ACCENT_TINT = '#F5EAD4'
export const GREEN = '#1E7A4F'
export const NAVY = '#33518C'

export const METODOS_VENTA = [
  { key: 'efectivo',      label: 'Efectivo',      sub: 'Caja',              logo: '/metodos/efectivo.png' },
  { key: 'getnet',        label: 'Getnet',         sub: 'Débito / Crédito',  logo: '/metodos/getnet.png' },
  { key: 'mercadopago',   label: 'Mercado Pago',   sub: 'Débito / Crédito',  logo: '/metodos/mercadopago.png' },
  { key: 'edenred',       label: 'Edenred',        sub: 'Sodexo / Ticket',   logo: '/metodos/edenred.png' },
  { key: 'amipass',       label: 'Amipass',        sub: 'Tarjeta beneficio', logo: '/metodos/amipass.png' },
  { key: 'transferencia', label: 'Transferencia',  sub: 'Banco',             logo: '/metodos/transferencia.png' },
]

/* ── Logo de método de pago ──────────────────────────────── */
const METODO_FALLBACK = {
  efectivo:      { d: 'M3 7h18v10H3zM12 9.7a2.3 2.3 0 100 4.6', color: '#1E7A4F', bg: '#EDFAF3' },
  transferencia: { d: 'M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18', color: '#33518C', bg: '#EBF0FA' },
}

const LOGO_SIZES = {
  sm: { container: 'w-8 h-8 rounded-lg',   img: 'w-6 h-6', icon: 'w-4 h-4' },
  md: { container: 'w-11 h-11 rounded-xl',  img: 'w-9 h-9', icon: 'w-5 h-5' },
}

export function MetodoLogo({ metodo, active = false, size = 'md' }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [metodo.logo])
  const fb = METODO_FALLBACK[metodo.key]
  const showImg = !!metodo.logo && !imgError
  const sz = LOGO_SIZES[size] ?? LOGO_SIZES.md
  return (
    <span
      className={`relative shrink-0 flex items-center justify-center ${sz.container}`}
      style={{ background: showImg ? '#F3F4F6' : (fb?.bg ?? '#F3F4F6') }}
    >
      {showImg && (
        <img
          src={metodo.logo}
          alt={metodo.label}
          className={`${sz.img} object-contain`}
          onError={() => setImgError(true)}
        />
      )}
      {!showImg && fb && (
        <svg viewBox="0 0 24 24" fill="none" className={sz.icon}
          stroke={fb.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={fb.d} />
        </svg>
      )}
      {active && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ background: '#1E7A4F' }} />
      )}
    </span>
  )
}
export const VENTAS_VACIAS = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }

/* ── Avatar ───────────────────────────────────────────────── */
export const AVATAR_COLORS = ['#5C3317', '#1E7A4F', '#33518C', '#B45309', '#0F766E', '#BE185D']
export function avatarColor(nombre) {
  let h = 0
  for (const c of String(nombre)) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/* ── Teclado numérico helper ─────────────────────────────── */
export function applyKey(cur, k) {
  let v = String(cur || '')
  if (k === 'del') return v.slice(0, -1)
  if (k === '000') v = v === '' ? '' : v + '000'
  else v = v === '' || v === '0' ? k : v + k
  return v.replace(/^0+(?=\d)/, '').slice(0, 9)
}

/* ── Iconos locales (paths propios del flujo de turno) ───── */
export function TurnoIcon({ name, className = 'w-5 h-5', stroke = 1.7 }) {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    check: 'M4 12.5l5 5L20 6.5',
    trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
    chevR: 'M9 5l7 7-7 7',
    close: 'M6 6l12 12M18 6L6 18',
    store: 'M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16',
    cash: 'M3 7h18v10H3zM12 9.7a2.3 2.3 0 100 4.6 2.3 2.3 0 000-4.6',
    bank: 'M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5',
    moon: 'M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

/* ── ProveedorAvatar ─────────────────────────────────────── */
export function ProveedorAvatar({ nombre = '', imagen_url, size = 'md' }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [imagen_url])
  const inicial = (nombre[0] || '?').toUpperCase()
  const color = avatarColor(nombre || '?')
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-16 h-16 text-2xl' }
  const base = `${sizes[size]} rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white`

  if (imagen_url && !imgError) {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    return (
      <div className={base} style={{ background: isDark ? '#3f3f46' : '#F3F4F6' }}>
        <img src={imagen_url} alt={nombre} className="w-full h-full object-contain p-0.5"
          onError={() => { console.warn('[Avatar] No se pudo cargar:', imagen_url); setImgError(true) }} />
      </div>
    )
  }
  return <div className={base} style={{ background: color }}>{inicial}</div>
}

/* ── SectionHead ─────────────────────────────────────────── */
export function SectionHead({ title, right }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{title}</h2>
      {right != null && <span className="text-sm font-semibold" style={{ color: ACCENT }}>{right}</span>}
    </div>
  )
}

/* ── BottomSheet ─────────────────────────────────────────── */
export function BottomSheet({ title, children, onClose, extra }) {
  const startYRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function onPointerDown(e) {
    if (isDesktop) return
    if (e.target.closest('[data-handle]')) {
      startYRef.current = e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMove(e) {
    if (startYRef.current === null) return
    const delta = Math.max(0, e.clientY - startYRef.current)
    setDragY(delta)
  }

  function onPointerUp() {
    if (dragY > 80) onClose()
    setDragY(0)
    startYRef.current = null
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-zinc-900 rounded-t-3xl px-4 pt-3 shadow-2xl max-h-[92%] overflow-y-auto flex flex-col gap-3 safe-bottom md:inset-x-auto md:left-1/2 md:bottom-auto md:top-[8vh] md:w-[480px] md:rounded-3xl md:max-h-[80vh]"
      style={{
        animation: dragY === 0 ? 'sheetUp .26s cubic-bezier(.2,.8,.2,1)' : 'none',
        transform: isDesktop ? 'translateX(-50%)' : `translateY(${dragY}px)`,
        transition: dragY === 0 ? 'transform .2s ease' : 'none',
        willChange: 'transform',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      {/* Handle — área de arrastre */}
      <div data-handle className="md:hidden w-full flex justify-center pt-1 pb-2 -mx-4 px-4 cursor-grab active:cursor-grabbing touch-none">
        <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
        <div className="flex gap-2">
          {extra}
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300" aria-label="Cerrar">
            <TurnoIcon name="close" className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

/* ── FreqChips ───────────────────────────────────────────── */
const FREQ_MAX = 5

export function FreqChips({ query = '', used = [], sugerencias = [], onPick }) {
  const [expandido, setExpandido] = useState(false)
  const q = query.trim().toLowerCase()
  const filtrado = q
    ? sugerencias.filter((s) => s.nombre.toLowerCase().includes(q))
    : sugerencias

  // Al buscar siempre muestra todo; sin búsqueda limita según estado
  const list = q || expandido ? filtrado : filtrado.slice(0, FREQ_MAX)
  const hayMas = !q && filtrado.length > FREQ_MAX

  if (filtrado.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:flex-wrap md:overflow-x-visible md:mx-0 md:px-0 ${expandido || q ? 'md:max-h-48 md:overflow-y-auto md:pr-1' : ''}`}>
        {list.map((s) => {
          const on = used.includes(s.nombre)
          return (
            <button key={s.nombre} onClick={() => onPick(s)}
              className={`shrink-0 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium border whitespace-nowrap transition ${
                on ? '' : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-600'
              }`}
              style={on ? { background: ACCENT_TINT, color: ACCENT, borderColor: ACCENT } : undefined}>
              <ProveedorAvatar nombre={s.nombre} imagen_url={s.imagen_url} size="sm" />
              {s.nombre}
              {on && <TurnoIcon name="check" className="w-3 h-3" stroke={2.4} />}
            </button>
          )
        })}
      </div>
      {hayMas && (
        <button
          onClick={() => setExpandido((v) => !v)}
          className="self-start text-xs font-medium text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition">
          {expandido ? 'Ver menos' : `Ver todos (${filtrado.length})`}
        </button>
      )}
    </div>
  )
}

/* ── DesktopAmountInput ──────────────────────────────────── */
export function DesktopAmountInput({ value, onChange, color = '#191B1F', label, autoFocus = true, onEnter }) {
  const n = parseNum(value)
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 px-4 py-3">
        {label && <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-0.5">{label}</p>}
        <p className={`text-4xl font-semibold tracking-tight tabular-nums ${!n ? 'text-gray-300 dark:text-zinc-600' : ''}`} style={n ? { color } : undefined}>
          {clp(n)}
        </p>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value || ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder="Ingresa el monto..."
        className="input"
      />
    </div>
  )
}

/* ── AmountDisplay ───────────────────────────────────────── */
export function AmountDisplay({ value, sub, color = '#191B1F' }) {
  const n = parseNum(value)
  const empty = !n
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 px-4 py-3">
      {sub && <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-0.5">{sub}</p>}
      <p className={`text-4xl font-semibold tracking-tight tabular-nums ${empty ? 'text-gray-300 dark:text-zinc-600' : ''}`} style={!empty ? { color } : undefined}>
        {clp(n)}
      </p>
    </div>
  )
}

/* ── PayToggle ───────────────────────────────────────────── */
export function PayToggle({ value, onChange }) {
  const opts = [
    { v: 'efectivo', label: 'Efectivo', icon: 'cash', c: GREEN, tint: '#E6F1EA' },
    { v: 'transferencia', label: 'Transferencia', icon: 'bank', c: NAVY, tint: '#E8EDF6' },
  ]
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border ${
              on ? '' : 'bg-white dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 border-gray-200 dark:border-zinc-600'
            }`}
            style={on ? { background: o.tint, color: o.c, borderColor: o.c } : undefined}>
            <TurnoIcon name={o.icon} className="w-[18px] h-[18px]" stroke={1.8} />{o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Keypad ──────────────────────────────────────────────── */
export function Keypad({ onKey, onAccept, disabled, accent, label }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '000', '0', 'del']
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button key={k} onClick={() => onKey(k)}
            className="h-12 md:h-14 rounded-2xl border border-gray-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-2xl font-medium text-gray-900 dark:text-zinc-100 active:bg-gray-200 dark:active:bg-zinc-700 active:scale-95 flex items-center justify-center transition-transform duration-75"
            style={{ touchAction: 'manipulation' }}>
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <button onClick={onAccept} disabled={disabled}
        className="h-12 rounded-2xl text-white text-base font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300 dark:disabled:bg-zinc-600"
        style={!disabled ? { background: accent } : undefined}>
        <TurnoIcon name="check" className="w-5 h-5" stroke={2.4} />{label}
      </button>
    </div>
  )
}
