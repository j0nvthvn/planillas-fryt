import { describe, it, expect } from 'vitest'
import { rangoLegible } from './rango'

const HOY = '2026-09-19'

describe('rangoLegible', () => {
  it('un solo día', () => {
    expect(rangoLegible('2026-09-10', '2026-09-10', HOY)).toBe('10 de septiembre')
  })

  it('dentro del mismo mes, el mes va una sola vez', () => {
    expect(rangoLegible('2026-09-10', '2026-09-16', HOY)).toBe('10 – 16 de septiembre')
  })

  it('cruzando meses, se nombran los dos', () => {
    expect(rangoLegible('2026-08-28', '2026-09-03', HOY)).toBe('28 ago – 3 sept')
  })

  it('el año aparece solo cuando no es el actual', () => {
    expect(rangoLegible('2025-09-10', '2025-09-16', HOY)).toContain('2025')
    expect(rangoLegible('2026-09-10', '2026-09-16', HOY)).not.toContain('2026')
  })

  it('un rango que cruza el año lleva los dos años', () => {
    const r = rangoLegible('2025-12-28', '2026-01-03', HOY)
    expect(r).toContain('2025')
    expect(r).toContain('2026')
  })
})
