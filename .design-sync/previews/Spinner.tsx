import { Spinner } from 'frytcontrol'

/** Por defecto trae su propio aire vertical (`py-16`). */
export const PorDefecto = () => (
  <div className="card max-w-md">
    <Spinner />
  </div>
)

/** Compacto, dentro de una tarjeta o de un botón que está esperando. */
export const Compacto = () => (
  <div className="card max-w-md">
    <Spinner className="py-2" />
  </div>
)
