import { z } from 'zod'
import { hoy } from './format'

/** El local opera en Chile, aunque el dispositivo use otra zona horaria. */
export const hoyChile = hoy

/** Una fecha "YYYY-MM-DD" que existe: rechaza el 31 de febrero o el mes 13. */
export const fechaValida = z.iso.date()

export const busquedaPlanilla = z.object({ fecha: fechaValida.default(() => hoyChile()) })
