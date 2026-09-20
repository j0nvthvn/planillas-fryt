import { useState } from 'react'
import { AmountDisplay, Keypad, applyKey } from 'frytcontrol'

/** El teclado con su display, como en la hoja de montos del turno. */
export const ConDisplay = () => {
  const [digits, setDigits] = useState('128000')
  return (
    <div className="max-w-xs flex flex-col gap-3.5">
      <AmountDisplay digits={digits} sub="Monto" nombre="Monto pagado" />
      <Keypad label="Guardar" onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={() => {}} />
    </div>
  )
}

/** `disabled`: el botón de aceptar espera a que haya un monto. */
export const SinMonto = () => {
  const [digits, setDigits] = useState('')
  return (
    <div className="max-w-xs flex flex-col gap-3.5">
      <AmountDisplay digits={digits} sub="Monto" nombre="Monto pagado" />
      <Keypad label="Guardar" disabled={!digits} onKey={(k) => setDigits((d) => applyKey(d, k))} onAccept={() => {}} />
    </div>
  )
}
