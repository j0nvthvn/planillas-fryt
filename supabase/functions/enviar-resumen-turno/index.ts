import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarWebhook } from '../_shared/webhook.ts'
import { correoCierre, type Metodo } from '../_shared/correo/cierre.ts'
import { correosActivos, destinatarios, enviar, respuesta } from '../_shared/correo/envio.ts'

// Correo "turno cerrado". Lo invoca el trigger notificar_cierre (AFTER
// INSERT en turno_cierres, solo cierres originales) y la RPC
// enviar_correo_prueba (con `soloA`). Payload:
//   { type: 'INSERT', table: 'turno_cierres', record: {...}, soloA?: string }
// Usa la fotografía del cierre (ventas_snapshot, proveedores_snapshot,
// efectivo_*), que es exactamente lo que quedó registrado.

type Cierre = {
  turno_id: string
  cerrado_en: string
  ventas_snapshot: Record<string, unknown> | null
  proveedores_snapshot: Array<{ nombre: string; monto: number; forma_pago: string }> | null
  es_correccion: boolean
  efectivo_esperado: number | null
  efectivo_contado: number | null
  diferencia_efectivo: number | null
}

const horaChile = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

Deno.serve(async (req) => {
  const rechazo = verificarWebhook(req)
  if (rechazo) return rechazo

  try {
    const payload = await req.json()
    const cierre = payload?.record as Cierre | undefined
    const soloA = typeof payload?.soloA === 'string' ? payload.soloA : null
    if (payload?.type !== 'INSERT' || !cierre?.turno_id || (cierre.es_correccion && !soloA)) {
      return respuesta({ ok: true, enviado: false, motivo: 'no es un cierre original' })
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    if (!soloA && !(await correosActivos(sb))) return respuesta({ ok: true, enviado: false, motivo: 'correos apagados' })

    const para = soloA ? [soloA] : await destinatarios(sb, 'cierre')
    if (para.length === 0) return respuesta({ ok: true, enviado: false, motivo: 'sin destinatarios' })

    const [{ data: turno, error: errTurno }, { data: metodos }, { data: catalogo }] = await Promise.all([
      sb.from('turnos')
        .select('tipo, fondo_inicial, jornada:jornadas(fecha, es_turno_unico), trabajador:trabajadores(nombre)')
        .eq('id', cierre.turno_id).maybeSingle(),
      sb.from('metodos_pago').select('key, label, color, logo, orden'),
      sb.from('proveedores_frecuentes').select('nombre, imagen_url').not('imagen_url', 'is', null),
    ])
    if (errTurno || !turno) {
      console.error('No se pudo cargar el turno del cierre:', errTurno)
      return respuesta({ error: 'turno no encontrado' }, 500)
    }
    const jornada = turno.jornada as unknown as { fecha: string; es_turno_unico: boolean }
    const trabajador = turno.trabajador as unknown as { nombre: string } | null
    const logos = new Map((catalogo ?? []).map((p: { nombre: string; imagen_url: string }) => [p.nombre.toLowerCase(), p.imagen_url]))
    const proveedores = (cierre.proveedores_snapshot ?? []).map((p) => ({ ...p, imagen_url: logos.get(p.nombre.toLowerCase()) ?? null }))
    const ventas = cierre.ventas_snapshot ?? {}
    const fondo = Number(turno.fondo_inicial) || 0
    const provEf = proveedores.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0)

    const correo = correoCierre({
      fecha: jornada.fecha,
      etiqueta: jornada.es_turno_unico ? 'Día completo' : `Turno ${turno.tipo}`,
      hora: horaChile.format(new Date(cierre.cerrado_en)),
      metodos: (metodos ?? []) as Metodo[],
      ventas,
      proveedores,
      atendio: trabajador?.nombre ?? null,
      cerradoPor: null,
      fondo,
      esperado: cierre.efectivo_esperado ?? fondo + (Number(ventas.efectivo) || 0) - provEf,
      contado: cierre.efectivo_contado,
      diferencia: cierre.diferencia_efectivo,
    })

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) return respuesta({ error: 'RESEND_API_KEY no configurado' }, 500)
    const r = await enviar(correo, para, { apiKey, from: Deno.env.get('RESEND_FROM') ?? 'FrytControl <avisos@frytspa.cl>' })
    if ('error' in r) {
      console.error('Resend:', r.status, r.error)
      // 502 y no 200: el fallo queda visible en net._http_response.
      return respuesta({ error: 'resend', detail: r.error }, 502)
    }
    return respuesta({ ok: true, enviado: true, destinatarios: r.enviados })
  } catch (err) {
    console.error(err)
    return respuesta({ error: 'interno' }, 500)
  }
})
