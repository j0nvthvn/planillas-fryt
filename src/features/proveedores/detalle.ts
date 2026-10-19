import { toNum } from '@/lib/format'

/** Una compra tal como llega de `proveedores_turno` con su turno y su jornada. */
export interface FilaCompra {
  id: string
  monto: number | string
  forma_pago: string
  creado_en: string
  turno: { tipo: string; jornada: { fecha: string; es_turno_unico: boolean | null } | null } | null
}

export interface Compra {
  id: string
  fecha: string
  modo: 'completo' | 'mañana' | 'tarde'
  monto: number
  formaPago: 'efectivo' | 'transferencia'
}

/**
 * Todas las compras de un proveedor, de la jornada más reciente a la más
 * antigua (no por cuándo se escribió la fila), con el total real. El «día
 * completo» se guarda como turno de mañana en una jornada de turno único:
 * se muestra como día completo, no como «mañana».
 */
export function comprasDelProveedor(filas: FilaCompra[]): { compras: Compra[]; total: number } {
  const compras = filas
    .filter((f) => f.turno?.jornada)
    .map((f): Compra & { creadoEn: string } => ({
      id: f.id,
      fecha: f.turno!.jornada!.fecha,
      modo: f.turno!.jornada!.es_turno_unico ? 'completo' : f.turno!.tipo === 'tarde' ? 'tarde' : 'mañana',
      monto: toNum(f.monto),
      formaPago: f.forma_pago === 'transferencia' ? 'transferencia' : 'efectivo',
      creadoEn: f.creado_en,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn))
    .map(({ creadoEn: _c, ...c }) => c)
  return { compras, total: compras.reduce((s, c) => s + c.monto, 0) }
}
