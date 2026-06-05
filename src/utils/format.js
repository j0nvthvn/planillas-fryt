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

export function hoy() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseNum(val) {
  const n = parseFloat(String(val).replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function toNum(v) {
  return Number(v) || 0
}
