import { describe, it, expect } from 'vitest'
import { clp, clpSigno, clpCorto, fechaISO, sumarDias, ajustarRango, diaSemana, parseNum, fechaLegible, mesAnio } from './format'

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

describe('ajustarRango', () => {
  const tope = '2026-09-16'
  it('deja igual un rango válido', () => {
    expect(ajustarRango('2026-09-01', '2026-09-10', undefined, tope)).toEqual({ desde: '2026-09-01', hasta: '2026-09-10' })
  })
  it('un rango invertido nunca llega a la consulta', () => {
    expect(ajustarRango('2026-09-12', '2026-09-05', 'desde', tope)).toEqual({ desde: '2026-09-12', hasta: '2026-09-12' })
    expect(ajustarRango('2026-09-12', '2026-09-05', 'hasta', tope)).toEqual({ desde: '2026-09-05', hasta: '2026-09-05' })
    expect(ajustarRango('2026-09-12', '2026-09-05', undefined, tope)).toEqual({ desde: '2026-09-05', hasta: '2026-09-12' })
  })
  it('las fechas futuras se ajustan a hoy', () => {
    expect(ajustarRango('2026-09-30', '2026-09-16', undefined, tope)).toEqual({ desde: tope, hasta: tope })
    expect(ajustarRango('2026-09-01', '2026-10-05', 'hasta', tope)).toEqual({ desde: '2026-09-01', hasta: tope })
  })
})

describe('clp negativo', () => {
  it('el signo va antes del peso', () => {
    expect(clp(-404199)).toBe('−$404.199')
  })
})

describe('fechas legibles', () => {
  it('mayúscula solo al comienzo', () => {
    expect(fechaLegible('2026-09-16')).toBe('Miércoles, 16 de septiembre de 2026')
    expect(mesAnio('2026-09-01')).toBe('Septiembre de 2026')
  })
})
