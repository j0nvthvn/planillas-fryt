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
    <BottomSheet title="Conteo de caja" onClose={onClose}>
      <div className="rounded-2xl bg-card border border-hairline px-4 py-3">
        <p className="eyebrow mb-1">Contado</p>
        <p className="amount text-amount leading-none text-ink" aria-live="polite">{clp(total)}</p>
        <p className="text-sm text-muted mt-1 tabular-nums">
          Esperado <b className="text-ink">{clp(esperado)}</b>
          {!vacio && (
            <> · <b className={diferencia === 0 ? 'text-pos' : 'text-neg'}>{diferencia === 0 ? 'cuadra' : `diferencia ${clpSigno(diferencia)}`}</b></>
          )}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {DENOMINACIONES.map((d) => {
          const n = cantidad(conteo, d)
          return (
            <li key={d} className="flex items-center gap-2">
              <span className="w-[68px] shrink-0 cifra text-base text-ink">{clp(d)}</span>
              <button type="button" aria-label={`Quitar un ${clp(d)}`} disabled={n === 0}
                onClick={() => setConteo((c) => ajustar(c, d, -1))}
                className="w-11 h-11 shrink-0 rounded-xl bg-soft text-ink grid place-items-center disabled:opacity-40">
                <Icon name="minus" className="w-4 h-4" stroke={2.4} />
              </button>
              <input
                type="text" inputMode="numeric" value={n === 0 ? '' : String(n)} placeholder="0"
                aria-label={`Cuántos de ${clp(d)}`}
                onChange={(e) => setConteo((c) => fijar(c, d, cantidadDesdeTexto(e.target.value)))}
                className="input w-14 shrink-0 text-center px-1 tabular-nums"
              />
              <button type="button" aria-label={`Agregar un ${clp(d)}`}
                onClick={() => setConteo((c) => ajustar(c, d, 1))}
                className="w-11 h-11 shrink-0 rounded-xl bg-soft text-ink grid place-items-center">
                <Icon name="plus" className="w-4 h-4" stroke={2.4} />
              </button>
              <span className={`flex-1 text-right cifra text-sm ${n ? 'text-ink2' : 'text-muted2'}`}>{clp(d * n)}</span>
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn-primary w-full py-3 text-base" disabled={vacio} onClick={() => onAccept(total, conteo)}>
        <Icon name="check" className="w-5 h-5" stroke={2.4} />Registrar conteo
      </button>
      <div className="flex justify-between gap-2 pb-1">
        <button type="button" className="btn-ghost text-sm" onClick={onTotalManual}>Escribir el total a mano</button>
        {!vacio && <button type="button" className="btn-ghost text-sm text-neg" onClick={() => setConteo({})}>Empezar de nuevo</button>}
      </div>
    </BottomSheet>
  )
}
