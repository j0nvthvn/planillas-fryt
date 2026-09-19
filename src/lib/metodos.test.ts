import { describe, it, expect } from 'vitest'
import { montoDe, porMetodo } from './metodos'

const METODOS = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'getnet', label: 'Getnet' },
  { key: 'edenred', label: 'Edenred' },
]

describe('montoDe', () => {
  it('lee la columna del método', () => {
    expect(montoDe({ efectivo: 1500 }, 'efectivo')).toBe(1500)
  })
  it('acepta los números como texto que devuelve postgres', () => {
    expect(montoDe({ efectivo: '1500.00' }, 'efectivo')).toBe(1500)
  })
  it('sin fila o sin la columna, es cero', () => {
    expect(montoDe(null, 'efectivo')).toBe(0)
    expect(montoDe(undefined, 'efectivo')).toBe(0)
    expect(montoDe({}, 'efectivo')).toBe(0)
    expect(montoDe({ efectivo: null }, 'efectivo')).toBe(0)
  })
})

describe('porMetodo', () => {
  it('ordena de mayor a menor y deja fuera los que no se movieron', () => {
    const r = porMetodo({ efectivo: 1000, getnet: 5000, edenred: 0 }, METODOS)
    expect(r.map((m) => m.key)).toEqual(['getnet', 'efectivo'])
    expect(r[0]!.monto).toBe(5000)
  })

  it('conserva el resto de los datos del método', () => {
    expect(porMetodo({ efectivo: 10 }, METODOS)[0]).toMatchObject({ key: 'efectivo', label: 'Efectivo', monto: 10 })
  })

  it('sin fila o sin catálogo, lista vacía', () => {
    expect(porMetodo(null, METODOS)).toEqual([])
    expect(porMetodo({ efectivo: 10 }, undefined)).toEqual([])
  })
})
