import { useState } from 'react'
import { PayToggle } from 'frytcontrol'

/** Forma de pago del proveedor: dos opciones, con teclado de radio. */
export const Efectivo = () => {
  const [forma, setForma] = useState<'efectivo' | 'transferencia'>('efectivo')
  return (
    <div className="card max-w-md">
      <PayToggle value={forma} onChange={setForma} />
    </div>
  )
}

/** Con transferencia elegida: el acento pasa al índigo de marca. */
export const Transferencia = () => {
  const [forma, setForma] = useState<'efectivo' | 'transferencia'>('transferencia')
  return (
    <div className="card max-w-md">
      <PayToggle value={forma} onChange={setForma} />
    </div>
  )
}
