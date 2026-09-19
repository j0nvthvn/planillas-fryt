import { fechaLocal, hoy } from '@/lib/format'

/**
 * "10 – 16 septiembre"; si cruza meses o años, se nombran los dos. El año
 * aparece solo cuando no es el actual, para no repetirlo todo el tiempo.
 */
export function rangoLegible(desde: string, hasta: string, hoyISO = hoy()): string {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => fechaLocal(d).toLocaleDateString('es-CL', o)
  const anio = desde.slice(0, 4) !== hasta.slice(0, 4) || hasta.slice(0, 4) !== hoyISO.slice(0, 4)
  if (desde === hasta) return f(desde, { day: 'numeric', month: 'long', ...(anio ? { year: 'numeric' } : {}) })
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `${f(desde, { day: 'numeric' })} – ${f(hasta, { day: 'numeric', month: 'long', ...(anio ? { year: 'numeric' } : {}) })}`
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(anio ? { year: 'numeric' } : {}) }
  return `${f(desde, o)} – ${f(hasta, o)}`
}
