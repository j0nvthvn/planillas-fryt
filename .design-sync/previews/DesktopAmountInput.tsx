import { useState } from 'react'
import { DesktopAmountInput } from 'frytcontrol'

/** El mismo monto del teclado, pero escrito con el teclado del computador. */
export const Campo = () => {
  const [digits, setDigits] = useState('128000')
  return (
    <div className="max-w-sm">
      <DesktopAmountInput digits={digits} onChange={setDigits} label="Monto" nombre="Monto pagado" autoFocus={false} />
    </div>
  )
}

/** Con el color del método: tiñe la cifra, no el marco. */
export const ConColor = () => {
  const [digits, setDigits] = useState('631000')
  return (
    <div className="max-w-sm">
      <DesktopAmountInput digits={digits} onChange={setDigits} label="Getnet" nombre="Getnet" color="#E4002B" autoFocus={false} />
    </div>
  )
}

/**
 * `invalido` solo marca `aria-invalid`: la señal visible la pone quien lo usa,
 * con el mensaje debajo y `describedBy` apuntando a su id.
 */
export const Invalido = () => {
  const [digits, setDigits] = useState('0')
  return (
    <div className="max-w-sm">
      <DesktopAmountInput digits={digits} onChange={setDigits} label="Monto" nombre="Monto pagado" invalido describedBy="err-monto" autoFocus={false} />
      <p id="err-monto" className="text-xs text-neg mt-1.5">El monto tiene que ser mayor que cero.</p>
    </div>
  )
}
