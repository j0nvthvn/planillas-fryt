import { supabase } from './supabase'

interface Extra {
  contexto?: string
  ruta?: string
  detalle?: unknown
}

/**
 * Registra un error en logs_error (misma tabla que la app actual) para
 * revisarlo después. "Fire and forget": si el insert falla (sin conexión),
 * se descarta en silencio; nunca interrumpe al usuario.
 */
export async function logError(mensaje: string, { contexto, ruta, detalle }: Extra = {}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser()
    await supabase.from('logs_error').insert({
      usuario_id: data.user?.id ?? null,
      mensaje: String(mensaje).slice(0, 2000),
      // Prefijo "v2:" para distinguir en logs_error lo que viene de esta app
      // durante el piloto (criterio de salida: 0 errores nuevos de la v2).
      contexto: `v2:${contexto ?? 'app'}`,
      ruta: ruta ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      detalle: detalle === undefined ? null : JSON.parse(JSON.stringify(detalle, jsonSafe)),
    })
  } catch {
    /* silencioso a propósito */
  }
}

function jsonSafe(_key: string, value: unknown) {
  if (value instanceof Error) return { message: value.message, stack: value.stack }
  return value
}

/** Mensaje legible de cualquier error (PostgREST, Auth, red, Error). */
export function mensajeDeError(e: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (!e) return fallback
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown }
    if (typeof o.message === 'string' && o.message) return o.message
    if (typeof o.error_description === 'string') return o.error_description
  }
  return fallback
}
