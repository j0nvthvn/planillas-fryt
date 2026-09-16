import { describe, it, expect } from 'vitest'
import { clp, clpSigno, clpCorto, fechaISO, sumarDias, diaSemana, parseNum } from './format'

describe('clp', () => {
  it('formatea pesos chilenos sin decimales', () => {
    expect(clp(12345).replace(/\s/g, '')).toBe('$12.345')
    expect(clp(0)).toBe('$0')
    expect(clp(null)).toBe('$0')
    expect(clp('1500').replace(/\s/g, '')).toBe('$1.500')
  })
  it('signo explícito para diferencias', () => {
    expect(clpSigno(1200).replace(/\s/g, '')).toBe('+$1.200')
    expect(clpSigno(-800).replace(/\s/g, '')).toBe('−$800')
    expect(clpSigno(0)).toBe('$0')
  })
  it('etiqueta corta para ejes', () => {
    expect(clpCorto(1_250_000)).toBe('$1,3M')
    expect(clpCorto(45_000)).toBe('$45k')
    expect(clpCorto(-900)).toBe('-$900')
  })
})

describe('fechas locales', () => {
  it('fechaISO usa componentes locales (no UTC)', () => {
    expect(fechaISO(new Date(2026, 8, 15, 23, 30))).toBe('2026-09-15')
  })
  it('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('diaSemana: 2026-09-13 es domingo', () => {
    expect(diaSemana('2026-09-13')).toBe(0)
    expect(diaSemana('2026-09-14')).toBe(1)
  })
})

describe('parseNum', () => {
  it('acepta separador de miles chileno', () => {
    expect(parseNum('12.345')).toBe(12345)
    expect(parseNum('')).toBe(0)
    expect(parseNum('abc')).toBe(0)
  })
})
