import { describe, expect, it } from 'vitest'
import type { VResumenDia, VTurno } from '@/features/turno/api'
import { metodosConVentas, tablaCompras, tablaCuadre, tablaDias, tablaIndicadores, tablaMetodos, tablaPorProveedor, tablaTurnos, variacion, type Compra, type MetodoInfo, type Resumen } from './tablas'

const METODOS: MetodoInfo[] = [
  { key: 'efectivo', label: 'Efectivo', activo: true },
  { key: 'getnet', label: 'Getnet', activo: true },
  { key: 'amipass', label: 'Amipass', activo: false },
  { key: 'edenred', label: 'Edenred', activo: false },
]

const cero = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }

function dia(p: Partial<VResumenDia>): VResumenDia {
  return { ...cero, fecha: '2026-09-01', jornada_id: 'j', estado: 'completo', turnos: 1, corregido: false, con_descuadre: false, total_ventas: 0, prov_efectivo: 0, prov_transferencia: 0, total_proveedores: 0, neto: 0, efectivo_neto: 0, efectivo_esperado: 0, ...p } as VResumenDia
}

function turno(p: Partial<VTurno>): VTurno {
  return { ...cero, id: 't', fecha: '2026-09-01', tipo: 'mañana', modo: 'mañana', is_draft: false, jornada_id: 'j', corregido: false, trabajador_nombre: null, usuario_nombre: 'Angélica', total_ventas: 0, prov_efectivo: 0, prov_transferencia: 0, total_proveedores: 0, neto: 0, efectivo_neto: 0, fondo_inicial: 0, efectivo_esperado: 0, efectivo_contado: null, diferencia_efectivo: null, ...p } as VTurno
}

describe('metodosConVentas', () => {
  it('incluye los activos y los inactivos solo si tienen ventas', () => {
    const ms = metodosConVentas(METODOS, [{ amipass: 500 }, { edenred: 0 }])
    expect(ms.map((m) => m.key)).toEqual(['efectivo', 'getnet', 'amipass'])
  })
  it('ignora claves que no son métodos de venta', () => {
    expect(metodosConVentas([{ key: 'cheque', label: 'Cheque', activo: true }], [])).toEqual([])
  })
})

describe('tablaDias', () => {
  const dias = [
    dia({ fecha: '2026-09-01', efectivo: 1000, getnet: 500, total_ventas: 1500, prov_efectivo: 200, total_proveedores: 200, neto: 1300, efectivo_neto: 800, efectivo_esperado: 99999 }),
    dia({ fecha: '2026-09-02', estado: 'parcial', corregido: true, con_descuadre: true, efectivo: 300, amipass: 100, total_ventas: 400, prov_transferencia: 50, total_proveedores: 50, neto: 350, efectivo_neto: 300 }),
    dia({ fecha: '2026-09-03', estado: 'sin_registro', turnos: 0 }),
    dia({ fecha: '2026-09-04', estado: 'cerrado', turnos: 0, cerrado: true, motivo_cierre: 'Feriado' }),
  ]
  const t = tablaDias(dias, METODOS)

  it('omite los días sin turnos y etiqueta el estado', () => {
    expect(t.filas).toHaveLength(3)
    expect(t.filas[1]?.slice(0, 3)).toEqual(['2026-09-02', 'Falta un turno', 'Corregido, Descuadre'])
  })
  it('incluye el día en que el local no abrió, con su motivo', () => {
    expect(t.filas[2]?.slice(0, 3)).toEqual(['2026-09-04', 'No abrió', 'Feriado'])
  })
  it('un día sin abrir no mueve los totales', () => {
    const col = (titulo: string) => t.columnas.findIndex((c) => c.titulo === titulo)
    expect(t.total?.[col('Total ventas')]).toBe(1900)
  })
  it('agrega la columna del método inactivo con ventas', () => {
    expect(t.columnas.map((c) => c.titulo)).toContain('Amipass')
  })
  it('usa el efectivo neto por día, no el esperado', () => {
    expect(t.columnas.map((c) => c.titulo)).not.toContain('Efectivo esperado')
    expect(t.filas[0]?.at(-1)).toBe(800)
  })
  it('la fila TOTAL suma cada columna numérica', () => {
    const col = (titulo: string) => t.columnas.findIndex((c) => c.titulo === titulo)
    expect(t.total?.[0]).toBe('TOTAL')
    expect(t.total?.[1]).toBeNull()
    expect(t.total?.[col('Total ventas')]).toBe(1900)
    expect(t.total?.[col('Neto')]).toBe(1650)
    expect(t.total?.[col('Amipass')]).toBe(100)
  })
})

describe('tablaTurnos', () => {
  const t = tablaTurnos([
    turno({ efectivo: 1000, total_ventas: 1000, neto: 1000, fondo_inicial: 20000, efectivo_esperado: 21000, efectivo_contado: 20500, diferencia_efectivo: -500, trabajador_nombre: 'Diego' }),
    turno({ tipo: 'tarde', modo: 'tarde', is_draft: true, efectivo: 200, total_ventas: 200, neto: 200, fondo_inicial: 21000, efectivo_esperado: 21200 }),
    turno({ fecha: '2026-09-02', modo: 'completo', corregido: true, diferencia_efectivo: 300, efectivo_contado: 1 }),
  ], METODOS)
  const col = (titulo: string) => t.columnas.findIndex((c) => c.titulo === titulo)

  it('trae turno, trabajador, quién registró y estado', () => {
    expect(t.filas.map((f) => f.slice(0, 5))).toEqual([
      ['2026-09-01', 'Mañana', 'Diego', 'Angélica', 'Cerrado'],
      ['2026-09-01', 'Tarde', null, 'Angélica', 'Borrador'],
      ['2026-09-02', 'Día completo', null, 'Angélica', 'Corregido'],
    ])
  })
  it('deja vacío el conteo si no se contó', () => {
    expect(t.filas[1]?.[col('Efectivo contado')]).toBeNull()
    expect(t.filas[1]?.[col('Diferencia')]).toBeNull()
  })
  it('suma ventas y diferencias, pero no fondos ni esperados', () => {
    expect(t.total?.[col('Total ventas')]).toBe(1200)
    expect(t.total?.[col('Diferencia')]).toBe(-200)
    expect(t.total?.[col('Fondo inicial')]).toBeNull()
    expect(t.total?.[col('Efectivo esperado')]).toBeNull()
    expect(t.total?.[col('Efectivo contado')]).toBeNull()
  })
  it('sin turnos no hay fila TOTAL', () => {
    expect(tablaTurnos([], METODOS).total).toBeUndefined()
  })
})

describe('tablaCuadre', () => {
  it('solo los turnos cerrados', () => {
    const t = tablaCuadre([turno({ is_draft: true }), turno({ modo: 'completo', efectivo_esperado: 100 })])
    expect(t.filas).toEqual([['2026-09-01', 'Día completo', 0, 100, null, null]])
  })
  it('el total solo suma diferencias, y queda vacío si nadie contó', () => {
    expect(tablaCuadre([turno({ fondo_inicial: 5, efectivo_esperado: 100 })]).total).toEqual(['TOTAL', null, null, null, null, null])
    expect(tablaCuadre([turno({ diferencia_efectivo: -300 }), turno({ diferencia_efectivo: 100 })]).total?.[5]).toBe(-200)
  })
})

describe('compras', () => {
  const compras: Compra[] = [
    { fecha: '2026-09-01', modo: 'mañana', proveedor: 'Coca-Cola', forma_pago: 'efectivo', monto: 1000 },
    { fecha: '2026-09-01', modo: 'tarde', proveedor: 'coca-cola ', forma_pago: 'transferencia', monto: 500 },
    { fecha: '2026-09-02', modo: 'completo', proveedor: 'Pan', forma_pago: 'efectivo', monto: 2500 },
  ]
  it('una fila por compra con total', () => {
    const t = tablaCompras(compras)
    expect(t.filas[0]).toEqual(['2026-09-01', 'Mañana', 'Coca-Cola', 'Efectivo', 1000])
    expect(t.total).toEqual(['TOTAL', null, null, null, 4000])
  })
  it('agrupa por proveedor ignorando mayúsculas y espacios, de mayor a menor', () => {
    const t = tablaPorProveedor(compras)
    expect(t.filas).toEqual([
      ['Pan', 1, 2500, 0, 2500, 0.625],
      ['Coca-Cola', 2, 1000, 500, 1500, 0.375],
    ])
    expect(t.total).toEqual(['TOTAL', 3, 3500, 500, 4000, 1])
  })
})

describe('resumen', () => {
  const r: Resumen = {
    desde: '2026-09-01', hasta: '2026-09-07', dias: [], top_proveedores: [],
    totales: { total_ventas: 1000, total_proveedores: 400, neto: 600, efectivo_neto: 300, dias_con_registro: 2, efectivo: 750, getnet: 250, amipass: 0 },
    anterior: { total_ventas: 800, total_proveedores: 0, neto: 800, efectivo_neto: -100, dias_con_registro: 2 },
  }
  it('indicadores con variación; sin base anterior queda vacía', () => {
    const t = tablaIndicadores(r)
    expect(t.filas[0]).toEqual(['Ventas', 1000, 800, 0.25])
    expect(t.filas[1]).toEqual(['Proveedores', 400, 0, null])
    expect(t.filas[3]?.[3]).toBe(4)
  })
  it('ventas por método con participación; los inactivos sin ventas no aparecen', () => {
    const t = tablaMetodos(r, METODOS)
    expect(t.filas).toEqual([['Efectivo', 750, 0.75], ['Getnet', 250, 0.25]])
    expect(t.total?.[1]).toBe(r.totales.total_ventas)
  })
  it('variacion', () => {
    expect(variacion(50, 100)).toBe(-0.5)
    expect(variacion(5, 0)).toBeNull()
  })
})
