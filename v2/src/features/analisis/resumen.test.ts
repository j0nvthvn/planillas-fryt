import { describe, it, expect } from 'vitest'
import { promedioNeto, resumenGrafico, diasConRegistro, type DiaGrafico } from './resumen'

function dia(fecha: string, neto: number, extra: Partial<DiaGrafico> = {}): DiaGrafico {
  return {
    fecha, label: fecha.slice(8), neto, total_ventas: neto, turnos: 1,
    estado: 'completo', cerrado: false, jornada_id: `j-${fecha}`,
    ...extra,
  } as DiaGrafico
}

const sinAbrir = (fecha: string) => dia(fecha, 0, { turnos: 0, estado: 'cerrado', cerrado: true, motivo_cierre: 'Feriado' })
const jornadaVacia = (fecha: string) => dia(fecha, 0, { turnos: 0, estado: 'sin_registro' })

describe('diasConRegistro', () => {
  it('deja fuera los días sin turnos', () => {
    expect(diasConRegistro([dia('2026-09-01', 100), sinAbrir('2026-09-02'), jornadaVacia('2026-09-03')])).toHaveLength(1)
  })
})

describe('promedioNeto', () => {
  it('promedia solo sobre los días con registro', () => {
    expect(promedioNeto([dia('2026-09-01', 100), dia('2026-09-02', 200), sinAbrir('2026-09-03')])).toBe(150)
  })

  it('un día sin abrir no arrastra el promedio hacia abajo', () => {
    const conCierre = promedioNeto([dia('2026-09-01', 100), sinAbrir('2026-09-02')])
    expect(conCierre).toBe(100)
  })

  it('sin días con registro es cero, no NaN', () => {
    expect(promedioNeto([sinAbrir('2026-09-01')])).toBe(0)
  })
})

describe('resumenGrafico', () => {
  it('el peor día no puede ser uno sin abrir', () => {
    const texto = resumenGrafico([dia('2026-09-01', 100), dia('2026-09-02', 200), sinAbrir('2026-09-03')])
    expect(texto).toContain('2 días con registro')
    expect(texto).toMatch(/el peor, .*1 sept con \$100/)
    expect(texto).toContain('1 día el local no abrió')
  })

  it('una jornada vacía tampoco cuenta como el peor día', () => {
    const texto = resumenGrafico([dia('2026-09-01', 100), jornadaVacia('2026-09-02')])
    expect(texto).toContain('1 día con registro')
    expect(texto).not.toContain('el local no abrió')
  })

  it('sin registros lo dice, y de todos modos menciona los días sin abrir', () => {
    expect(resumenGrafico([sinAbrir('2026-09-01')])).toBe('Sin días con registro en el período. 1 día el local no abrió.')
  })
})
