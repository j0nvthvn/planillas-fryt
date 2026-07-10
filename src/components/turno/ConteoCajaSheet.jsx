import { useState, useEffect } from 'react'
import { clp, parseNum } from '../../utils/format'
import Icon from '../Icon'
import {
  BottomSheet, DesktopAmountInput, Keypad, applyKey, GREEN,
} from '../TurnoInput'

/**
 * Paso de cierre de turno: muestra el efectivo esperado (ventas en
 * efectivo − proveedores pagados en efectivo) y permite ingresar el
 * conteo físico de la caja antes de cerrar. Es opcional — "Cerrar sin
 * contar" cierra igual el turno, sin registrar diferencia. Si se
 * ingresa un conteo, queda guardado junto al resto del snapshot
 * inmutable en turno_cierres, para poder ver después si hubo
 * sobrante o faltante (ver ConteoCierre en Resumen.jsx).
 */
export function ConteoCajaSheet({ open, isDesktop, efectivoEsperado, guardando, onConfirmar, onOmitir, onClose }) {
  const [contado, setContado] = useState('')

  useEffect(() => {
    if (open) setContado('')
  }, [open])

  if (!open) return null

  const n = parseNum(contado)
  const tieneValor = contado !== ''
  const diferencia = n - efectivoEsperado
  const diferenciaLabel = diferencia === 0
    ? 'Cuadra exacto'
    : diferencia > 0 ? `Sobran ${clp(diferencia)}` : `Faltan ${clp(Math.abs(diferencia))}`
  const diferenciaColor = diferencia === 0 ? 'text-pos' : diferencia > 0 ? 'text-info' : 'text-neg'

  const contenido = (
    <>
      <div className="rounded-2xl bg-card border border-hairline px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted2 mb-1">Efectivo esperado</p>
        <p className="amount text-[28px] leading-none text-ink">{clp(efectivoEsperado)}</p>
        <p className="text-[11px] text-muted mt-1">Ventas en efectivo − proveedores pagados en efectivo</p>
      </div>

      {isDesktop ? (
        <DesktopAmountInput
          value={contado}
          onChange={setContado}
          color={GREEN}
          label="Efectivo contado (opcional)"
          autoFocus
        />
      ) : (
        <div className="rounded-2xl bg-canvas border border-hairline px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted2 mb-1">Efectivo contado (opcional)</p>
          <p className={`amount text-[32px] leading-none ${tieneValor ? 'text-ink' : 'text-muted2'}`}>
            {tieneValor ? clp(n) : '$0'}
          </p>
        </div>
      )}

      {tieneValor && (
        <p className={`text-[13px] font-semibold ${diferenciaColor}`}>{diferenciaLabel}</p>
      )}

      {!isDesktop && (
        <Keypad
          onKey={(k) => setContado((c) => applyKey(c, k))}
          onAccept={() => onConfirmar(n)}
          disabled={!tieneValor || guardando}
          accent={GREEN}
          label="Confirmar cierre"
        />
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onOmitir} disabled={guardando} className="flex-1 btn-secondary">
          Cerrar sin contar
        </button>
        {isDesktop && (
          <button
            onClick={() => onConfirmar(n)}
            disabled={guardando || !tieneValor}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <Icon name="check" className="w-4 h-4" stroke={2.4} /> Confirmar cierre
          </button>
        )}
      </div>
    </>
  )

  if (isDesktop) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={onClose} />
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Cerrar turno</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-hairline text-ink2" aria-label="Cerrar">
                <Icon name="close" className="w-[15px] h-[15px]" />
              </button>
            </div>
            {contenido}
          </div>
        </div>
      </>
    )
  }

  return (
    <BottomSheet title="Cerrar turno" onClose={onClose}>
      {contenido}
    </BottomSheet>
  )
}
