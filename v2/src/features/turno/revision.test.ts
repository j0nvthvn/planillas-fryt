import { describe, expect, it } from 'vitest'
import { avisosCierre } from './revision'

const base = {
  trabajadorId: 't1', hayTrabajadores: true, contoCaja: true, diferenciaCaja: 0,
  totalVentas: 100000, totalProveedores: 20000,
}

describe('avisosCierre', () => {
  it('un cierre completo y cuadrado no avisa nada', () => {
    expect(avisosCierre(base)).toEqual([])
  })
  it('avisa cuando falta el trabajador', () => {
    expect(avisosCierre({ ...base, trabajadorId: null }).map((a) => a.id)).toEqual(['trabajador'])
  })
  it('no avisa por trabajador si no hay lista configurada', () => {
    expect(avisosCierre({ ...base, trabajadorId: null, hayTrabajadores: false })).toEqual([])
  })
  it('avisa si no se contó la caja', () => {
    expect(avisosCierre({ ...base, contoCaja: false, diferenciaCaja: null }).map((a) => a.id)).toEqual(['conteo'])
  })
  it('dice si falta o sobra efectivo', () => {
    expect(avisosCierre({ ...base, diferenciaCaja: -5000 })[0]?.texto).toContain('faltan $5.000')
    expect(avisosCierre({ ...base, diferenciaCaja: 3000 })[0]?.texto).toContain('sobran $3.000')
  })
  it('lo más grave primero: turno vacío antes que el resto', () => {
    const r = avisosCierre({ trabajadorId: null, hayTrabajadores: true, contoCaja: false, diferenciaCaja: null, totalVentas: 0, totalProveedores: 0 })
    expect(r.map((a) => a.id)).toEqual(['vacio', 'trabajador', 'conteo'])
  })
})
