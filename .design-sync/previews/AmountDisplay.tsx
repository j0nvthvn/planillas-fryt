import { AmountDisplay } from 'frytcontrol'

/** Vacío y con monto: la cifra se apaga mientras no hay nada tecleado. */
export const VacioYConMonto = () => (
  <div className="max-w-sm flex flex-col gap-3">
    <AmountDisplay digits="" sub="Monto" nombre="Monto de la venta" />
    <AmountDisplay digits="128000" sub="Monto" nombre="Monto de la venta" />
  </div>
)

/** Con el color del método, como en la hoja de ventas. */
export const ConColor = () => (
  <div className="max-w-sm flex flex-col gap-3">
    <AmountDisplay digits="631000" sub="Getnet" color="#E4002B" nombre="Getnet" />
    <AmountDisplay digits="412500" sub="Efectivo" color="var(--pos)" nombre="Efectivo" />
  </div>
)

/** Sin etiqueta, cuando el contexto ya la dio. */
export const SinEtiqueta = () => (
  <div className="max-w-sm">
    <AmountDisplay digits="74500" nombre="Monto pagado" />
  </div>
)
