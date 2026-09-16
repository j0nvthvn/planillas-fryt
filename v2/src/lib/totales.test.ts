import { describe, it, expect } from 'vitest'
import { totalesTurno, totalVentas, totalesProveedores } from './totales'

describe('totalesTurno (misma fórmula que turno_totales en la base)', () => {
  const ventas = { efectivo: 200000, getnet: 50000, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 10000 }
  const provs = [
    { monto: 35000, forma_pago: 'efectivo' as const },
    { monto: 12000, forma_pago: 'transferencia' as const },
  ]
  it('calcula ventas, proveedores, neto y caja', () => {
    const t = totalesTurno(ventas, provs, 25000)
    expect(t.total_ventas).toBe(260000)
    expect(t.prov_efectivo).toBe(35000)
    expect(t.prov_transferencia).toBe(12000)
    expect(t.total_proveedores).toBe(47000)
    expect(t.neto).toBe(213000)
    expect(t.efectivo_neto).toBe(165000)
    expect(t.efectivo_esperado).toBe(190000)
  })
  it('tolera ventas vacías y montos como string', () => {
    expect(totalVentas(null)).toBe(0)
    expect(totalVentas({ efectivo: '100' as unknown as number })).toBe(100)
    expect(totalesProveedores(undefined).total).toBe(0)
  })
})
