import { useState, useEffect } from 'react'
import { clp, parseNum } from '../../utils/format'
import { BottomSheet, DesktopAmountInput, Keypad, applyKey, GREEN } from '../TurnoInput'

/**
 * Editar el fondo de caja (vuelto) con el que abrió este turno. Se
 * precarga con el valor actual (el default de Configuración, o el que
 * ya haya quedado guardado en el turno). El cambio se refleja de
 * inmediato en "Efectivo esperado" al cerrar.
 */
export function FondoCajaSheet({ open, isDesktop, valorActual, onGuardar, onClose }) {
  const [monto, setMonto] = useState('')

  useEffect(() => {
    if (open) setMonto(valorActual ? String(valorActual) : '')
  }, [open, valorActual])

  if (!open) return null

  const n = parseNum(monto)

  const contenido = (
    <>
      <p className="text-[13px] text-muted -mt-1">
        Monto con el que se abrió la caja este turno (vuelto). Se usa para calcular el efectivo esperado al cerrar.
      </p>
      {isDesktop ? (
        <DesktopAmountInput value={monto} onChange={setMonto} color={GREEN} label="Fondo de caja" autoFocus onEnter={() => onGuardar(n)} />
      ) : (
        <div className="rounded-2xl bg-canvas border border-hairline px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted2 mb-1">Fondo de caja</p>
          <p className={`amount text-[32px] leading-none ${monto ? 'text-ink' : 'text-muted2'}`}>{monto ? clp(n) : '$0'}</p>
        </div>
      )}
      {!isDesktop && (
        <Keypad onKey={(k) => setMonto((c) => applyKey(c, k))} onAccept={() => onGuardar(n)} accent={GREEN} label="Guardar" />
      )}
      {isDesktop && (
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
          <button onClick={() => onGuardar(n)} className="flex-1 btn-primary">Guardar</button>
        </div>
      )}
    </>
  )

  if (isDesktop) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={onClose} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6">
            <h3 className="text-lg font-bold text-ink">Fondo de caja</h3>
            {contenido}
          </div>
        </div>
      </>
    )
  }

  return (
    <BottomSheet title="Fondo de caja" onClose={onClose}>
      {contenido}
    </BottomSheet>
  )
}
