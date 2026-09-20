import { useState } from 'react'
import { MontoInput } from 'frytcontrol'

/** Campo de pesos en línea: se escribe en dígitos y se lee "$20.000". */
export const Campo = () => {
  const [monto, setMonto] = useState(50_000)
  return (
    <div className="card max-w-md flex flex-col gap-3">
      <label className="text-sm font-medium text-ink2" htmlFor="fondo">Fondo de caja por defecto</label>
      <MontoInput id="fondo" value={monto} onChange={setMonto} className="font-display font-semibold w-40" />
    </div>
  )
}

/** Vacío muestra el marcador "$0". */
export const Vacio = () => {
  const [monto, setMonto] = useState(0)
  return (
    <div className="card max-w-md">
      <MontoInput value={monto} onChange={setMonto} ariaLabel="Monto" className="w-40" />
    </div>
  )
}

/** En su sitio: la fila de Ajustes › General. */
export const EnAjustes = () => {
  const [monto, setMonto] = useState(50_000)
  return (
    <div className="card max-w-md flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-md font-medium text-ink">Fondo de caja por defecto</p>
        <p className="text-xs text-muted mt-0.5">Con lo que parte cada turno</p>
      </div>
      <MontoInput value={monto} onChange={setMonto} ariaLabel="Fondo de caja por defecto" className="font-display font-semibold w-32 text-right" />
    </div>
  )
}
