import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Llamada vía Supabase Cron Job (o manualmente para pruebas)
// Body: { "tipo": "diario" } o { "tipo": "semanal" }

Deno.serve(async (req) => {
  try {
    const { tipo } = await req.json() as { tipo: 'diario' | 'semanal' }
    if (tipo !== 'diario' && tipo !== 'semanal') {
      return new Response(JSON.stringify({ error: 'tipo debe ser "diario" o "semanal"' }), { status: 400 })
    }

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

    // Calcular rango de fechas
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const desde = new Date(hoy)
    if (tipo === 'diario') {
      // Ayer (el cron corre a las 23:00 del día actual → cubre hoy)
      // En realidad queremos el día de hoy al momento de correr
    } else {
      // Semana anterior: lunes–domingo pasados
      const diaSemana = hoy.getDay() // 0=dom, 1=lun, ..., 6=sab
      const diasDesdeHoy = diaSemana === 0 ? 7 : diaSemana
      desde.setDate(hoy.getDate() - diasDesdeHoy)  // lunes anterior
    }

    const desdeStr = desde.toISOString().split('T')[0]
    const hastaStr = tipo === 'diario'
      ? hoy.toISOString().split('T')[0]
      : new Date(desde.getTime() + 6 * 86_400_000).toISOString().split('T')[0]

    // Consultar jornadas del período
    const { data: jornadas } = await supabase
      .from('jornadas')
      .select(`
        id, fecha,
        turnos(
          id, tipo,
          ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
          proveedores:proveedores_turno(nombre, monto, forma_pago)
        )
      `)
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha')

    // Consultar período anterior para comparativa
    const diffDias = tipo === 'diario' ? 1 : 7
    const desdeAntStr = new Date(new Date(desdeStr + 'T00:00:00').getTime() - diffDias * 86_400_000).toISOString().split('T')[0]
    const hastaAntStr = new Date(new Date(hastaStr + 'T00:00:00').getTime() - diffDias * 86_400_000).toISOString().split('T')[0]

    const { data: jornadasAnt } = await supabase
      .from('jornadas')
      .select(`
        id,
        turnos(
          ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)
        )
      `)
      .gte('fecha', desdeAntStr)
      .lte('fecha', hastaAntStr)

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

    const totales = calcularTotales(jornadas ?? [])
    const totalesAnt = calcularTotales(jornadasAnt ?? [])

    const html = buildEmailPeriodico({ tipo, desdeStr, hastaStr, jornadas: jornadas ?? [], totales, totalesAnt })
    const asunto = tipo === 'diario'
      ? `Resumen diario · ${fechaLegible(hastaStr)}`
      : `Resumen semanal · ${fechaCorta(desdeStr)} – ${fechaCorta(hastaStr)}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') ?? 'Fryt Planillas <onboarding@resend.dev>',
        to: destinatarios,
        subject: asunto,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response('error', { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
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

function pct(actual: number, anterior: number): string {
  if (anterior === 0) return actual > 0 ? '+∞%' : '—'
  const diff = ((actual - anterior) / anterior) * 100
  return (diff >= 0 ? '+' : '') + diff.toFixed(0) + '%'
}

function pctColor(actual: number, anterior: number): string {
  if (actual >= anterior) return '#1E7A4F'
  return '#b91c1c'
}

function fechaLegible(fecha: string): string {
  if (!fecha) return ''
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fechaCorta(fecha: string): string {
  if (!fecha) return ''
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit',
  })
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      color: '#1E7A4F' },
  { key: 'getnet',        label: 'Getnet',         color: '#33518C' },
  { key: 'mercadopago',   label: 'Mercado Pago',   color: '#00b1ea' },
  { key: 'edenred',       label: 'Edenred',        color: '#f59e0b' },
  { key: 'amipass',       label: 'Amipass',        color: '#a16207' },
  { key: 'transferencia', label: 'Transferencia',  color: '#5C3317' },
]

type VentaRow = Record<string, unknown>
type ProvRow = { nombre: string; monto: number; forma_pago: string }
type TurnoRow = { id: string; tipo: string; ventas: VentaRow[]; proveedores: ProvRow[] }
type JornadaRow = { id: string; fecha?: string; turnos: TurnoRow[] }

function calcularTotales(jornadas: JornadaRow[]) {
  const metodos: Record<string, number> = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }
  let efProv = 0, trProv = 0
  const contProv: Record<string, number> = {}

  for (const j of jornadas) {
    for (const t of j.turnos ?? []) {
      for (const v of t.ventas ?? []) {
        for (const m of METODOS) metodos[m.key] += Number(v[m.key]) || 0
      }
      for (const p of t.proveedores ?? []) {
        if (p.forma_pago === 'efectivo') efProv += Number(p.monto)
        else trProv += Number(p.monto)
        contProv[p.nombre] = (contProv[p.nombre] || 0) + Number(p.monto)
      }
    }
  }

  const totalVentas = Object.values(metodos).reduce((a, b) => a + b, 0)
  const topProv = Object.entries(contProv)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nombre, monto]) => ({ nombre, monto }))

  return { metodos, totalVentas, efProv, trProv, topProv }
}

interface EmailPeriodicoParams {
  tipo: 'diario' | 'semanal'
  desdeStr: string
  hastaStr: string
  jornadas: JornadaRow[]
  totales: ReturnType<typeof calcularTotales>
  totalesAnt: ReturnType<typeof calcularTotales>
}

function buildEmailPeriodico({ tipo, desdeStr, hastaStr, jornadas, totales, totalesAnt }: EmailPeriodicoParams): string {
  const titulo = tipo === 'diario' ? 'Resumen del día' : 'Resumen semanal'
  const subtitulo = tipo === 'diario'
    ? fechaLegible(hastaStr)
    : `${fechaCorta(desdeStr)} – ${fechaCorta(hastaStr)}`

  const varPct = pct(totales.totalVentas, totalesAnt.totalVentas)
  const varColor = pctColor(totales.totalVentas, totalesAnt.totalVentas)

  const ventasRows = METODOS
    .filter((m) => totales.metodos[m.key] > 0)
    .map((m) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${m.color};margin-right:8px;vertical-align:middle;"></span>${m.label}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(totales.metodos[m.key])}</td>
      </tr>`)
    .join('')

  const jornadasRows = jornadas.map((j) => {
    const turnos = j.turnos ?? []
    const totalDia = turnos.reduce((s, t) =>
      s + (t.ventas ?? []).reduce((sv, v) =>
        sv + METODOS.reduce((sm, m) => sm + (Number(v[m.key]) || 0), 0), 0), 0)
    const tipos = turnos.map((t) => capitalizar(t.tipo)).join(' + ')
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;">${fechaCorta(j.fecha ?? '')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;color:#6b7280;font-size:12px;">${tipos || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(totalDia)}</td>
      </tr>`
  }).join('')

  const topProvRows = totales.topProv.length > 0
    ? totales.topProv.map((p, i) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;color:#9ca3af;font-size:12px;">${i + 1}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;">${p.nombre}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(p.monto)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin proveedores</td></tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">

    <!-- Header -->
    <div style="background:#5C3317;padding:24px 28px;">
      <p style="margin:0 0 4px;color:#F5EAD4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Fryt Planillas</p>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${titulo}</h1>
      <p style="margin:6px 0 0;color:#e9d5b4;font-size:14px;text-transform:capitalize;">${subtitulo}</p>
    </div>

    <!-- KPIs destacados -->
    <div style="display:flex;gap:0;background:#f9f5ed;border-bottom:1px solid #f0ebe3;">
      <div style="flex:1;padding:18px 20px;border-right:1px solid #f0ebe3;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Total ventas</p>
        <p style="margin:0;font-size:26px;font-weight:800;color:#5C3317;">${clp(totales.totalVentas)}</p>
        <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:${varColor};">${varPct} vs. período anterior</p>
      </div>
      <div style="flex:1;padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Proveedores</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#374151;">${clp(totales.efProv + totales.trProv)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Ef: ${clp(totales.efProv)} · Tr: ${clp(totales.trProv)}</p>
      </div>
    </div>

    <!-- Ventas por método -->
    <div style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;">Ventas por método</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${ventasRows || '<tr><td colspan="2" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin ventas</td></tr>'}
        <tr style="background:#f9f5ed;">
          <td style="padding:10px 12px;font-weight:700;color:#111827;">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:800;color:#5C3317;">${clp(totales.totalVentas)}</td>
        </tr>
      </table>
    </div>

    ${tipo === 'semanal' ? `
    <!-- Detalle por jornada -->
    <div style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;">Jornadas de la semana</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${jornadasRows || '<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin jornadas</td></tr>'}
      </table>
    </div>
    ` : ''}

    <!-- Top proveedores -->
    <div style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;">Top proveedores</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${topProvRows}
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 28px 24px;margin-top:8px;border-top:1px solid #f0ebe3;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Enviado automáticamente por <strong style="color:#374151;">Fryt Planillas</strong></p>
    </div>
  </div>
</body>
</html>`
}
