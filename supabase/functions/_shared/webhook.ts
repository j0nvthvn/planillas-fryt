// Autenticación de las funciones que se invocan desde la base de datos
// (trigger en turno_cierres y pg_cron), no desde la app: se comparte un
// secreto en el header x-webhook-secret. El mismo valor vive en Vault
// (webhook_secret) y en los secretos de las edge functions
// (WEBHOOK_SECRET). Ver migración 20260915000200_correos_seguros.sql.

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Devuelve una Response de rechazo, o null si la petición es válida. */
export function verificarWebhook(req: Request): Response | null {
  const esperado = Deno.env.get('WEBHOOK_SECRET')
  if (!esperado) {
    console.error('WEBHOOK_SECRET no configurado en la función')
    return new Response(JSON.stringify({ error: 'función sin secreto configurado' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
  const recibido = req.headers.get('x-webhook-secret') ?? ''
  if (!igualesEnTiempoConstante(recibido, esperado)) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

const TZ = 'America/Santiago'

/** "YYYY-MM-DD" de un instante, en hora de Chile (nunca UTC). */
export function fechaChile(d: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** Suma días a una fecha "YYYY-MM-DD" sin pasar por zonas horarias. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d + dias)
  return new Date(t).toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado, para una fecha "YYYY-MM-DD". */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
