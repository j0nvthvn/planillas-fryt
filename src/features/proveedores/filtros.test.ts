import { describe, it, expect } from 'vitest'
import { agruparCompras, filtrarProveedores, periodo, FILTROS_BASE, type Filtros } from './filtros'

const prov = (id: string, nombre: string, activo = true, creado_en = '2026-01-01T00:00:00Z') => ({ id, nombre, activo, creado_en })

const lista = [
  prov('a', 'Árbol Distribuidora', true, '2026-03-01T00:00:00Z'),
  prov('b', 'Bebidas Sur', true, '2026-05-01T00:00:00Z'),
  prov('c', 'Carnes Don Luis', false, '2026-02-01T00:00:00Z'),
  prov('d', 'Diario Local', true, '2026-04-01T00:00:00Z'),
]
const compras = { a: { compras: 1, monto: 90000 }, b: { compras: 3, monto: 30000 }, c: { compras: 2, monto: 5000 } }
const ids = (f: Partial<Filtros>) => filtrarProveedores(lista, compras, { ...FILTROS_BASE, ...f }).map((p) => p.id)

describe('filtrarProveedores', () => {
  it('por defecto: solo activos, los más usados primero', () => {
    expect(ids({})).toEqual(['b', 'a', 'd'])
  })

  it('estado', () => {
    expect(ids({ estado: 'inactivos' })).toEqual(['c'])
    expect(ids({ estado: 'todos' })).toEqual(['b', 'c', 'a', 'd'])
  })

  it('uso en el período', () => {
    expect(ids({ uso: 'con' })).toEqual(['b', 'a'])
    expect(ids({ uso: 'sin' })).toEqual(['d'])
    expect(ids({ uso: 'sin', estado: 'todos' })).toEqual(['d'])
  })

  it('orden', () => {
    expect(ids({ orden: 'monto' })).toEqual(['a', 'b', 'd'])
    expect(ids({ orden: 'az', estado: 'todos' })).toEqual(['a', 'b', 'c', 'd'])
    expect(ids({ orden: 'nuevos' })).toEqual(['b', 'd', 'a'])
  })

  it('busca por nombre sin tildes ni mayúsculas', () => {
    expect(ids({ q: 'arbol' })).toEqual(['a'])
    expect(ids({ q: 'DON', estado: 'todos' })).toEqual(['c'])
  })

  it('suma compras y monto a cada fila', () => {
    const [b] = filtrarProveedores(lista, compras, FILTROS_BASE)
    expect(b).toMatchObject({ id: 'b', compras: 3, monto: 30000 })
    expect(filtrarProveedores(lista, {}, FILTROS_BASE).every((p) => p.compras === 0 && p.monto === 0)).toBe(true)
  })
})

describe('agruparCompras', () => {
  it('cuenta y suma por proveedor e ignora las filas sin proveedor', () => {
    expect(agruparCompras([
      { proveedor_id: 'a', monto: '1000' },
      { proveedor_id: 'a', monto: 500 },
      { proveedor_id: null, monto: 700 },
      { proveedor_id: 'b', monto: 0 },
    ])).toEqual({ a: { compras: 2, monto: 1500 }, b: { compras: 1, monto: 0 } })
  })
})

describe('periodo', () => {
  it('días corridos incluyendo hoy', () => {
    expect(periodo('30', '2026-09-29')).toEqual({ desde: '2026-08-31', hasta: '2026-09-29' })
    expect(periodo('90', '2026-09-29')).toEqual({ desde: '2026-07-02', hasta: '2026-09-29' })
    expect(periodo('365', '2026-09-29')).toEqual({ desde: '2025-09-30', hasta: '2026-09-29' })
  })

  it('este mes', () => {
    expect(periodo('mes', '2026-09-29')).toEqual({ desde: '2026-09-01', hasta: '2026-09-29' })
  })
})
