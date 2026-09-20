import { Ledger, LedgerHead, LedgerLine, LedgerTotal } from 'frytcontrol'

/** La planilla de un día completo: ventas, proveedores, caja y el neto. */
export const PlanillaDelDia = () => (
  <div className="card max-w-md overflow-hidden">
    <Ledger className="px-[18px] pb-2">
      <LedgerHead label="Ventas" />
      <LedgerLine label="Efectivo" value={412_500} />
      <LedgerLine label="Getnet" value={631_000} />
      <LedgerLine label="Mercado Pago" value={184_300} />
      <LedgerLine label="Edenred" value={56_700} />
      <LedgerTotal label="Total ventas" value={1_284_500} size="sm" />
      <LedgerHead label="Proveedores" />
      <LedgerLine label="Verduras del Sur" hint="ef." dot="pos" value={-128_000} color="var(--neg)" />
      <LedgerLine label="Panadería Lo Ovalle" hint="tr." dot="info" value={-74_500} color="var(--neg)" />
      <LedgerHead label="Caja" />
      <LedgerLine label="Fondo inicial" value={50_000} />
      <LedgerLine label="Efectivo esperado" value={260_000} />
      <LedgerLine label="Contado" hint="cuadra" hintTone="pos" value={260_000} color="var(--pos)" />
    </Ledger>
    <LedgerTotal label="Neto del día" value={1_082_000} className="border-t border-hairline" />
  </div>
)

/** Resumen de un turno, sin conteo de caja todavía. */
export const ResumenDeTurno = () => (
  <div className="card max-w-md overflow-hidden">
    <Ledger className="px-[18px] pb-2">
      <LedgerHead label="Resumen de la mañana" right="08:00 – 14:30" />
      <LedgerLine label="Atendió" hint="Camila" value={null} />
      <LedgerLine label="Ventas" value={486_200} />
      <LedgerTotal label="Total ventas" value={486_200} size="sm" />
      <LedgerHead label="Proveedores" />
      <LedgerLine label="Sin proveedores pagados" value={0} muted />
      <LedgerHead label="Caja" />
      <LedgerLine label="Contado" hint="sin conteo" value={null} muted />
    </Ledger>
    <LedgerTotal label="Neto del turno" value={486_200} className="border-t border-hairline" />
  </div>
)
