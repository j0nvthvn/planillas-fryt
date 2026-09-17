// Destinatarios y envío por Resend: un correo por persona (nadie ve las
// direcciones de los demás), en una sola llamada batch.

import type { Correo } from './cierre.ts'

export type TipoCorreo = 'cierre' | 'diario' | 'semanal' | 'mensual'

type Fila = { email: string; activo: boolean; usuario: { activo: boolean } | null }

// deno-lint-ignore no-explicit-any
type Cliente = { from: (tabla: string) => any }

/** Correos activos que marcaron `tipo`; descarta cuentas desactivadas. */
export async function destinatarios(sb: Cliente, tipo: TipoCorreo): Promise<string[]> {
  const { data, error } = await sb.from('correo_destinatarios')
    .select('email, activo, usuario:usuarios(activo)')
    .eq('activo', true)
    .eq(tipo, true)
  if (error) throw error
  return (data as Fila[] ?? [])
    .filter((f) => f.usuario === null || f.usuario.activo !== false)
    .map((f) => f.email)
}

/** Interruptor general de Ajustes → Correos. */
export async function correosActivos(sb: Cliente): Promise<boolean> {
  const { data } = await sb.from('configuracion').select('valor').eq('clave', 'notificaciones_activas').maybeSingle()
  return data?.valor !== false
}

export type ResultadoEnvio = { enviados: number } | { error: string; status: number }

export async function enviar(correo: Correo, para: string[], env: { apiKey: string; from: string }): Promise<ResultadoEnvio> {
  if (para.length === 0) return { enviados: 0 }
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(para.map((to) => ({
      from: env.from,
      to: [to],
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }))),
  })
  if (!res.ok) return { error: await res.text(), status: res.status }
  return { enviados: para.length }
}

export function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}
