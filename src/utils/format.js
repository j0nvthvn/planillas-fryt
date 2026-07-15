export function clp(valor) {
  if (valor === null || valor === undefined || valor === '') return '$0'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(Number(valor))
}

export function fechaLegible(fecha) {
  if (!fecha) return ''
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function fechaCorta(fecha) {
  if (!fecha) return ''
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Fecha de un Date como "YYYY-MM-DD" usando los componentes LOCALES.
 * Nunca usar `toISOString().split('T')[0]` para esto: convierte a UTC
 * primero, y en Chile (UTC-3/-4) después de las ~21:00 devuelve el día
 * siguiente — corría los rangos de Análisis un día en las noches.
 */
export function fechaISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function hoy() {
  return fechaISO(new Date())
}

export function parseNum(val) {
  const n = parseFloat(String(val).replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function toNum(v) {
  return Number(v) || 0
}
