import { z } from 'zod'

/** El local opera en Chile, aunque el dispositivo use otra zona horaria. */
export function hoyChile(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(ahora)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Rechaza también fechas imposibles (por ejemplo, 31 de febrero). */
export const busquedaPlanilla = z.object({ fecha: z.iso.date().default(() => hoyChile()) })
