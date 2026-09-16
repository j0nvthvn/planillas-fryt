import { useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { AmountDisplay, DesktopAmountInput, Keypad, applyKey, digitosANumero, numeroADigitos } from '@/components/Keypad'
import { useIsDesktop } from '@/hooks/useIsDesktop'

interface Props {
  title: string
  sub?: string
  valor: number | null
  color?: string
  label?: string
  /** Texto de ayuda bajo el monto (por ejemplo, el esperado al contar la caja). */
  ayuda?: React.ReactNode
  onAccept: (monto: number) => void
  onClose: () => void
}

/** Hoja genérica para escribir un monto: ventas, fondo de caja, conteo. */
export function MontoSheet({ title, sub, valor, color, label = 'Listo', ayuda, onAccept, onClose }: Props) {
  const [digits, setDigits] = useState(() => numeroADigitos(valor))
  const desktop = useIsDesktop()
  const aceptar = () => onAccept(digitosANumero(digits))
  return (
    <BottomSheet title={title} onClose={onClose}>
      {desktop ? (
        <DesktopAmountInput digits={digits} onChange={setDigits} onEnter={aceptar} color={color} label={sub} />
      ) : (
        <AmountDisplay digits={digits} sub={sub} color={color} />
      )}
      {ayuda}
      {desktop ? (
        <button type="button" className="btn-primary w-full mt-1" onClick={aceptar}>{label}</button>
      ) : (
        <Keypad onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={aceptar} label={label} />
      )}
    </BottomSheet>
  )
}
