import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Llamada vía Database Webhook: INSERT en tabla turnos
// Payload: { type: 'INSERT', record: { id, jornada_id, tipo, usuario_id, creado_en }, ... }

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    if (payload.type !== 'INSERT') return new Response('ok', { status: 200 })

    const turno = payload.record as { id: string; jornada_id: string; tipo: string; usuario_id: string }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar si las notificaciones están activas
    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['notificaciones_activas', 'notificaciones_email_extra'])

    const cfg = Object.fromEntries((cfgRows ?? []).map((r: { clave: string; valor: unknown }) => [r.clave, r.valor]))
    if (cfg.notificaciones_activas === false) return new Response('ok', { status: 200 })

    // Obtener fecha de la jornada
    const { data: jornada } = await supabase
      .from('jornadas').select('fecha').eq('id', turno.jornada_id).single()

    // Solo notificar si el turno es de hoy (ignorar turnos históricos)
    const hoy = new Date().toISOString().split('T')[0]
    if (!jornada || jornada.fecha !== hoy) return new Response('ok', { status: 200 })

    // Obtener ventas del turno
    const { data: ventas } = await supabase
      .from('ventas_turno').select('*').eq('turno_id', turno.id).single()

    // Obtener proveedores del turno
    const { data: proveedores } = await supabase
      .from('proveedores_turno').select('nombre, monto, forma_pago').eq('turno_id', turno.id)

    // Obtener nombre de quien registró
    const { data: registrador } = await supabase
      .from('usuarios').select('nombre').eq('id', turno.usuario_id).single()

    // Obtener email(s) del dueño
    const { data: duenos } = await supabase
      .from('usuarios').select('email').eq('rol', 'dueño').eq('activo', true)

    const destinatarios: string[] = (duenos ?? []).map((d: { email: string }) => d.email)
    if (cfg.notificaciones_email_extra && typeof cfg.notificaciones_email_extra === 'string') {
      destinatarios.push(cfg.notificaciones_email_extra)
    }
    if (destinatarios.length === 0) return new Response('ok', { status: 200 })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY no configurado')
      return new Response('ok', { status: 200 })
    }

    const html = buildEmailTurno({
      fecha: jornada?.fecha ?? '',
      tipo: turno.tipo,
      ventas: ventas ?? {},
      proveedores: proveedores ?? [],
      registrador: registrador?.nombre ?? 'Desconocido',
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') ?? 'FrytControl <onboarding@resend.dev>',
        to: destinatarios,
        subject: `Turno ${capitalizar(turno.tipo)} registrado · ${fechaLegible(jornada?.fecha ?? '')}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      // Antes esto devolvía 200 igual, así que un fallo de Resend (por
      // ejemplo, cuenta en modo sandbox sin dominio verificado) quedaba
      // invisible en los logs de invocación — parecía "entregado" cuando
      // en realidad Resend lo rechazó.
      return new Response(JSON.stringify({ error: 'resend', detail: err }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('error', { status: 500 })
  }
})

// ── Helpers ────────────────────────────────────────────────

function clp(v: unknown): string {
  const n = Number(v) || 0
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fechaLegible(fecha: string): string {
  if (!fecha) return ''
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      color: '#1E7A4F' },
  { key: 'getnet',        label: 'Getnet',         color: '#33518C' },
  { key: 'mercadopago',   label: 'Mercado Pago',   color: '#00b1ea' },
  { key: 'edenred',       label: 'Edenred',        color: '#f59e0b' },
  { key: 'amipass',       label: 'Amipass',        color: '#a16207' },
  { key: 'transferencia', label: 'Transferencia',  color: '#5C3317' },
]

interface BuildEmailParams {
  fecha: string
  tipo: string
  ventas: Record<string, unknown>
  proveedores: Array<{ nombre: string; monto: number; forma_pago: string }>
  registrador: string
}

function buildEmailTurno({ fecha, tipo, ventas, proveedores, registrador }: BuildEmailParams): string {
  const totalVentas = METODOS.reduce((s, m) => s + (Number(ventas[m.key]) || 0), 0)
  const efProvs = proveedores.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0)
  const trProvs = proveedores.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + Number(p.monto), 0)
  const saldo = (Number(ventas.efectivo) || 0) - efProvs

  const ventasRows = METODOS
    .filter((m) => Number(ventas[m.key]) > 0)
    .map((m) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${m.color};margin-right:8px;vertical-align:middle;"></span>
          ${m.label}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(ventas[m.key])}</td>
      </tr>`)
    .join('')

  const provRows = proveedores.length > 0
    ? proveedores.map((p) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;">${p.nombre}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(p.monto)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;color:#6b7280;font-size:12px;">${capitalizar(p.forma_pago)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin proveedores</td></tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">

    <!-- Header -->
    <div style="background:#5C3317;padding:24px 28px;">
      <p style="margin:0 0 4px;color:#F5EAD4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">FrytControl</p>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Turno ${capitalizar(tipo)} registrado</h1>
      <p style="margin:6px 0 0;color:#e9d5b4;font-size:14px;text-transform:capitalize;">${fechaLegible(fecha)}</p>
    </div>

    <!-- Total destacado -->
    <div style="padding:20px 28px;background:#f9f5ed;border-bottom:1px solid #f0ebe3;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Total ventas</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:#5C3317;">${clp(totalVentas)}</p>
    </div>

    <!-- Ventas por método -->
    <div style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;">Ventas por método</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${ventasRows || '<tr><td colspan="2" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin ventas registradas</td></tr>'}
        <tr style="background:#f9f5ed;">
          <td style="padding:10px 12px;font-weight:700;color:#111827;">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:800;color:#5C3317;">${clp(totalVentas)}</td>
        </tr>
      </table>
    </div>

    <!-- Proveedores -->
    <div style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;">Proveedores</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${provRows}
        ${proveedores.length > 0 ? `
        <tr style="background:#f9f5ed;">
          <td style="padding:10px 12px;font-weight:700;color:#111827;">Total efectivo</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;color:#1E7A4F;">${clp(efProvs)}</td>
          <td></td>
        </tr>
        ${trProvs > 0 ? `<tr style="background:#f9f5ed;"><td style="padding:4px 12px 10px;font-weight:700;color:#111827;">Total transferencia</td><td style="padding:4px 12px 10px;text-align:right;font-weight:700;color:#33518C;">${clp(trProvs)}</td><td></td></tr>` : ''}
        ` : ''}
      </table>
    </div>

    <!-- Saldo efectivo -->
    <div style="margin:16px 28px;padding:16px;background:#EDFAF3;border-radius:12px;border-left:4px solid #1E7A4F;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Saldo efectivo en caja</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#1E7A4F;">${clp(saldo)}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Ventas efectivo − proveedores efectivo</p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px 24px;border-top:1px solid #f0ebe3;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Registrado por <strong style="color:#374151;">${registrador}</strong></p>
    </div>
  </div>
</body>
</html>`
}
