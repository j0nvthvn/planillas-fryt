import { LedgerTotal, LedgerLine } from 'frytcontrol'

/** `lg`: el neto al pie de la tarjeta. En rojo cuando el día cierra negativo. */
export const Neto = () => (
  <div className="flex flex-col gap-4 max-w-md">
    <div className="card overflow-hidden">
      <div className="px-[18px] py-2">
        <LedgerLine label="Total ventas" value={1_284_500} />
        <LedgerLine label="Proveedores" value={-202_500} color="var(--neg)" />
      </div>
      <LedgerTotal label="Neto del día" value={1_082_000} className="border-t border-hairline" />
    </div>
    <div className="card overflow-hidden">
      <LedgerTotal label="Neto del día" value={-64_300} color="var(--neg)" />
    </div>
  </div>
)

/** `sm`: un total intermedio, que pesa como una fila más. */
export const Intermedio = () => (
  <div className="card px-[18px] py-2 max-w-md">
    <LedgerLine label="Efectivo" value={412_500} />
    <LedgerLine label="Getnet" value={631_000} />
    <LedgerTotal label="Total ventas" value={1_043_500} size="sm" />
  </div>
)
