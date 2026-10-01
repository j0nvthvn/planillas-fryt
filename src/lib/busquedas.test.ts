import { describe, expect, it } from 'vitest'
import { busquedaAjustes, busquedaAnalisis, busquedaHistorial, busquedaProveedores } from './busquedas'

describe('filtros en la URL', () => {
  it('conserva los valores válidos', () => {
    expect(busquedaProveedores.parse({ q: 'coca', estado: 'todos', uso: 'sin', orden: 'monto', desde: '2026-01-01', hasta: '2026-09-30' }))
      .toEqual({ q: 'coca', estado: 'todos', uso: 'sin', orden: 'monto', desde: '2026-01-01', hasta: '2026-09-30' })
    expect(busquedaHistorial.parse({ filtro: 'descuadres' })).toEqual({ filtro: 'descuadres' })
    expect(busquedaAjustes.parse({ seccion: 'papelera' })).toEqual({ seccion: 'papelera' })
  })

  it('sin filtros, queda todo sin definir', () => {
    expect(busquedaAnalisis.parse({})).toEqual({ desde: undefined, hasta: undefined })
  })

  it('descarta solo el valor que no entiende, sin fallar', () => {
    expect(busquedaProveedores.parse({ estado: 'raro', orden: 'monto' })).toEqual({ estado: undefined, orden: 'monto' })
    expect(busquedaHistorial.parse({ filtro: 'otro' })).toEqual({ filtro: undefined })
    expect(busquedaAjustes.parse({ seccion: 42 })).toEqual({ seccion: undefined })
  })

  it.each(['ayer', '', '2026-02-31', '2026-13-01', '01-10-2026'])('descarta la fecha %s', (desde) => {
    expect(busquedaAnalisis.parse({ desde, hasta: '2026-09-30' })).toEqual({ desde: undefined, hasta: '2026-09-30' })
  })
})
