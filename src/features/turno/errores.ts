import { fechaLocal } from '@/lib/format'

/**
 * El mensaje que ve la persona cuando un guardado falla, sin React ni red.
 *
 * Los errores propios de `guardar_turno` y de los triggers ya vienen en
 * español («El 2026-10-13 está marcado como día sin abrir…»): se conservan,
 * con la fecha en palabras. Los de Postgres o PostgREST llegan en inglés
 * («new row violates row-level security policy…») y se traducen por código.
 * El texto original va igual a `logs_error`.
 */
export function mensajeGuardado(error: { message?: string | null; code?: string | null }): string {
  const original = error.message?.trim() ?? ''
  const code = error.code ?? ''

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(original)) {
    return 'Sin conexión con el servidor. Tus datos quedaron guardados en este dispositivo.'
  }
  if (/jwt|token is expired|not authenticated/i.test(original) || code === 'PGRST301' || original === 'Sin sesión') {
    return 'Tu sesión expiró. Vuelve a ingresar; tus datos quedaron guardados en este dispositivo.'
  }
  if (original && !esCrudo(original)) return conFechasEnPalabras(original)

  switch (code) {
    case '23514': return 'Hay un monto que no es válido: revisa que ninguno sea negativo.'
    case '42501': return 'No tienes permiso para guardar este turno. Si ya está cerrado, la dueña puede corregirlo.'
    case '23505': return 'Este turno ya se registró en otro dispositivo. Recarga la pantalla.'
    case '22P02':
    case '22023':
    case '22003': return 'Hay un dato que no es válido. Revisa los montos.'
    default: return code
      ? `No se pudo guardar (código ${code}). Tus datos quedaron guardados en este dispositivo.`
      : 'No se pudo guardar. Tus datos quedaron guardados en este dispositivo.'
  }
}

/** Mensajes de Postgres o PostgREST, en inglés, que no se le muestran a nadie. */
function esCrudo(mensaje: string): boolean {
  return /violates|permission denied|row-level security|duplicate key|null value|invalid input|out of range|relation|column|function|syntax|could not|does not exist/i.test(mensaje)
}

/** «El 2026-10-13 está…» → «El 13 de octubre de 2026 está…». */
function conFechasEnPalabras(mensaje: string): string {
  return mensaje.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) =>
    fechaLocal(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }))
}
