import { BarraMetodos } from 'frytcontrol'

const VENTAS = [
  { key: 'efectivo', color: '#047857', monto: 412_500 },
  { key: 'getnet', color: '#E4002B', monto: 631_000 },
  { key: 'mercadopago', color: '#00AEEF', monto: 184_300 },
  { key: 'edenred', color: '#EE3124', monto: 56_700 },
]

/** La proporción de cada método, bajo el total de ventas (Hoy, Análisis). */
export const Proporcion = () => (
  <div className="card max-w-md">
    <p className="eyebrow">Ventas del día</p>
    <p className="amount text-2xl text-ink mt-1.5">$1.284.500</p>
    <BarraMetodos metodos={VENTAS} className="mt-3.5" />
  </div>
)

/** Con un método dominante, y con uno solo (la barra llena). */
export const Extremos = () => (
  <div className="card max-w-md flex flex-col gap-5">
    <BarraMetodos metodos={[{ key: 'getnet', color: '#E4002B', monto: 980_000 }, { key: 'efectivo', color: '#047857', monto: 42_000 }]} />
    <BarraMetodos metodos={[{ key: 'efectivo', color: '#047857', monto: 320_000 }]} />
  </div>
)
