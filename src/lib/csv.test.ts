import { describe, expect, it } from 'vitest'
import { csvTexto } from './csv'
import type { Tabla } from '@/features/exportar/tablas'

const tabla: Tabla = {
  titulo: 'x',
  columnas: [{ titulo: 'Fecha', tipo: 'fecha' }, { titulo: 'Proveedor', tipo: 'texto' }, { titulo: 'Monto', tipo: 'monto' }, { titulo: '%', tipo: 'pct' }],
  filas: [
    ['2026-09-05', 'Don Pepe; e hijos', -800, 0.25],
    ['2026-09-06', '=HYPERLINK("x")', 1200, null],
    ['2026-09-07', 'línea\r\nnueva', 0, 1],
  ],
  total: ['TOTAL', null, 400, null],
}

describe('csvTexto', () => {
  const lineas = csvTexto(tabla).split('\r\n')

  it('empieza con BOM y separa con punto y coma', () => {
    expect(csvTexto(tabla).startsWith('﻿Fecha;Proveedor;Monto;%')).toBe(true)
  })
  it('fecha dd-mm-aaaa, negativos y decimales con coma', () => {
    expect(lineas[1]).toBe('05-09-2026;"Don Pepe; e hijos";-800;0,25')
  })
  it('neutraliza fórmulas y escapa comillas', () => {
    expect(lineas[2]).toBe(`06-09-2026;"'=HYPERLINK(""x"")";1200;`)
  })
  it('cita los saltos de línea', () => {
    expect(csvTexto(tabla)).toContain('"línea\r\nnueva"')
  })
  it('termina con la fila TOTAL', () => {
    expect(csvTexto(tabla).endsWith('TOTAL;;400;')).toBe(true)
  })
})
