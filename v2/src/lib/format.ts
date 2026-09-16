const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })

/** Pesos chilenos sin decimales: 12345 → "$12.345". */
export function clp(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '$0'
  return CLP.format(Number(valor) || 0)
}

/** "+$1.200" / "−$800" para diferencias (descuadre, variaciones). */
export function clpSigno(valor: number): string {
  if (valor === 0) return '$0'
  return `${valor > 0 ? '+' : '−'}${clp(Math.abs(valor))}`
}

/** Etiqueta corta para ejes/tarjetas: $1,2M · $45k · $900. */
export function clpCorto(v: number): string {
  if (v === 0) return '$0'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${abs}`
}

function fechaLocal(fecha: string): Date {
  // "YYYY-MM-DD" a mediodía local: nunca cambia de día por zona horaria.
  return new Date(fecha + 'T12:00:00')
}

export function fechaLegible(fecha: string | null | undefined): string {
  if (!fecha) return ''
  return fechaLocal(fecha).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ''
  return fechaLocal(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** "lun 15 sept" */
export function fechaDiaMes(fecha: string | null | undefined): string {
  if (!fecha) return ''
  return fechaLocal(fecha).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function horaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Fecha de un Date como "YYYY-MM-DD" con los componentes LOCALES.
 * Nunca `toISOString().slice(0,10)`: en Chile después de las ~21:00 daría
 * el día siguiente.
 */
export function fechaISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hoy(): string {
  return fechaISO(new Date())
}

export function sumarDias(fecha: string, dias: number): string {
  const d = fechaLocal(fecha)
  d.setDate(d.getDate() + dias)
  return fechaISO(d)
}

/** 0 = domingo … 6 = sábado, de una fecha "YYYY-MM-DD". */
export function diaSemana(fecha: string): number {
  return fechaLocal(fecha).getDay()
}

export function parseNum(val: string | number | null | undefined): number {
  const n = parseFloat(String(val ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

export function toNum(v: unknown): number {
  return Number(v) || 0
}

export function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
