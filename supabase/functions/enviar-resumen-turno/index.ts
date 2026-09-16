import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarWebhook } from '../_shared/webhook.ts'

// Se invoca desde el trigger notificar_cierre (AFTER INSERT en
// turno_cierres, solo cierres originales) — ver migración
// 20260915000200_correos_seguros.sql. Payload:
//   { type: 'INSERT', table: 'turno_cierres', record: { ...fila de turno_cierres } }
// El correo usa la fotografía del cierre (ventas_snapshot,
// proveedores_snapshot, efectivo_*), que es exactamente lo que quedó
// registrado — antes se disparaba al crear el turno y salía sin ventas.

type Cierre = {
  id: string
  turno_id: string
  cerrado_por: string
  cerrado_en: string
  ventas_snapshot: Record<string, unknown>
  proveedores_snapshot: Array<{ nombre: string; monto: number; forma_pago: string }>
  total_ventas: number
  total_proveedores: number
  es_correccion: boolean
  efectivo_esperado: number | null
  efectivo_contado: number | null
  diferencia_efectivo: number | null
}

Deno.serve(async (req) => {
  const rechazo = verificarWebhook(req)
  if (rechazo) return rechazo

  try {
    const payload = await req.json()
    const cierre = payload?.record as Cierre | undefined
    if (payload?.type !== 'INSERT' || !cierre?.turno_id || cierre.es_correccion) {
      return new Response('ok', { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['notificaciones_activas', 'notificaciones_email_extra'])
    const cfg = Object.fromEntries((cfgRows ?? []).map((r: { clave: string; valor: unknown }) => [r.clave, r.valor]))
    if (cfg.notificaciones_activas === false) return new Response('ok', { status: 200 })

    // Turno + jornada + quién lo registró, en una sola consulta.
    const { data: turno, error: errTurno } = await supabase
      .from('turnos')
      .select('id, tipo, fondo_inicial, jornada:jornadas(fecha, es_turno_unico), usuario:usuarios!turnos_usuario_id_fkey(nombre)')
      .eq('id', cierre.turno_id)
      .maybeSingle()
    if (errTurno || !turno) {
      console.error('No se pudo cargar el turno del cierre:', errTurno)
      return new Response('ok', { status: 200 })
    }
    const jornada = turno.jornada as unknown as { fecha: string; es_turno_unico: boolean } | null
    const usuario = turno.usuario as unknown as { nombre: string } | null

    const { data: cerrador } = await supabase
      .from('usuarios').select('nombre').eq('id', cierre.cerrado_por).maybeSingle()

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

    const etiquetaTurno = jornada?.es_turno_unico ? 'Día completo' : `Turno ${capitalizar(turno.tipo)}`
    const html = buildEmailTurno({
      fecha: jornada?.fecha ?? '',
      etiquetaTurno,
      ventas: cierre.ventas_snapshot ?? {},
      proveedores: cierre.proveedores_snapshot ?? [],
      registrador: usuario?.nombre ?? 'Desconocido',
      cerradoPor: cerrador?.nombre ?? null,
      fondoInicial: Number(turno.fondo_inicial) || 0,
      efectivoEsperado: cierre.efectivo_esperado,
      efectivoContado: cierre.efectivo_contado,
      diferencia: cierre.diferencia_efectivo,
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
        subject: `${etiquetaTurno} cerrado · ${fechaLegible(jornada?.fecha ?? '')}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      // Se devuelve 502 (no 200) para que el fallo quede visible en
      // net._http_response y en los logs de la función.
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
  etiquetaTurno: string
  ventas: Record<string, unknown>
  proveedores: Array<{ nombre: string; monto: number; forma_pago: string }>
  registrador: string
  cerradoPor: string | null
  fondoInicial: number
  efectivoEsperado: number | null
  efectivoContado: number | null
  diferencia: number | null
}

function buildEmailTurno({
  fecha, etiquetaTurno, ventas, proveedores, registrador, cerradoPor,
  fondoInicial, efectivoEsperado, efectivoContado, diferencia,
}: BuildEmailParams): string {
  const totalVentas = METODOS.reduce((s, m) => s + (Number(ventas[m.key]) || 0), 0)
  const efProvs = proveedores.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0)
  const trProvs = proveedores.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + Number(p.monto), 0)
  // Misma fórmula que cerrar_turno() y que "Efectivo en caja" en Hoy.jsx.
  const esperado = efectivoEsperado ?? (fondoInicial + (Number(ventas.efectivo) || 0) - efProvs)

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
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;">${escapeHtml(p.nombre)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(p.monto)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;color:#6b7280;font-size:12px;">${capitalizar(p.forma_pago)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin proveedores</td></tr>`

  let cuadreHtml = ''
  if (efectivoContado !== null && efectivoContado !== undefined) {
    const dif = Number(diferencia ?? (efectivoContado - esperado))
    const color = dif === 0 ? '#1E7A4F' : dif > 0 ? '#33518C' : '#b91c1c'
    const label = dif === 0 ? 'Cuadra exacto' : dif > 0 ? `Sobran ${clp(dif)}` : `Faltan ${clp(Math.abs(dif))}`
    cuadreHtml = `
      <p style="margin:6px 0 0;font-size:13px;color:#374151;">Contado: <strong>${clp(efectivoContado)}</strong> · <span style="color:${color};font-weight:700;">${label}</span></p>`
  } else {
    cuadreHtml = `<p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Se cerró sin contar la caja.</p>`
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">

    <!-- Header -->
    <div style="background:#5C3317;padding:24px 28px;">
      <p style="margin:0 0 4px;color:#F5EAD4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">FrytControl</p>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${escapeHtml(etiquetaTurno)} cerrado</h1>
      <p style="margin:6px 0 0;color:#e9d5b4;font-size:14px;text-transform:capitalize;">${fechaLegible(fecha)}</p>
    </div>

    <!-- Total destacado -->
    <div style="padding:20px 28px;background:#f9f5ed;border-bottom:1px solid #f0ebe3;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Total ventas</p>
      <p style="margin:0;font-size:32px;font-weight:800;color:#5C3317;">${clp(totalVentas)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Neto: <strong style="color:#374151;">${clp(totalVentas - efProvs - trProvs)}</strong> (ventas − proveedores)</p>
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

    <!-- Efectivo en caja -->
    <div style="margin:16px 28px;padding:16px;background:#EDFAF3;border-radius:12px;border-left:4px solid #1E7A4F;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;">Efectivo esperado en caja</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#1E7A4F;">${clp(esperado)}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Fondo ${clp(fondoInicial)} + ventas en efectivo − proveedores en efectivo</p>
      ${cuadreHtml}
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px 24px;border-top:1px solid #f0ebe3;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Registrado por <strong style="color:#374151;">${escapeHtml(registrador)}</strong>${cerradoPor && cerradoPor !== registrador ? ` · cerrado por <strong style="color:#374151;">${escapeHtml(cerradoPor)}</strong>` : ''}</p>
    </div>
  </div>
</body>
</html>`
}
