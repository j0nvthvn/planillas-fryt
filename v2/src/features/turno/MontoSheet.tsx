import { useEffect, useState, type ReactNode } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import Icon from '@/components/Icon'
import { AmountDisplay, DesktopAmountInput, Keypad, applyKey, digitosANumero, numeroADigitos } from '@/components/Keypad'
import { useIsDesktop } from '@/hooks/useIsDesktop'

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
  onAccept: (monto: number, seguir: boolean) => void
  onClose: () => void
}

/** Hoja para escribir un monto: ventas (encadenadas), fondo de caja, conteo. */
export function MontoSheet({ title, sub, valor, color, label = 'Listo', ayuda, paso, siguiente, onAccept, onClose }: Props) {
  const [digits, setDigits] = useState(() => numeroADigitos(valor))
  const desktop = useIsDesktop()
  // Al encadenar cambia el ítem sin desmontar la hoja: se recarga el monto.
  useEffect(() => { setDigits(numeroADigitos(valor)) }, [valor, title])
  const aceptar = (seguir: boolean) => onAccept(digitosANumero(digits), seguir)
  const encadenado = !!siguiente
  const etiqueta = encadenado ? `Siguiente: ${siguiente}` : label

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      extra={paso ? <span className="self-center text-[12px] font-semibold text-muted tabular-nums mr-1">{paso.actual} de {paso.total}</span> : undefined}
    >
      {desktop ? (
        <DesktopAmountInput digits={digits} onChange={setDigits} onEnter={() => aceptar(encadenado)} color={color} label={sub} />
      ) : (
        <AmountDisplay digits={digits} sub={sub} color={color} />
      )}
      {ayuda}
      {desktop ? (
        <div className="flex gap-2 mt-1">
          {encadenado && <button type="button" className="btn-secondary flex-1" onClick={() => aceptar(false)}>Listo</button>}
          <button type="button" className="btn-primary flex-[2]" onClick={() => aceptar(encadenado)}>{etiqueta}</button>
        </div>
      ) : (
        <>
          <Keypad onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={() => aceptar(encadenado)} label={etiqueta} />
          {encadenado && (
            <button type="button" onClick={() => aceptar(false)} className="self-center -mt-1 min-h-[40px] px-4 text-[13.5px] font-semibold text-ink2 flex items-center gap-1.5">
              <Icon name="check" className="w-4 h-4" />Guardar y volver
            </button>
          )}
        </>
      )}
    </BottomSheet>
  )
}
