import { toNum } from './format'

/** Métodos de venta = columnas de ventas_turno (hasta la Fase 5). */
export const METODO_KEYS = ['efectivo', 'getnet', 'mercadopago', 'edenred', 'amipass', 'transferencia'] as const
export type MetodoKey = (typeof METODO_KEYS)[number]

export type Ventas = Record<MetodoKey, number>
export type FormaPago = 'efectivo' | 'transferencia'

export interface ProveedorLinea {
  id?: string | null
  proveedor_id?: string | null
  nombre: string
  monto: number
  forma_pago: FormaPago
}

export const VENTAS_VACIAS: Ventas = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }

export function esMetodo(k: string): k is MetodoKey {
  return (METODO_KEYS as readonly string[]).includes(k)
}

export function totalVentas(v: Partial<Record<MetodoKey, unknown>> | null | undefined): number {
  if (!v) return 0
  return METODO_KEYS.reduce((s, k) => s + toNum(v[k]), 0)
}

export function totalesProveedores(lista: readonly Pick<ProveedorLinea, 'monto' | 'forma_pago'>[] | null | undefined) {
  let efectivo = 0
  let transferencia = 0
  for (const p of lista ?? []) {
    if (p.forma_pago === 'efectivo') efectivo += toNum(p.monto)
    else transferencia += toNum(p.monto)
  }
  return { efectivo, transferencia, total: efectivo + transferencia }
}

/**
 * Misma fórmula que `turno_totales()` en la base (única definición):
 *   neto              = ventas − proveedores
 *   efectivo_neto     = ventas.efectivo − proveedores en efectivo
 *   efectivo_esperado = fondo_inicial + efectivo_neto
 * Se usa solo para mostrar en vivo mientras se escribe; lo que queda
 * guardado lo calcula la base.
 */
export function totalesTurno(ventas: Partial<Ventas> | null | undefined, proveedores: readonly Pick<ProveedorLinea, 'monto' | 'forma_pago'>[], fondoInicial: number) {
  const total_ventas = totalVentas(ventas)
  const prov = totalesProveedores(proveedores)
  const efectivo_neto = toNum(ventas?.efectivo) - prov.efectivo
  return {
    total_ventas,
    prov_efectivo: prov.efectivo,
    prov_transferencia: prov.transferencia,
    total_proveedores: prov.total,
    neto: total_ventas - prov.total,
    efectivo_neto,
    efectivo_esperado: toNum(fondoInicial) + efectivo_neto,
  }
}
