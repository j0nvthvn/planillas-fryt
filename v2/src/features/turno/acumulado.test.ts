import { describe, it, expect } from 'vitest'
import { derivarTarde, totalDesdeTarde } from './acumulado'

describe('métodos con total acumulado del día', () => {
  it('la tarde es el total de la máquina menos lo de la mañana', () => {
    expect(derivarTarde(45000, 30000)).toEqual({ tarde: 15000, invalido: false })
    expect(derivarTarde(30000, 30000)).toEqual({ tarde: 0, invalido: false })
  })
  it('sin mañana registrada, el total es la tarde', () => {
    expect(derivarTarde(12000, 0)).toEqual({ tarde: 12000, invalido: false })
  })
  it('un total menor que la mañana no es válido', () => {
    expect(derivarTarde(20000, 30000)).toEqual({ tarde: 0, invalido: true })
  })
  it('ida y vuelta', () => {
    expect(totalDesdeTarde(derivarTarde(45000, 30000).tarde, 30000)).toBe(45000)
  })
})
