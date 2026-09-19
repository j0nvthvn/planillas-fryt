import { describe, expect, it } from 'vitest'
import { ajustar, cantidad, cantidadDesdeTexto, fijar, hayConteo, totalConteo, DENOMINACIONES } from './conteo'

describe('totalConteo', () => {
  it('suma denominación por cantidad', () => {
    expect(totalConteo({ 20000: 3, 1000: 2, 100: 5 })).toBe(62500)
  })
  it('un conteo vacío vale 0', () => {
    expect(totalConteo({})).toBe(0)
    expect(hayConteo({})).toBe(false)
  })
  it('ignora cantidades inválidas o negativas', () => {
    expect(totalConteo({ 1000: -3, 500: Number.NaN, 100: 1.7 })).toBe(100)
  })
  it('cubre todas las denominaciones en circulación', () => {
    const uno = Object.fromEntries(DENOMINACIONES.map((d) => [d, 1]))
    expect(totalConteo(uno)).toBe(38660)
  })
})

describe('ajustar y fijar', () => {
  it('no baja de cero', () => {
    expect(cantidad(ajustar({ 1000: 1 }, 1000, -5), 1000)).toBe(0)
  })
  it('quita la entrada cuando queda en cero', () => {
    expect(fijar({ 1000: 2 }, 1000, 0)).toEqual({})
  })
  it('suma piezas sin tocar las otras denominaciones', () => {
    expect(ajustar({ 1000: 2, 500: 1 }, 1000, 3)).toEqual({ 1000: 5, 500: 1 })
  })
})

describe('cantidadDesdeTexto', () => {
  it('se queda con los dígitos', () => {
    expect(cantidadDesdeTexto('12a')).toBe(12)
    expect(cantidadDesdeTexto('')).toBe(0)
    expect(cantidadDesdeTexto('007')).toBe(7)
  })
})
