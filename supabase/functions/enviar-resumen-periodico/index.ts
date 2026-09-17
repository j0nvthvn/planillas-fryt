import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarWebhook, fechaChile, sumarDias, diaSemana } from '../_shared/webhook.ts'

// Se invoca desde pg_cron vía public.enviar_resumen_periodico(tipo)
// (migración 20260915000200_correos_seguros.sql):
//   diario  → 12:00 UTC, resume el día ANTERIOR (ya cerrado la noche antes)
//   semanal → lunes 12:00 UTC, resume lunes–domingo anteriores
// Body: { "tipo": "diario" } | { "tipo": "semanal" }
//
// Todas las fechas se calculan en America/Santiago. Antes se usaba
// toISOString() (UTC): después de las 20-21 h en Chile ya era "mañana"
// y el resumen apuntaba al día equivocado.

Deno.serve(async (req) => {
  const rechazo = verificarWebhook(req)
  if (rechazo) return rechazo

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

    const { data: cfgRows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['notificaciones_activas', 'notificaciones_email_extra'])
    const cfg = Object.fromEntries((cfgRows ?? []).map((r: { clave: string; valor: unknown }) => [r.clave, r.valor]))
    if (cfg.notificaciones_activas === false) return new Response('ok', { status: 200 })

    // Rango del período, en fecha local de Chile.
    const hoy = fechaChile()
    let desdeStr: string
    let hastaStr: string
    if (tipo === 'diario') {
      desdeStr = hastaStr = sumarDias(hoy, -1)
    } else {
      // Lunes–domingo de la semana anterior a la de hoy.
      const dow = diaSemana(hoy)                 // 0 = domingo
      const lunesActual = sumarDias(hoy, -((dow + 6) % 7))
      desdeStr = sumarDias(lunesActual, -7)
      hastaStr = sumarDias(lunesActual, -1)
    }
    const diffDias = tipo === 'diario' ? 1 : 7
    const desdeAntStr = sumarDias(desdeStr, -diffDias)
    const hastaAntStr = sumarDias(hastaStr, -diffDias)

    const SELECT_JORNADAS = `
      id, fecha, es_turno_unico,
      turnos(
        id, tipo, is_draft, fondo_inicial, deleted_at,
        ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
        proveedores:proveedores_turno(nombre, monto, forma_pago)
      )
    `

    const [{ data: jornadas }, { data: jornadasAnt }] = await Promise.all([
      supabase.from('jornadas').select(SELECT_JORNADAS)
        .is('turnos.deleted_at', null)
        .gte('fecha', desdeStr).lte('fecha', hastaStr).order('fecha'),
      supabase.from('jornadas').select(SELECT_JORNADAS)
        .is('turnos.deleted_at', null)
        .gte('fecha', desdeAntStr).lte('fecha', hastaAntStr),
    ])

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

    // supabase-js infiere ventas_turno como arreglo a partir del string de
    // select (no conoce el UNIQUE turno_id), pero en runtime PostgREST la
    // embebe como objeto — JornadaRow ya refleja la forma real.
    const lista = (jornadas ?? []) as unknown as JornadaRow[]
    const listaAnt = (jornadasAnt ?? []) as unknown as JornadaRow[]
    const totales = calcularTotales(lista)
    const totalesAnt = calcularTotales(listaAnt)

    // Sin actividad en el período: no vale la pena un correo vacío
    // (por ejemplo, el resumen diario de un día que el local no abrió).
    if (lista.every((j) => (j.turnos ?? []).length === 0)) {
      return new Response(JSON.stringify({ ok: true, enviado: false, motivo: 'sin turnos en el período' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    // La narrativa es un extra: si falla (sin API key, rate limit, timeout,
    // etc.) el correo se manda igual solo con los números — nunca debe
    // bloquear el envío.
    const resumenIA = await generarResumenIA({ tipo, totales, totalesAnt }).catch((err) => {
      console.error('generarResumenIA falló:', err)
      return null
    })

    const html = buildEmailPeriodico({ tipo, desdeStr, hastaStr, jornadas: lista, totales, totalesAnt, resumenIA })
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
        from: Deno.env.get('RESEND_FROM') ?? 'FrytControl <onboarding@resend.dev>',
        to: destinatarios,
        subject: asunto,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: 'resend', detail: err }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, enviado: true, desde: desdeStr, hasta: hastaStr }), {
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
  if (anterior === 0) return actual > 0 ? 'sin comparación' : '—'
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      color: '#047857' },
  { key: 'getnet',        label: 'Getnet',         color: '#7C3AED' },
  { key: 'mercadopago',   label: 'Mercado Pago',   color: '#00b1ea' },
  { key: 'edenred',       label: 'Edenred',        color: '#f59e0b' },
  { key: 'amipass',       label: 'Amipass',        color: '#a16207' },
  { key: 'transferencia', label: 'Transferencia',  color: '#4F46E5' },
]

type VentaRow = Record<string, unknown>
type ProvRow = { nombre: string; monto: number; forma_pago: string }
// ventas_turno tiene turno_id UNIQUE (una fila por turno) — PostgREST la
// embebe como objeto, no como arreglo (a diferencia de proveedores_turno,
// que sí es 1:muchos).
type TurnoRow = {
  id: string
  tipo: string
  is_draft: boolean
  fondo_inicial: number | null
  ventas: VentaRow | null
  proveedores: ProvRow[]
}
type JornadaRow = { id: string; fecha?: string; es_turno_unico?: boolean; turnos: TurnoRow[] }

function ventasTurno(t: TurnoRow): number {
  if (!t.ventas) return 0
  return METODOS.reduce((s, m) => s + (Number(t.ventas![m.key]) || 0), 0)
}

function calcularTotales(jornadas: JornadaRow[]) {
  const metodos: Record<string, number> = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }
  let efProv = 0, trProv = 0
  // "Caja": fondo + ventas en efectivo − proveedores en efectivo, sumado
  // por turno — la misma fórmula que cerrar_turno() y Hoy.jsx.
  let caja = 0
  let borradores = 0
  const contProv: Record<string, number> = {}

  for (const j of jornadas) {
    for (const t of j.turnos ?? []) {
      if (t.is_draft) borradores += 1
      let efProvTurno = 0
      if (t.ventas) {
        for (const m of METODOS) metodos[m.key] += Number(t.ventas[m.key]) || 0
      }
      for (const p of t.proveedores ?? []) {
        if (p.forma_pago === 'efectivo') { efProv += Number(p.monto); efProvTurno += Number(p.monto) }
        else trProv += Number(p.monto)
        contProv[p.nombre] = (contProv[p.nombre] || 0) + Number(p.monto)
      }
      caja += (Number(t.fondo_inicial) || 0) + (Number(t.ventas?.efectivo) || 0) - efProvTurno
    }
  }

  const totalVentas = Object.values(metodos).reduce((a, b) => a + b, 0)
  const topProv = Object.entries(contProv)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nombre, monto]) => ({ nombre, monto }))

  return { metodos, totalVentas, efProv, trProv, caja, borradores, topProv }
}

// ── Resumen narrativo (IA) ────────────────────────────────
//
// Le pasamos a Claude exactamente los mismos números que ya calculó
// calcularTotales() — nunca le damos acceso a la base de datos ni le
// pedimos que calcule nada, solo que redacte 2-3 frases a partir de
// cifras que ya están correctas. Así el peor caso posible es una
// redacción sosa, nunca un número inventado.
async function generarResumenIA(
  { tipo, totales, totalesAnt }: { tipo: 'diario' | 'semanal'; totales: ReturnType<typeof calcularTotales>; totalesAnt: ReturnType<typeof calcularTotales> },
): Promise<string | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return null

  const provTotal = totales.efProv + totales.trProv
  const provTotalAnt = totalesAnt.efProv + totalesAnt.trProv
  const hayAnterior = totalesAnt.totalVentas > 0 || provTotalAnt > 0

  const hechos = [
    `Ventas totales del período: ${clp(totales.totalVentas)}.`,
    hayAnterior ? `Ventas del período anterior (mismo largo, inmediatamente antes): ${clp(totalesAnt.totalVentas)}.` : null,
    `Pagos a proveedores del período: ${clp(provTotal)} (efectivo: ${clp(totales.efProv)}, transferencia: ${clp(totales.trProv)}).`,
    hayAnterior ? `Pagos a proveedores del período anterior: ${clp(provTotalAnt)}.` : null,
    totales.topProv.length > 0
      ? `Proveedor con mayor gasto: ${totales.topProv[0].nombre} (${clp(totales.topProv[0].monto)}).`
      : 'Sin pagos a proveedores en el período.',
    ...METODOS.filter((m) => totales.metodos[m.key] > 0)
      .map((m) => `${m.label}: ${clp(totales.metodos[m.key])}.`),
  ].filter(Boolean).join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'Eres un asistente que redacta resúmenes breves para el dueño de un minimarket chileno, a partir de datos de ventas y proveedores. ' +
          'Usa ÚNICAMENTE los números que se te entregan — nunca inventes cifras, nombres ni datos que no aparezcan en el mensaje. ' +
          'Responde con un máximo de 3 frases cortas, en español de Chile, tono cercano y directo (como para leer en 5 segundos). ' +
          'Sin saludos, sin emojis, sin markdown, sin repetir literalmente "el período". Destaca lo más relevante: la variación más grande (para arriba o para abajo) o el proveedor más caro. ' +
          'Si no hay datos de un período anterior para comparar, no menciones comparación.',
        messages: [{ role: 'user', content: `Tipo de resumen: ${tipo === 'diario' ? 'diario' : 'semanal'}.\n\n${hechos}` }],
      }),
    })
    if (!res.ok) {
      console.error('Anthropic API error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const texto = data?.content?.[0]?.text?.trim()
    return texto || null
  } catch (err) {
    console.error('generarResumenIA fetch falló:', err)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

interface EmailPeriodicoParams {
  tipo: 'diario' | 'semanal'
  desdeStr: string
  hastaStr: string
  jornadas: JornadaRow[]
  totales: ReturnType<typeof calcularTotales>
  totalesAnt: ReturnType<typeof calcularTotales>
  resumenIA: string | null
}

function buildEmailPeriodico({ tipo, desdeStr, hastaStr, jornadas, totales, totalesAnt, resumenIA }: EmailPeriodicoParams): string {
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
    const totalDia = turnos.reduce((s, t) => s + ventasTurno(t), 0)
    const tipos = j.es_turno_unico
      ? 'Día completo'
      : turnos.map((t) => capitalizar(t.tipo)).join(' + ')
    const borrador = turnos.some((t) => t.is_draft)
      ? ' <span style="color:#b45309;font-weight:700;">· borrador</span>'
      : ''
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;">${fechaCorta(j.fecha ?? '')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;color:#6b7280;font-size:12px;">${tipos || '—'}${borrador}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(totalDia)}</td>
      </tr>`
  }).join('')

  const topProvRows = totales.topProv.length > 0
    ? totales.topProv.map((p, i) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;color:#9ca3af;font-size:12px;">${i + 1}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;">${escapeHtml(p.nombre)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">${clp(p.monto)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px 12px;color:#9ca3af;font-style:italic;">Sin proveedores</td></tr>`

  const avisoBorradores = totales.borradores > 0 ? `
    <div style="margin:16px 28px 0;padding:12px 16px;background:#FDF1DD;border-radius:12px;border-left:4px solid #b45309;">
      <p style="margin:0;font-size:13px;color:#7c3f0a;"><strong>${totales.borradores === 1 ? 'Hay 1 turno sin cerrar' : `Hay ${totales.borradores} turnos sin cerrar`}</strong> en este período. Los montos de abajo los incluyen, pero pueden cambiar hasta que se cierren.</p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07);">

    <!-- Header -->
    <div style="background:#5C3317;padding:24px 28px;">
      <p style="margin:0 0 4px;color:#F5EAD4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">FrytControl</p>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${titulo}</h1>
      <p style="margin:6px 0 0;color:#e9d5b4;font-size:14px;text-transform:capitalize;">${subtitulo}</p>
    </div>

    ${resumenIA ? `
    <!-- Resumen narrativo (IA) -->
    <div style="padding:18px 28px;background:#FBF6EC;border-bottom:1px solid #f0ebe3;">
      <p style="margin:0;font-size:14px;line-height:1.55;color:#3f2c17;">${escapeHtml(resumenIA)}</p>
    </div>
    ` : ''}

    ${avisoBorradores}

    <!-- KPIs destacados -->
    <div style="display:flex;gap:0;background:#f9f5ed;border-bottom:1px solid #f0ebe3;">
      <div style="flex:1;padding:18px 20px;border-right:1px solid #f0ebe3;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Total ventas</p>
        <p style="margin:0;font-size:26px;font-weight:800;color:#5C3317;">${clp(totales.totalVentas)}</p>
        <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:${varColor};">${varPct} vs. período anterior</p>
      </div>
      <div style="flex:1;padding:18px 20px;border-right:1px solid #f0ebe3;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Proveedores</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#374151;">${clp(totales.efProv + totales.trProv)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Ef: ${clp(totales.efProv)} · Tr: ${clp(totales.trProv)}</p>
      </div>
      <div style="flex:1;padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Caja</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#1E7A4F;">${clp(totales.caja)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Fondo + efectivo − prov. efectivo</p>
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
      <p style="margin:0;font-size:12px;color:#9ca3af;">Enviado automáticamente por <strong style="color:#374151;">FrytControl</strong></p>
    </div>
  </div>
</body>
</html>`
}
