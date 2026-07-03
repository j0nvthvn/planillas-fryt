import { clp } from '../../utils/format'
import { ACCENT } from '../TurnoInput'

/* Barra fija inferior: total del turno + botón Guardar.
   En mobile queda sobre la bottom nav; en desktop, abajo. */
export function TurnoBottomBar({ total, guardando, disabled, label, onGuardar }) {
  return (
    <div className="above-nav fixed inset-x-0 bg-canvas border-t border-hairline pt-3 safe-bottom z-30">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={onGuardar}
          disabled={guardando || disabled}
          className="btn-primary w-full py-3.5 text-base gap-2 disabled:opacity-40"
          style={{ background: ACCENT }}
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
