import { useEffect, useState, type ReactNode } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import Icon from '@/components/Icon'
import { AmountDisplay, DesktopAmountInput, Keypad, applyKey, digitosANumero, numeroADigitos } from '@/components/Keypad'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { clp } from '@/lib/format'
import { derivarTarde, totalDesdeTarde } from './acumulado'

interface Props {
  title: string
  sub?: string
  valor: number | null
  color?: string
  label?: string
  /** Texto de ayuda bajo el monto (por ejemplo, el esperado al contar la caja). */
  ayuda?: ReactNode
  /**
   * Encadenado (teclado fijo): al aceptar se pasa al siguiente ítem sin
   * cerrar la hoja. `paso` muestra "2 de 6"; `siguiente` es la etiqueta
   * del próximo ítem.
   */
  paso?: { actual: number; total: number }
  siguiente?: string | null
  /**
   * Método cuya máquina entrega el total del día: se escribe ese total y la
   * hoja deriva la parte de la tarde (total − mañana). `manana` es lo ya
   * registrado en el turno de la mañana para este método.
   */
  acumulado?: { manana: number }
  onAccept: (monto: number, seguir: boolean) => void
  onClose: () => void
}

/** Hoja para escribir un monto: ventas (encadenadas), fondo de caja, conteo. */
export function MontoSheet({ title, sub, valor, color, label = 'Listo', ayuda, paso, siguiente, acumulado, onAccept, onClose }: Props) {
  const desktop = useIsDesktop()
  // Con total acumulado se escribe lo que muestra la máquina; el valor
  // guardado (tarde) se convierte a ese total para mostrarlo.
  const [modoTotal, setModoTotal] = useState(!!acumulado)
  const aTexto = (v: number | null) => numeroADigitos(acumulado && modoTotal && v != null ? totalDesdeTarde(v, acumulado.manana) : v)
  const [digits, setDigits] = useState(() => aTexto(valor))
  // Al encadenar cambia el ítem sin desmontar la hoja: se recarga el monto.
  // Tiene que ser un efecto: `acumulado` es un objeto nuevo en cada render y
  // ajustarlo durante el render entraría en bucle.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setModoTotal(!!acumulado); setDigits(numeroADigitos(acumulado && valor != null ? totalDesdeTarde(valor, acumulado.manana) : valor)) }, [valor, title, acumulado])
  const escrito = digitosANumero(digits)
  const derivado = acumulado && modoTotal ? derivarTarde(escrito, acumulado.manana) : null
  const montoFinal = derivado ? derivado.tarde : escrito
  const invalido = !!derivado?.invalido
  const aceptar = (seguir: boolean) => { if (!invalido) onAccept(montoFinal, seguir) }
  const encadenado = !!siguiente
  // Con el monto vacío aceptar guarda un 0: que el botón lo diga, en vez de
  // dejar la duda de si un método en cero se puede saltar.
  const etiqueta = encadenado ? (escrito === 0 ? 'Omitir y seguir' : `Siguiente: ${siguiente}`) : label
  const bloqueAcumulado = acumulado && (
    <div className="rounded-[14px] border border-hairline px-4 py-3 flex flex-col gap-2.5">
      <div className="segmented" role="radiogroup" aria-label="Cómo ingresar el monto">
        <button type="button" role="radio" aria-checked={modoTotal} onClick={() => { if (!modoTotal) { setModoTotal(true); setDigits(numeroADigitos(totalDesdeTarde(escrito, acumulado.manana))) } }}
          className={`${modoTotal ? 'segmented-item-on' : 'segmented-item'} px-2`}>Total del día (máquina)</button>
        <button type="button" role="radio" aria-checked={!modoTotal} onClick={() => { if (modoTotal) { setModoTotal(false); setDigits(numeroADigitos(derivarTarde(escrito, acumulado.manana).tarde)) } }}
          className={`${!modoTotal ? 'segmented-item-on' : 'segmented-item'} px-2`}>Solo la tarde</button>
      </div>
      {modoTotal ? (
        <p className={`text-sm tabular-nums ${invalido ? 'text-neg font-semibold' : 'text-ink2'}`}>
          {invalido
            ? `El total no puede ser menor que la mañana (${clp(acumulado.manana)}).`
            : <>Mañana <b className="text-ink">{clp(acumulado.manana)}</b> → se guarda para la tarde <b className="text-ink">{clp(montoFinal)}</b></>}
        </p>
      ) : (
        <p className="text-sm text-ink2 tabular-nums">Mañana {clp(acumulado.manana)} · total del día quedaría en <b className="text-ink">{clp(totalDesdeTarde(escrito, acumulado.manana))}</b></p>
      )}
    </div>
  )

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      extra={paso ? <span className="text-xs font-semibold text-muted tabular-nums">{paso.actual} de {paso.total}</span> : undefined}
      footer={desktop ? (
        <div className="flex gap-2 mt-1">
          {encadenado && <button type="button" className="btn-secondary flex-1 min-h-[50px] text-[15px]" disabled={invalido} onClick={() => aceptar(false)}>Listo</button>}
          <button type="button" className="btn-primary flex-[2] min-h-[50px] text-[15px]" disabled={invalido} onClick={() => aceptar(encadenado)}>{etiqueta}</button>
        </div>
      ) : (
        <>
          <Keypad onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={() => aceptar(encadenado)} disabled={invalido} label={etiqueta} />
          {encadenado && (
            <button type="button" onClick={() => aceptar(false)} className="w-full -mt-0.5 min-h-[40px] px-4 text-[13px] font-semibold text-ink2 flex items-center justify-center gap-1.5">
              <Icon name="check" className="w-[15px] h-[15px]" />Guardar y volver
            </button>
          )}
        </>
      )}
    >
      {desktop ? (
        <DesktopAmountInput digits={digits} onChange={setDigits} onEnter={() => aceptar(encadenado)} color={color} label={sub} />
      ) : (
        <AmountDisplay digits={digits} sub={sub} color={color} />
      )}
      {bloqueAcumulado}
      {ayuda}
    </BottomSheet>
  )
}
