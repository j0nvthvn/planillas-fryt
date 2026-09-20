import { LedgerHead, LedgerLine } from 'frytcontrol'

/** Etiqueta de sección: sola y con un dato a la derecha. */
export const Etiquetas = () => (
  <div className="card px-[18px] pb-3 max-w-md">
    <LedgerHead label="Ventas" />
    <LedgerLine label="Efectivo" value={412_500} />
    <LedgerHead label="Resumen de la mañana" right="08:00 – 14:30" />
    <LedgerLine label="Atendió" hint="Camila" value={null} />
  </div>
)
