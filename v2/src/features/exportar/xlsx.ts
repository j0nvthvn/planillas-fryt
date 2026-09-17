import writeXlsxFile, { type Cell, type Row, type Sheet } from 'write-excel-file/browser'
import type { Tabla, TipoColumna, Valor } from './tablas'

/**
 * Libro Excel de verdad: montos como número con formato de pesos, fechas
 * como fecha, encabezado fijo y fila de totales en negrita. Este módulo se
 * importa con `import()` solo al exportar, así la librería no pesa en la carga
 * de la app.
 */

const FORMATO: Record<TipoColumna, string | undefined> = {
  texto: undefined,
  fecha: 'dd-mm-yyyy',
  monto: '"$"#,##0;[Red]-"$"#,##0',
  entero: '0',
  pct: '0.0%',
}

function celda(v: Valor, tipo: TipoColumna, negrita: boolean): Cell {
  const fontWeight = negrita ? ('bold' as const) : undefined
  if (v === null || v === '') return negrita ? { value: '', type: String, fontWeight } : null
  if (tipo === 'fecha' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number) as [number, number, number]
    return { value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: FORMATO.fecha, fontWeight }
  }
  if (typeof v === 'number') return { value: v, type: Number, format: FORMATO[tipo], fontWeight }
  return { value: v, type: String, fontWeight }
}

function filasDe(t: Tabla): Row[] {
  const tipos = t.columnas.map((c) => c.tipo)
  return [
    t.columnas.map((c): Cell => ({ value: c.titulo, type: String, fontWeight: 'bold', backgroundColor: '#EEF0FE', wrap: true })),
    ...t.filas.map((f) => f.map((v, i) => celda(v, tipos[i] ?? 'texto', false))),
    ...(t.total ? [t.total.map((v, i) => celda(v, tipos[i] ?? 'texto', true))] : []),
  ]
}

export interface Hoja {
  nombre: string
  /** Una o más tablas, una debajo de la otra. */
  tablas: Tabla[]
  /** Fila fija arriba (solo tiene sentido con una tabla). */
  fijarEncabezado?: boolean
}

export async function libroExcel(hojas: Hoja[], nombreArchivo: string): Promise<File> {
  const sheets: Sheet<Blob>[] = hojas.map((h) => {
    const data: Row[] = []
    h.tablas.forEach((t, i) => {
      if (i > 0) data.push([], [])
      if (h.tablas.length > 1) data.push([{ value: t.titulo, type: String, fontWeight: 'bold', fontSize: 13 }])
      data.push(...filasDe(t))
    })
    const nCols = Math.max(0, ...h.tablas.map((t) => t.columnas.length))
    const columns = Array.from({ length: nCols }, (_, i) => ({ width: Math.max(0, ...h.tablas.map((t) => t.columnas[i]?.ancho ?? 12)) }))
    return { data, sheet: h.nombre, columns, stickyRowsCount: h.fijarEncabezado ? 1 : undefined }
  })
  const blob = await writeXlsxFile(sheets, { fontFamily: 'Calibri', fontSize: 11 }).toBlob()
  return new File([blob], nombreArchivo, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
