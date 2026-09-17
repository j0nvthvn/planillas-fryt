// Formato de montos y fechas de los correos. Mismo criterio que
// v2/src/lib/format.ts (la app): "−$800" y no "$-800", fechas en es-CL
// con mayúscula solo al inicio. TypeScript puro: lo usan las edge
// functions (Deno) y scripts/correos (Node).

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })

export function clp(valor: unknown): string {
  const n = Number(valor) || 0
  return n < 0 ? `−${CLP.format(-n)}` : CLP.format(n)
}

/** "+$1.200" / "−$800" / "$0". */
export function clpSigno(valor: number): string {
  if (!valor) return '$0'
  return `${valor > 0 ? '+' : '−'}${clp(Math.abs(valor))}`
}

/** Variación porcentual redondeada, o null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 100)
}

export function mayusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-CL') + texto.slice(1)
}

function aFecha(fecha: string): Date {
  // Mediodía UTC: el día no cambia al formatear en cualquier zona.
  return new Date(fecha + 'T12:00:00Z')
}

function formatear(fecha: string, opciones: Intl.DateTimeFormatOptions): string {
  return aFecha(fecha).toLocaleDateString('es-CL', { timeZone: 'UTC', ...opciones })
}

/** "Miércoles 16 de septiembre" */
export function fechaLarga(fecha: string): string {
  return mayusculaInicial(formatear(fecha, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''))
}

/** "Mié 16" */
export function fechaDia(fecha: string): string {
  const dia = formatear(fecha, { weekday: 'short' }).replace('.', '')
  return `${mayusculaInicial(dia)} ${Number(fecha.slice(8, 10))}`
}

/** "16 sept" */
export function fechaDiaMes(fecha: string): string {
  return formatear(fecha, { day: 'numeric', month: 'short' }).replace('.', '')
}

/** "Septiembre de 2026" */
export function mesAnio(fecha: string): string {
  return mayusculaInicial(formatear(fecha, { month: 'long', year: 'numeric' }))
}

/** "8 – 14 sept" o "29 sept – 5 oct" */
export function rango(desde: string, hasta: string): string {
  if (desde === hasta) return fechaDiaMes(desde)
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7)
  return mismoMes
    ? `${Number(desde.slice(8, 10))} – ${fechaDiaMes(hasta)}`
    : `${fechaDiaMes(desde)} – ${fechaDiaMes(hasta)}`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Participación para mostrar: "<1 %" cuando hay monto pero redondea a cero. */
export function participacion(parte: number, total: number): string {
  if (!total || !parte) return ''
  const p = Math.round((parte / total) * 100)
  return p === 0 ? '<1 %' : `${p} %`
}
