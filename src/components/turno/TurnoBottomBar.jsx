import { useEffect, useRef } from 'react'
import { clp } from '../../utils/format'

/* Barra fija inferior: total del turno + botón Guardar.
   En mobile queda sobre la bottom nav; en desktop, abajo.
   Publica su alto en --sticky-bar-h para que los toasts (Toast.jsx,
   clase .above-sticky-bar) no queden tapados detrás del botón Guardar. */
export function TurnoBottomBar({ total, guardando, disabled, label, onGuardar }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const setH = () => document.documentElement.style.setProperty('--sticky-bar-h', `${el.offsetHeight}px`)
    setH()
    const ro = new ResizeObserver(setH)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--sticky-bar-h')
    }
  }, [])

  return (
    <div ref={ref} className="above-nav fixed inset-x-0 bg-canvas border-t border-hairline pt-3 safe-bottom z-30">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={onGuardar}
          disabled={guardando || disabled}
          className="btn-primary w-full py-3.5 text-base gap-2 disabled:opacity-40"
        >
          {guardando && (
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          <span className="flex-1 text-left">{guardando ? 'Guardando…' : label}</span>
          {!guardando && (
            <span className="font-display tabular-nums text-[18px]">
              {clp(total)}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
