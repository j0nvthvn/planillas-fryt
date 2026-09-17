const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })

/** Pesos chilenos sin decimales: 12345 → "$12.345"; −800 → "−$800" (es-CL daba "$-800"). */
export function clp(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '$0'
  const n = Number(valor) || 0
  return n < 0 ? `−${CLP.format(-n)}` : CLP.format(n)
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

/** "Jonathan Flores" → "JF"; un solo nombre → su inicial. */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return partes.slice(0, 2).map((p) => p[0]!.toLocaleUpperCase('es-CL')).join('')
}

/** Mayúscula solo en la primera letra: el `capitalize` de CSS dejaba "16 De Septiembre De". */
export function mayusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-CL') + texto.slice(1)
}

/** "Septiembre de 2026" */
export function mesAnio(fecha: string): string {
  return mayusculaInicial(fechaLocal(fecha).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
}

/** "Miércoles, 16 de septiembre de 2026" */
export function fechaLegible(fecha: string | null | undefined): string {
  if (!fecha) return ''
  return mayusculaInicial(fechaLocal(fecha).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
}

/** Sin año: "Miércoles 16 de septiembre"; `corta`: "Miércoles 16 sept". */
export function fechaSinAnio(fecha: string | null | undefined, corta = false): string {
  if (!fecha) return ''
  return mayusculaInicial(fechaLocal(fecha).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: corta ? 'short' : 'long' }).replace(',', ''))
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

/**
 * Rango "YYYY-MM-DD" siempre válido: ninguna fecha pasa de `tope` y desde ≤ hasta.
 * Si quedó invertido, la fecha que el usuario acaba de cambiar arrastra a la otra;
 * sin `cambiado` (p. ej. una URL editada a mano) se intercambian.
 */
export function ajustarRango(desde: string, hasta: string, cambiado?: 'desde' | 'hasta', tope = hoy()): { desde: string; hasta: string } {
  const d = desde > tope ? tope : desde
  const h = hasta > tope ? tope : hasta
  if (d <= h) return { desde: d, hasta: h }
  if (cambiado === 'desde') return { desde: d, hasta: d }
  if (cambiado === 'hasta') return { desde: h, hasta: h }
  return { desde: h, hasta: d }
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
