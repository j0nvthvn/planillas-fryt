import { describe, it, expect } from 'vitest'
import { comprasDelProveedor, type FilaCompra } from './detalle'

const fila = (p: Partial<FilaCompra> & { fecha?: string; tipo?: string; unico?: boolean }): FilaCompra => ({
  id: p.id ?? 'c1',
  monto: p.monto ?? 1000,
  forma_pago: p.forma_pago ?? 'efectivo',
  creado_en: p.creado_en ?? '2026-10-01T12:00:00Z',
  turno: { tipo: p.tipo ?? 'mañana', jornada: { fecha: p.fecha ?? '2026-10-01', es_turno_unico: p.unico ?? false } },
})

describe('comprasDelProveedor', () => {
  it('ordena por la fecha de la jornada, no por cuándo se escribió la fila', () => {
    const { compras } = comprasDelProveedor([
      fila({ id: 'vieja-escrita-hoy', fecha: '2026-09-01', creado_en: '2026-10-05T10:00:00Z' }),
      fila({ id: 'reciente', fecha: '2026-10-03', creado_en: '2026-10-03T10:00:00Z' }),
      fila({ id: 'mismo-dia-despues', fecha: '2026-10-03', creado_en: '2026-10-03T18:00:00Z' }),
    ])
    expect(compras.map((c) => c.id)).toEqual(['mismo-dia-despues', 'reciente', 'vieja-escrita-hoy'])
  })

  it('el día completo se muestra como día completo, no como «mañana»', () => {
    const { compras } = comprasDelProveedor([
      fila({ id: 'a', tipo: 'mañana', unico: true }),
      fila({ id: 'b', tipo: 'mañana', unico: false }),
      fila({ id: 'c', tipo: 'tarde' }),
    ])
    expect(compras.map((c) => c.modo)).toEqual(['completo', 'mañana', 'tarde'])
  })

  it('suma el total de todas las compras, con montos que llegan como texto', () => {
    expect(comprasDelProveedor([fila({ monto: '1500' }), fila({ id: 'c2', monto: 2500 })]).total).toBe(4000)
  })

  it('una forma de pago desconocida cuenta como efectivo', () => {
    expect(comprasDelProveedor([fila({ forma_pago: 'otra' })]).compras[0]!.formaPago).toBe('efectivo')
  })
})
