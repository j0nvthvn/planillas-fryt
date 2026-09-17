// Rangos de los resúmenes, en fechas "YYYY-MM-DD" de Chile. La misma
// regla vive en SQL (programar_resumenes): el resumen de hoy cubre el
// período cerrado anterior.

export type TipoResumen = 'diario' | 'semanal' | 'mensual'
export type Rango = { desde: string; hasta: string }

const TZ = 'America/Santiago'

/** "YYYY-MM-DD" de un instante, en hora de Chile. */
export function fechaChile(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Hora (0–23) de un instante, en hora de Chile. */
export function horaChile(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d))
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Período cerrado más reciente respecto de `hoy`. */
export function periodoAnteriorA(tipo: TipoResumen, hoy: string): Rango {
  if (tipo === 'diario') {
    const ayer = sumarDias(hoy, -1)
    return { desde: ayer, hasta: ayer }
  }
  if (tipo === 'semanal') {
    const lunesActual = sumarDias(hoy, -((diaSemana(hoy) + 6) % 7))
    return { desde: sumarDias(lunesActual, -7), hasta: sumarDias(lunesActual, -1) }
  }
  const primeroActual = `${hoy.slice(0, 7)}-01`
  const ultimoAnterior = sumarDias(primeroActual, -1)
  return { desde: `${ultimoAnterior.slice(0, 7)}-01`, hasta: ultimoAnterior }
}

/** El período del mismo tipo inmediatamente anterior a `r` (para comparar). */
export function periodoPrevio(tipo: TipoResumen, r: Rango): Rango {
  return periodoAnteriorA(tipo, r.desde)
}

/** Período que contiene a `fecha` (p. ej. el que pidió una prueba). */
export function periodoQueContiene(tipo: TipoResumen, fecha: string): Rango {
  if (tipo === 'diario') return { desde: fecha, hasta: fecha }
  return periodoAnteriorA(tipo, tipo === 'semanal' ? sumarDias(fecha, 7) : sumarDias(`${fecha.slice(0, 7)}-01`, 32).slice(0, 7) + '-01')
}
