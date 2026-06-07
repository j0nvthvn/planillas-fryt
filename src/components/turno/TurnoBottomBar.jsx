import { clp } from '../../utils/format'
import { ACCENT, GREEN, NAVY } from '../TurnoInput'

/* Barra fija inferior: totales del turno + botón de guardar.
   En mobile queda sobre la bottom nav (.above-nav); en desktop, abajo. */
export function TurnoBottomBar({ totalVentas, totalProveedores, efProv, guardando, disabled, label, onGuardar }) {
  return (
    <div className="above-nav fixed inset-x-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 pt-3 safe-bottom z-30">
      <div className="max-w-4xl mx-auto px-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500">Ventas</p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">{clp(totalVentas)}</p>
            </div>
            {totalProveedores > 0 && (
              <>
                <span className="text-gray-200 dark:text-zinc-700 text-lg">|</span>
                <div>
                  <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500">Proveedores</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: efProv > 0 ? GREEN : NAVY }}>{clp(totalProveedores)}</p>
                </div>
              </>
            )}
          </div>
        </div>
        <button onClick={onGuardar} disabled={guardando || disabled}
          className="h-12 px-7 rounded-xl text-white font-semibold disabled:opacity-50 shrink-0 flex items-center gap-2"
          style={{ background: ACCENT }}>
          {guardando && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
          {guardando ? 'Guardando…' : label}
        </button>
      </div>
    </div>
  )
}
