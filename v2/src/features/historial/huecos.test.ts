import { describe, it, expect } from 'vitest'
import { conHuecos, porMes, resumenMes, TRAMO_MINIMO, type ItemHistorial } from './huecos'
import type { VResumenDia } from '@/features/turno/api'

function dia(fecha: string, extra: Partial<VResumenDia> = {}): VResumenDia {
  return { fecha, jornada_id: `j-${fecha}`, estado: 'completo', turnos: 1, neto: 1000, cerrado: false, ...extra } as VResumenDia
}

const fechas = (items: ItemHistorial[]) => items.map((i) => `${i.tipo}:${i.fecha}`)

describe('conHuecos', () => {
  it('sin filas no inventa nada', () => {
    expect(conHuecos([], '2026-09-16')).toEqual([])
  })

  it('rellena los días que faltan entre dos filas', () => {
    const items = conHuecos([dia('2026-09-16'), dia('2026-09-13')], '2026-09-16')
    expect(fechas(items)).toEqual([
      'dia:2026-09-16', 'hueco:2026-09-15', 'hueco:2026-09-14', 'dia:2026-09-13',
    ])
  })

  it('rellena también entre el límite de arriba y la fila más nueva', () => {
    const items = conHuecos([dia('2026-09-14')], '2026-09-16')
    expect(fechas(items)).toEqual(['hueco:2026-09-16', 'hueco:2026-09-15', 'dia:2026-09-14'])
  })

  it('no inventa nada más antiguo que la última fila cargada', () => {
    const items = conHuecos([dia('2026-09-16'), dia('2026-09-10')], '2026-09-16')
    expect(items.at(-1)).toEqual({ tipo: 'dia', fecha: '2026-09-10', d: expect.anything() })
  })

  it('colapsa una racha larga en un solo tramo', () => {
    const items = conHuecos([dia('2026-09-16'), dia('2026-09-01')], '2026-09-16')
    expect(items[1]).toEqual({ tipo: 'tramo', fecha: '2026-09-15', hasta: '2026-09-02', dias: 14 })
    expect(items).toHaveLength(3)
  })

  it('una racha justo bajo el mínimo queda como filas sueltas', () => {
    const desde = '2026-09-16'
    const hasta = `2026-09-${String(16 - TRAMO_MINIMO).padStart(2, '0')}` // deja TRAMO_MINIMO - 1 huecos
    const items = conHuecos([dia(desde), dia(hasta)], desde)
    expect(items.filter((i) => i.tipo === 'hueco')).toHaveLength(TRAMO_MINIMO - 1)
    expect(items.some((i) => i.tipo === 'tramo')).toBe(false)
  })

  it('un tramo no cruza de mes', () => {
    const items = conHuecos([dia('2026-09-16'), dia('2026-07-20')], '2026-09-16')
    const tramos = items.filter((i) => i.tipo === 'tramo')
    // Uno por mes: septiembre (15→1), agosto entero y julio (31→21).
    expect(tramos.map((t) => t.fecha.slice(0, 7))).toEqual(['2026-09', '2026-08', '2026-07'])
    expect(tramos[1]).toMatchObject({ fecha: '2026-08-31', hasta: '2026-08-01', dias: 31 })
    for (const t of tramos) expect(t.fecha.slice(0, 7)).toBe(t.hasta.slice(0, 7))
  })
})

describe('porMes', () => {
  it('agrupa conservando el orden', () => {
    const items = conHuecos([dia('2026-09-01'), dia('2026-08-31')], '2026-09-01')
    expect(porMes(items).map((m) => m.mes)).toEqual(['2026-09', '2026-08'])
  })
})

describe('resumenMes', () => {
  const items = conHuecos(
    [dia('2026-09-16'), dia('2026-09-15', { cerrado: true, estado: 'cerrado', turnos: 0, neto: 0 }), dia('2026-09-14', { neto: 500 })],
    '2026-09-16',
  )

  it('cuenta solo los días con registro y suma su neto', () => {
    expect(resumenMes(items)).toMatchObject({ conRegistro: 2, sinAbrir: 1, neto: 1500 })
  })

  it('el máximo del mes ignora los días sin abrir', () => {
    expect(resumenMes(items).maxNeto).toBe(1000)
  })
})
