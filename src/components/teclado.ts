import { parseNum } from '@/lib/format'

/** Estado del teclado: string de dígitos ("" = vacío). Máximo 9 dígitos. */
export function applyKey(cur: string, k: string): string {
  let v = String(cur ?? '')
  if (k === 'del') return v.slice(0, -1)
  if (k === '000') v = v === '' ? '' : v + '000'
  else v = v === '' || v === '0' ? k : v + k
  return v.replace(/^0+(?=\d)/, '').slice(0, 9)
}

export function digitosANumero(d: string): number {
  return parseNum(d)
}

export function numeroADigitos(n: number | null | undefined): string {
  const v = Math.max(0, Math.round(Number(n) || 0))
  return v === 0 ? '' : String(v)
}
