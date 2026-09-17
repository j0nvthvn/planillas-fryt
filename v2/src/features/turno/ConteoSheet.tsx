import { useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import Icon from '@/components/Icon'
import { clp, clpSigno } from '@/lib/format'
import { DENOMINACIONES, ajustar, cantidad, cantidadDesdeTexto, fijar, hayConteo, totalConteo, type Conteo } from './conteo'

interface Props {
  inicial: Conteo
  /** Lo que debería haber en el cajón según el turno. */
  esperado: number
  onAccept: (total: number, desglose: Conteo) => void
  /** Ya contó fuera de la app: escribir el total de una vez. */
  onTotalManual: () => void
  onClose: () => void
}

/** Conteo de caja por billetes y monedas, con la suma en vivo. */
export function ConteoSheet({ inicial, esperado, onAccept, onTotalManual, onClose }: Props) {
  const [conteo, setConteo] = useState<Conteo>(inicial)
  const total = totalConteo(conteo)
  const diferencia = total - esperado
  const vacio = !hayConteo(conteo)

  return (
    <BottomSheet title="Conteo de caja" onClose={onClose} footer={<>
      <button type="button" className="btn-primary w-full min-h-[50px] text-base" disabled={vacio} onClick={() => onAccept(total, conteo)}>
        <Icon name="check" className="w-[18px] h-[18px]" stroke={2.4} />Registrar conteo
      </button>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-sm text-ink2" onClick={onTotalManual}>Escribir el total a mano</button>
        {!vacio && <button type="button" className="btn-ghost min-h-[40px] px-2.5 text-sm text-neg" onClick={() => setConteo({})}>Empezar de nuevo</button>}
      </div>
    </>}>
      <div className="rounded-[14px] bg-soft border border-hairline px-4 py-3.5">
        <p className="eyebrow mb-2">Contado</p>
        <p className="amount text-amount leading-none text-ink" aria-live="polite">{clp(total)}</p>
        <p className="text-sm text-muted mt-[9px] tabular-nums">
          Esperado <b className="font-semibold text-ink">{clp(esperado)}</b>
          {!vacio && (
            <> · <b className={`font-semibold ${diferencia === 0 ? 'text-pos' : 'text-neg'}`}>{diferencia === 0 ? 'cuadra' : `diferencia ${clpSigno(diferencia)}`}</b></>
          )}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {DENOMINACIONES.map((d) => {
          const n = cantidad(conteo, d)
          return (
            <li key={d} className="flex items-center gap-2">
              <span className="w-[56px] min-[360px]:w-[66px] shrink-0 cifra text-md text-ink">{clp(d)}</span>
              <button type="button" aria-label={`Quitar un ${clp(d)}`} disabled={n === 0}
                onClick={() => setConteo((c) => ajustar(c, d, -1))}
                className="w-[42px] h-[42px] shrink-0 rounded-[11px] bg-soft border border-control-border text-ink2 grid place-items-center disabled:opacity-50">
                <Icon name="minus" className="w-4 h-4" stroke={2.4} />
              </button>
              <input
                type="text" inputMode="numeric" value={n === 0 ? '' : String(n)} placeholder="0"
                aria-label={`Cuántos de ${clp(d)}`}
                onChange={(e) => setConteo((c) => fijar(c, d, cantidadDesdeTexto(e.target.value)))}
                className="w-[48px] min-[360px]:w-[54px] h-[42px] shrink-0 rounded-[11px] bg-card border border-control-border text-center px-1 font-semibold tabular-nums text-ink placeholder:text-muted2 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <button type="button" aria-label={`Agregar un ${clp(d)}`}
                onClick={() => setConteo((c) => ajustar(c, d, 1))}
                className="w-[42px] h-[42px] shrink-0 rounded-[11px] bg-soft border border-control-border text-ink2 grid place-items-center">
                <Icon name="plus" className="w-4 h-4" stroke={2.4} />
              </button>
              <span className={`flex-1 min-w-0 truncate text-right text-sm font-semibold tabular-nums ${n ? 'text-ink2' : 'text-muted2'}`}>{clp(d * n)}</span>
            </li>
          )
        })}
      </ul>

    </BottomSheet>
  )
}
