import { etiquetaModo } from '@/features/turno/modo'
import { etiquetaEstado } from '@/features/turno/estado'
import type { VResumenDia, VTurno } from '@/features/turno/api'
import { esMetodo, type MetodoKey } from '@/lib/totales'
import { toNum } from '@/lib/format'

/**
 * Las exportaciones (CSV, Excel y reporte imprimible) salen de estas tablas.
 * Aquí no se recalcula nada: cada monto viene tal cual de la base
 * (`v_turnos`, `v_resumen_dia`, `resumen_periodo`); lo único que se suma es
 * la fila TOTAL, que debe coincidir con los totales de `resumen_periodo`.
 */

export interface Totales { total_ventas: number; total_proveedores: number; neto: number; efectivo_neto: number; dias_con_registro: number; dias_con_borrador?: number; dias_cerrados?: number; [k: string]: number | undefined }
export interface Resumen {
  desde: string; hasta: string
  dias: VResumenDia[]
  totales: Totales
  anterior: Totales
  top_proveedores: { proveedor_id: string | null; nombre: string; imagen_url: string | null; monto: number; compras: number }[]
}

/** Una compra a proveedor con la fecha y el turno donde se pagó. */
export interface Compra {
  fecha: string
  modo: string
  proveedor: string
  forma_pago: string
  monto: number
}

export interface MetodoInfo { key: string; label: string; activo: boolean }

export type TipoColumna = 'texto' | 'fecha' | 'monto' | 'entero' | 'pct'
export interface Columna { titulo: string; tipo: TipoColumna; ancho?: number }
/** Fecha como "YYYY-MM-DD"; pct como fracción (0,25 = 25 %). */
export type Valor = string | number | null
export interface Tabla {
  titulo: string
  columnas: Columna[]
  filas: Valor[][]
  /** Fila de totales (la primera celda dice "TOTAL"). */
  total?: Valor[]
}

const monto = (titulo: string): Columna => ({ titulo, tipo: 'monto', ancho: 14 })

/**
 * Métodos que van como columna: los activos, más los inactivos que tengan
 * ventas en el período (si no, su monto quedaría en "Total ventas" sin
 * columna y la fila no cuadraría).
 */
export function metodosConVentas(metodos: readonly MetodoInfo[], filas: readonly object[]): { key: MetodoKey; label: string }[] {
  return metodos
    .filter((m): m is MetodoInfo & { key: MetodoKey } => esMetodo(m.key))
    .filter((m) => m.activo || filas.some((f) => toNum((f as Record<string, unknown>)[m.key]) !== 0))
    .map((m) => ({ key: m.key, label: m.label }))
}

function sumar(filas: Valor[][], desde: number): Valor[] {
  const n = filas[0]?.length ?? 0
  return Array.from({ length: n }, (_, i) => (i < desde ? null : filas.reduce((s, f) => s + toNum(f[i]), 0)))
}

function conTotal(t: Omit<Tabla, 'total'>, desde: number): Tabla {
  if (t.filas.length === 0) return t
  const total = sumar(t.filas, desde)
  total[0] = 'TOTAL'
  return { ...t, total }
}

export function etiquetaEstadoDia(estado: string): string {
  return etiquetaEstado(estado).largo
}

export function etiquetaEstadoTurno(t: Pick<VTurno, 'is_draft' | 'corregido'>): string {
  if (t.is_draft) return 'Borrador'
  return t.corregido ? 'Corregido' : 'Cerrado'
}

function etiquetaFormaPago(f: string): string {
  return f === 'efectivo' ? 'Efectivo' : f === 'transferencia' ? 'Transferencia' : f
}

/**
 * Los días que se muestran en una exportación: los que tuvieron movimiento
 * y también aquellos en que el local no abrió, que van con montos en cero y
 * su motivo (si no, faltarían fechas en el Excel sin explicación).
 *
 * Es a propósito distinta de `diasConRegistro` (features/analisis/resumen.ts),
 * que deja fuera los días sin abrir porque esos no promedian ni compiten por
 * "el peor día".
 */
export function diasExportables<T extends { turnos?: number | null; cerrado?: boolean | null }>(dias: readonly T[]): T[] {
  return dias.filter((d) => toNum(d.turnos) > 0 || !!d.cerrado)
}

/** Una fila por día con registro. Por día va el efectivo neto: el esperado suma dos fondos cuando hay mañana y tarde. */
export function tablaDias(dias: readonly VResumenDia[], metodos: readonly MetodoInfo[]): Tabla {
  const conRegistro = diasExportables(dias)
  const ms = metodosConVentas(metodos, conRegistro)
  const filas = conRegistro.map((d): Valor[] => [
    d.fecha,
    etiquetaEstadoDia(d.estado),
    [d.cerrado && (d.motivo_cierre || 'No abrió'), d.corregido && 'Corregido', d.con_descuadre && 'Descuadre'].filter(Boolean).join(', ') || null,
    ...ms.map((m) => toNum(d[m.key])),
    toNum(d.total_ventas), toNum(d.prov_efectivo), toNum(d.prov_transferencia), toNum(d.total_proveedores),
    toNum(d.neto), toNum(d.efectivo_neto),
  ])
  return conTotal({
    titulo: 'Días',
    columnas: [
      { titulo: 'Fecha', tipo: 'fecha', ancho: 12 },
      { titulo: 'Estado', tipo: 'texto', ancho: 15 },
      { titulo: 'Notas', tipo: 'texto', ancho: 20 },
      ...ms.map((m) => monto(m.label)),
      monto('Total ventas'), monto('Prov. efectivo'), monto('Prov. transferencia'), monto('Total proveedores'),
      monto('Neto'), monto('Efectivo neto'),
    ],
    filas,
  }, 3)
}

/** Una fila por turno, como la exportación de la app actual, más el trabajador y el cuadre de caja. */
export function tablaTurnos(turnos: readonly VTurno[], metodos: readonly MetodoInfo[]): Tabla {
  const ms = metodosConVentas(metodos, turnos)
  const filas = turnos.map((t): Valor[] => [
    t.fecha,
    etiquetaModo(t.modo),
    t.trabajador_nombre ?? null,
    t.usuario_nombre ?? null,
    etiquetaEstadoTurno(t),
    ...ms.map((m) => toNum(t[m.key])),
    toNum(t.total_ventas), toNum(t.prov_efectivo), toNum(t.prov_transferencia), toNum(t.total_proveedores), toNum(t.neto),
    toNum(t.fondo_inicial), toNum(t.efectivo_esperado),
    t.efectivo_contado ?? null,
    t.diferencia_efectivo ?? null,
  ])
  const tabla = conTotal({
    titulo: 'Turnos',
    columnas: [
      { titulo: 'Fecha', tipo: 'fecha', ancho: 12 },
      { titulo: 'Turno', tipo: 'texto', ancho: 13 },
      { titulo: 'Trabajador', tipo: 'texto', ancho: 16 },
      { titulo: 'Registrado por', tipo: 'texto', ancho: 16 },
      { titulo: 'Estado', tipo: 'texto', ancho: 11 },
      ...ms.map((m) => monto(m.label)),
      monto('Total ventas'), monto('Prov. efectivo'), monto('Prov. transferencia'), monto('Total proveedores'), monto('Neto'),
      monto('Fondo inicial'), monto('Efectivo esperado'), monto('Efectivo contado'), monto('Diferencia'),
    ],
    filas,
  }, 5)
  return soloDiferencia(tabla, turnos)
}

/**
 * Sumar fondos, esperados o conteos de distintos turnos no significa nada;
 * la suma de diferencias sí (el descuadre acumulado), si hubo algún conteo.
 */
function soloDiferencia(tabla: Tabla, turnos: readonly Pick<VTurno, 'diferencia_efectivo'>[]): Tabla {
  if (!tabla.total) return tabla
  const n = tabla.total.length
  tabla.total[n - 4] = null
  tabla.total[n - 3] = null
  tabla.total[n - 2] = null
  if (turnos.every((t) => t.diferencia_efectivo == null)) tabla.total[n - 1] = null
  return tabla
}

/** Una fila por compra a proveedor. */
export function tablaCompras(compras: readonly Compra[]): Tabla {
  return conTotal({
    titulo: 'Compras',
    columnas: [
      { titulo: 'Fecha', tipo: 'fecha', ancho: 12 },
      { titulo: 'Turno', tipo: 'texto', ancho: 13 },
      { titulo: 'Proveedor', tipo: 'texto', ancho: 28 },
      { titulo: 'Forma de pago', tipo: 'texto', ancho: 14 },
      monto('Monto'),
    ],
    filas: compras.map((c) => [c.fecha, etiquetaModo(c.modo), c.proveedor, etiquetaFormaPago(c.forma_pago), toNum(c.monto)]),
  }, 4)
}

/** Compras agrupadas por proveedor, de mayor a menor. */
export function tablaPorProveedor(compras: readonly Compra[]): Tabla {
  const grupos = new Map<string, { nombre: string; compras: number; efectivo: number; transferencia: number }>()
  for (const c of compras) {
    const clave = c.proveedor.trim().toLocaleLowerCase('es-CL')
    const g = grupos.get(clave) ?? { nombre: c.proveedor.trim(), compras: 0, efectivo: 0, transferencia: 0 }
    g.compras += 1
    if (c.forma_pago === 'efectivo') g.efectivo += toNum(c.monto)
    else g.transferencia += toNum(c.monto)
    grupos.set(clave, g)
  }
  const total = compras.reduce((s, c) => s + toNum(c.monto), 0)
  const filas = [...grupos.values()]
    .map((g) => ({ ...g, total: g.efectivo + g.transferencia }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
    .map((g): Valor[] => [g.nombre, g.compras, g.efectivo, g.transferencia, g.total, total ? g.total / total : 0])
  return conTotal({
    titulo: 'Por proveedor',
    columnas: [
      { titulo: 'Proveedor', tipo: 'texto', ancho: 28 },
      { titulo: 'Compras', tipo: 'entero', ancho: 9 },
      monto('Efectivo'), monto('Transferencia'), monto('Total'),
      { titulo: '% del total', tipo: 'pct', ancho: 11 },
    ],
    filas,
  }, 1)
}

/** Cuadre de caja de los turnos cerrados: esperado, contado y diferencia. */
export function tablaCuadre(turnos: readonly VTurno[]): Tabla {
  const cerrados = turnos.filter((t) => !t.is_draft)
  return soloDiferencia(conTotal({
    titulo: 'Cuadre de caja',
    columnas: [
      { titulo: 'Fecha', tipo: 'fecha', ancho: 12 },
      { titulo: 'Turno', tipo: 'texto', ancho: 13 },
      monto('Fondo inicial'), monto('Esperado'), monto('Contado'), monto('Diferencia'),
    ],
    filas: cerrados.map((t) => [t.fecha, etiquetaModo(t.modo), toNum(t.fondo_inicial), toNum(t.efectivo_esperado), t.efectivo_contado ?? null, t.diferencia_efectivo ?? null]),
  }, 2), cerrados)
}

/** Variación relativa contra el período anterior; null si antes no hubo nada. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior === 0 ? null : (actual - anterior) / Math.abs(anterior)
}

/** KPIs del período comparados con el anterior del mismo largo. */
export function tablaIndicadores(r: Resumen): Tabla {
  const fila = (nombre: string, k: 'total_ventas' | 'total_proveedores' | 'neto' | 'efectivo_neto'): Valor[] => {
    const a = toNum(r.totales[k])
    const b = toNum(r.anterior[k])
    return [nombre, a, b, variacion(a, b)]
  }
  return {
    titulo: 'Indicadores',
    columnas: [
      { titulo: 'Indicador', tipo: 'texto', ancho: 22 },
      monto('Período'), monto('Período anterior'),
      { titulo: 'Variación', tipo: 'pct', ancho: 11 },
    ],
    filas: [fila('Ventas', 'total_ventas'), fila('Proveedores', 'total_proveedores'), fila('Neto', 'neto'), fila('Efectivo neto', 'efectivo_neto')],
  }
}

/** Ventas del período por método, con su participación. */
export function tablaMetodos(r: Resumen, metodos: readonly MetodoInfo[]): Tabla {
  const total = toNum(r.totales.total_ventas)
  const ms = metodosConVentas(metodos, [r.totales])
  return conTotal({
    titulo: 'Ventas por método',
    columnas: [
      { titulo: 'Método', tipo: 'texto', ancho: 22 },
      monto('Monto'),
      { titulo: '% de las ventas', tipo: 'pct', ancho: 14 },
    ],
    filas: ms.map((m) => {
      const v = toNum(r.totales[m.key])
      return [m.label, v, total ? v / total : 0]
    }),
  }, 1)
}

/** Días compactos para el reporte impreso (sin una columna por método). */
export function tablaDiasCompacta(dias: readonly VResumenDia[]): Tabla {
  return conTotal({
    titulo: 'Por día',
    columnas: [
      { titulo: 'Fecha', tipo: 'fecha' },
      { titulo: 'Estado', tipo: 'texto' },
      monto('Ventas'), monto('Proveedores'), monto('Neto'), monto('Efectivo neto'),
    ],
    filas: diasExportables(dias).map((d) => [
      d.fecha, etiquetaEstadoDia(d.estado), toNum(d.total_ventas), toNum(d.total_proveedores), toNum(d.neto), toNum(d.efectivo_neto),
    ]),
  }, 2)
}
