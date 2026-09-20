import { Dato } from 'frytcontrol'

/** La fila de datos al pie de la tarjeta del día (Hoy, Planilla). */
export const FilaDelDia = () => (
  <div className="card max-w-md">
    <p className="eyebrow">Neto del día</p>
    <p className="amount text-hero leading-[1.05] text-ink mt-2.5">$1.082.000</p>
    <div className="flex gap-3 mt-4 pt-3.5 border-t border-hairline">
      <Dato label="Ventas">$1.284.500</Dato>
      <span className="w-px bg-hairline" aria-hidden="true" />
      <Dato label="Proveedores" className="text-neg">−$202.500</Dato>
      <span className="w-px bg-hairline" aria-hidden="true" />
      <Dato label="Turnos">2 de 2</Dato>
    </div>
  </div>
)

/** Sin datos del día: la raya em ocupa el lugar de la cifra. */
export const SinDatos = () => (
  <div className="card max-w-md">
    <div className="flex gap-3">
      <Dato label="Ventas">—</Dato>
      <span className="w-px bg-hairline" aria-hidden="true" />
      <Dato label="Proveedores">—</Dato>
      <span className="w-px bg-hairline" aria-hidden="true" />
      <Dato label="Turnos">—</Dato>
    </div>
  </div>
)
