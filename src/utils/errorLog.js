import { supabase } from '../lib/supabase'

/**
 * Registra un error en logs_error para que el dueño (como "desarrollador"
 * de la app) pueda revisarlo después, sin depender de que alguien se
 * acuerde de describir lo que pasó. Es "fire and forget": si el insert
 * mismo falla (sin conexión, por ejemplo), no debe romper la app ni
 * generar un loop de errores — se descarta en silencio.
 *
 * @param {string} mensaje - lo que se le mostró al usuario, o err.message.
 * @param {object} [extra]
 * @param {string} [extra.contexto] - de dónde vino (nombre de función/acción).
 * @param {string} [extra.ruta] - pathname donde ocurrió.
 * @param {any}    [extra.detalle] - info adicional serializable (código de error, stack, etc.)
 */
export async function logError(mensaje, { contexto, ruta, detalle } = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('logs_error').insert({
      usuario_id: user?.id ?? null,
      mensaje: String(mensaje).slice(0, 2000),
      contexto: contexto ?? null,
      ruta: ruta ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      detalle: detalle ? JSON.parse(JSON.stringify(detalle, jsonSafe)) : null,
    })
  } catch {
    // Silencioso a propósito — nunca debe interrumpir el flujo del usuario.
  }
}

function jsonSafe(_key, value) {
  if (value instanceof Error) return { message: value.message, stack: value.stack }
  return value
}
