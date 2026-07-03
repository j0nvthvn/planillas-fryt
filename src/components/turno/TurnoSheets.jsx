import { useEffect } from 'react'
import { parseNum } from '../../utils/format'
import {
  ACCENT, GREEN, NAVY, METODOS_VENTA, applyKey,
  TurnoIcon as Icon, BottomSheet, FreqChips, AmountDisplay,
  PayToggle, Keypad, DesktopAmountInput,
} from '../TurnoInput'

/**
 * Editor de monto compartido (proveedor o venta), en modal de escritorio o bottom
 * sheet móvil. Lo usan Turno y EditarTurno con la misma UX.
 */
export function TurnoSheets({ sheet, setSheet, isDesktop, sugerencias, usedNames, commitProv, commitVenta, delProv }) {
  useEffect(() => {
    if (!sheet) return
    const onKey = (e) => { if (e.key === 'Escape') setSheet(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, setSheet])

  if (!sheet) return null

  const metodo = sheet.mode === 'venta' ? METODOS_VENTA.find((m) => m.key === sheet.key) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={() => setSheet(null)} />

      {/* ── Modal escritorio ───────────────────────────────── */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSheet(null) }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">
                {sheet.mode === 'venta'
                  ? `Ventas · ${metodo.label}`
                  : sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'}
              </h3>
              <div className="flex gap-2">
                {sheet.mode === 'prov' && sheet.idx !== -1 && (
                  <button onClick={() => delProv(sheet.idx)} className="w-8 h-8 rounded-full grid place-items-center bg-neg-tint text-neg">
                    <Icon name="trash" className="w-[18px] h-[18px]" />
                  </button>
                )}
                <button onClick={() => setSheet(null)} className="w-8 h-8 rounded-full grid place-items-center bg-hairline text-ink2">
                  <Icon name="close" className="w-[17px] h-[17px]" />
                </button>
              </div>
            </div>

            {sheet.mode === 'venta' && (
              <>
                <DesktopAmountInput
                  value={sheet.monto}
                  onChange={(v) => setSheet((s) => ({ ...s, monto: v }))}
                  color={ACCENT}
                  label={metodo.sub}
                  onEnter={commitVenta}
                />
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setSheet(null)} className="flex-1 btn-secondary">Cancelar</button>
                  <button onClick={commitVenta} disabled={parseNum(sheet.monto) === 0} className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} /> Listo
                  </button>
                </div>
              </>
            )}

            {sheet.mode === 'prov' && (
              <>
                <div className="relative">
                  <Icon name="store" className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
                  <input value={sheet.nombre} onChange={(e) => setSheet((s) => ({ ...s, nombre: e.target.value }))}
                    placeholder="Buscar o escribir proveedor" className="input !pl-10"
                    type="text" autoFocus autoComplete="off" autoCorrect="off"
                    autoCapitalize="words" spellCheck={false} />
                </div>
                <FreqChips query={sheet.nombre} used={usedNames} sugerencias={sugerencias}
                  onPick={(s) => setSheet((prev) => ({ ...prev, nombre: s.nombre, imagen_url: s.imagen_url || '' }))} />
                <DesktopAmountInput
                  value={sheet.monto}
                  onChange={(v) => setSheet((s) => ({ ...s, monto: v }))}
                  color={sheet.forma_pago === 'efectivo' ? GREEN : NAVY}
                  label="Monto"
                  autoFocus={false}
                  onEnter={commitProv}
                />
                <PayToggle value={sheet.forma_pago} onChange={(fp) => setSheet((s) => ({ ...s, forma_pago: fp }))} />
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setSheet(null)} className="flex-1 btn-secondary">Cancelar</button>
                  <button onClick={commitProv} disabled={parseNum(sheet.monto) === 0} className="flex-1 btn-primary">
                    <Icon name="check" className="w-4 h-4" stroke={2.4} />
                    {sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modales móvil (BottomSheet) ────────────────────── */}
      {!isDesktop && (
        <>
          {sheet.mode === 'prov' && (
            <BottomSheet
              title={sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'}
              onClose={() => setSheet(null)}
              extra=              {sheet.idx !== -1 && (
                <button onClick={() => delProv(sheet.idx)} className="w-8 h-8 rounded-full grid place-items-center bg-neg-tint text-neg">
                  <Icon name="trash" className="w-[18px] h-[18px]" />
                </button>
              )}>
              <div className="relative">
                <Icon name="store" className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
                <input value={sheet.nombre} onChange={(e) => setSheet((s) => ({ ...s, nombre: e.target.value }))}
                  placeholder="Buscar o escribir proveedor" className="input !pl-10"
                  type="text" inputMode="text" autoComplete="off" autoCorrect="off"
                  autoCapitalize="words" spellCheck={false} />
              </div>
              <FreqChips query={sheet.nombre} used={usedNames} sugerencias={sugerencias}
                onPick={(s) => setSheet((prev) => ({ ...prev, nombre: s.nombre, imagen_url: s.imagen_url || '' }))} />
              <AmountDisplay value={sheet.monto} color={sheet.forma_pago === 'efectivo' ? GREEN : NAVY} />
              <PayToggle value={sheet.forma_pago} onChange={(fp) => setSheet((s) => ({ ...s, forma_pago: fp }))} />
              <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
                onAccept={commitProv} disabled={parseNum(sheet.monto) === 0}
                accent={sheet.forma_pago === 'efectivo' ? GREEN : NAVY}
                label={sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'} />
            </BottomSheet>
          )}
          {sheet.mode === 'venta' && (
            <BottomSheet title={`Ventas · ${metodo.label}`} onClose={() => setSheet(null)}>
              <AmountDisplay value={sheet.monto} sub={metodo.sub} />
              <Keypad onKey={(k) => setSheet((s) => ({ ...s, monto: applyKey(s.monto, k) }))}
                onAccept={commitVenta} accent={ACCENT} label="Listo" />
            </BottomSheet>
          )}
        </>
      )}
    </>
  )
}
