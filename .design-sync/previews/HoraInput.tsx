import { useState } from 'react'
import { HoraInput } from 'frytcontrol'

/** Hora en punto (0–23), con el selector de hora del sistema. */
export const Campo = () => {
  const [hora, setHora] = useState(14)
  return (
    <div className="card max-w-md flex flex-col gap-3">
      <label className="text-sm font-medium text-ink2" htmlFor="corte">Corte de la mañana</label>
      <HoraInput id="corte" value={hora} onChange={setHora} className="font-display font-semibold w-32" />
    </div>
  )
}

/** En su sitio: la fila de Ajustes › General. */
export const EnAjustes = () => {
  const [hora, setHora] = useState(14)
  return (
    <div className="card max-w-md flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-md font-medium text-ink">Corte de la mañana</p>
        <p className="text-xs text-muted mt-0.5">Hora en que termina el turno mañana</p>
      </div>
      <HoraInput value={hora} onChange={setHora} ariaLabel="Corte de la mañana" className="font-display font-semibold w-28 text-right" />
    </div>
  )
}
