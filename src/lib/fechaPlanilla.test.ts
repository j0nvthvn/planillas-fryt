import { describe, expect, it } from 'vitest'
import { busquedaPlanilla, hoyChile } from './fechaPlanilla'

describe('fecha de la planilla', () => {
  it('usa el día de Chile antes y después de medianoche con horario de verano', () => {
    expect(hoyChile(new Date('2026-10-02T02:59:00Z'))).toBe('2026-10-01')
    expect(hoyChile(new Date('2026-10-02T03:00:00Z'))).toBe('2026-10-02')
  })
  it('respeta el horario de invierno', () => {
    expect(hoyChile(new Date('2026-07-02T03:59:00Z'))).toBe('2026-07-01')
    expect(hoyChile(new Date('2026-07-02T04:00:00Z'))).toBe('2026-07-02')
  })
  it('completa la fecha ausente y conserva una fecha válida', () => {
    expect(busquedaPlanilla.parse({})).toEqual({ fecha: hoyChile() })
    expect(busquedaPlanilla.parse({ fecha: '2024-02-29' })).toEqual({ fecha: '2024-02-29' })
  })
  it.each(['', '2026-02-29', '2026-02-31', '2026-13-01', '01-10-2026'])('rechaza %s', (fecha) => {
    expect(busquedaPlanilla.safeParse({ fecha }).success).toBe(false)
  })
})
