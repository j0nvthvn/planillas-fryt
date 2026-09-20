import { LedgerLine } from 'frytcontrol'

/** Fila normal, con pista, con punto de forma de pago y en rojo (egreso). */
export const Filas = () => (
  <div className="card px-[18px] py-2 max-w-md">
    <LedgerLine label="Getnet" value={631_000} />
    <LedgerLine label="Verduras del Sur" hint="ef." dot="pos" value={-128_000} color="var(--neg)" />
    <LedgerLine label="Panadería Lo Ovalle" hint="tr." dot="info" value={-74_500} color="var(--neg)" />
    <LedgerLine label="Contado" hint="-3.500" hintTone="neg" value={256_500} color="var(--neg)" />
    <LedgerLine label="Contado" hint="cuadra" hintTone="pos" value={260_000} color="var(--pos)" />
    <LedgerLine label="Sin conteo" hint="sin conteo" value={null} muted />
  </div>
)

/** Con `onClick` la fila es un botón: se ilumina al pasar y al tocar. */
export const Tocable = () => (
  <div className="card px-[18px] py-2 max-w-md">
    <LedgerLine label="Efectivo" value={412_500} onClick={() => {}} />
    <LedgerLine label="Getnet" value={631_000} onClick={() => {}} />
  </div>
)
