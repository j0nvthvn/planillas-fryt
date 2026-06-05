import { toNum } from './format.js'

const METODOS = ['efectivo', 'getnet', 'mercadopago', 'edenred', 'amipass', 'transferencia']

export function totalesVentas(v) {
  if (!v) return { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0, total: 0 }
  const result = {}
  let total = 0
  for (const m of METODOS) {
    result[m] = toNum(v[m])
    total += result[m]
  }
  return { ...result, total }
}

export function totalesProveedores(arr) {
  const provs = arr || []
  const efectivo = provs
    .filter((p) => p.forma_pago === 'efectivo')
    .reduce((s, p) => s + toNum(p.monto), 0)
  const transferencia = provs
    .filter((p) => p.forma_pago === 'transferencia')
    .reduce((s, p) => s + toNum(p.monto), 0)
  return { efectivo, transferencia, total: efectivo + transferencia, lista: provs }
}
