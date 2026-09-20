import { EstadoChip } from 'frytcontrol'

/** Los cinco estados que calcula `v_resumen_dia`. */
export const Estados = () => (
  <div className="card flex flex-wrap items-center gap-2 max-w-md">
    <EstadoChip estado="sin_registro" />
    <EstadoChip estado="borrador" />
    <EstadoChip estado="parcial" />
    <EstadoChip estado="completo" />
    <EstadoChip estado="cerrado" />
  </div>
)

/** En su sitio: a la derecha del título de la tarjeta del día. */
export const EnLaTarjeta = () => (
  <div className="card max-w-md">
    <div className="flex items-center justify-between gap-2.5">
      <h2 className="eyebrow">Neto del día</h2>
      <EstadoChip estado="completo" />
    </div>
    <p className="amount text-hero leading-[1.05] text-ink mt-2.5">$1.082.000</p>
  </div>
)
