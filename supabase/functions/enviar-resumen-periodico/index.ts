import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verificarWebhook } from '../_shared/webhook.ts'
import type { Metodo } from '../_shared/correo/cierre.ts'
import { correoPeriodo, type Dia, type Totales, type TopProveedor } from '../_shared/correo/periodo.ts'
import { fechaChile, periodoAnteriorA, periodoPrevio, type TipoResumen } from '../_shared/correo/periodos.ts'
import { correosActivos, destinatarios, enviar, respuesta } from '../_shared/correo/envio.ts'

// Resúmenes diario, semanal y mensual. Los programa
// public.programar_resumenes() (cron cada hora, a la hora de Chile de
// configuracion.correos_hora, una vez por período) y los pide
// enviar_correo_prueba(). Body:
//   { tipo, desde?, hasta?, soloA? }
// Sin desde/hasta se usa el período cerrado más reciente en hora de
// Chile. Los números vienen de resumen_periodo(), igual que Análisis.

const TIPOS: TipoResumen[] = ['diario', 'semanal', 'mensual']
const FECHA = /^\d{4}-\d{2}-\d{2}$/

type Resumen = { desde: string; hasta: string; totales: Totales; dias: Dia[]; top_proveedores: TopProveedor[] }

Deno.serve(async (req) => {
  const rechazo = verificarWebhook(req)
  if (rechazo) return rechazo

  try {
    const body = await req.json() as { tipo?: TipoResumen; desde?: string; hasta?: string; soloA?: string }
    const tipo = body.tipo
    if (!tipo || !TIPOS.includes(tipo)) return respuesta({ error: 'tipo debe ser diario, semanal o mensual' }, 400)
    const soloA = typeof body.soloA === 'string' ? body.soloA : null
    const rango = body.desde && body.hasta && FECHA.test(body.desde) && FECHA.test(body.hasta)
      ? { desde: body.desde, hasta: body.hasta }
      : periodoAnteriorA(tipo, fechaChile())
    const previo = periodoPrevio(tipo, rango)

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    if (!soloA && !(await correosActivos(sb))) return respuesta({ ok: true, enviado: false, motivo: 'correos apagados' })

    const para = soloA ? [soloA] : await destinatarios(sb, tipo)
    if (para.length === 0) return respuesta({ ok: true, enviado: false, motivo: 'sin destinatarios' })

    const [actual, anterior, metodos] = await Promise.all([
      sb.rpc('resumen_periodo', { p_desde: rango.desde, p_hasta: rango.hasta }),
      sb.rpc('resumen_periodo', { p_desde: previo.desde, p_hasta: previo.hasta }),
      sb.from('metodos_pago').select('key, label, color, logo, orden'),
    ])
    if (actual.error || anterior.error) throw actual.error ?? anterior.error
    const r = actual.data as Resumen
    const a = anterior.data as Resumen

    // Un período sin ningún registro (el local cerrado) no amerita correo,
    // salvo que sea una prueba.
    if (!soloA && !r.totales.dias_con_registro) {
      return respuesta({ ok: true, enviado: false, motivo: 'sin registros en el período', ...rango })
    }

    const correo = correoPeriodo({
      tipo,
      desde: rango.desde,
      hasta: rango.hasta,
      totales: r.totales,
      anterior: a.totales.dias_con_registro ? a.totales : null,
      dias: r.dias,
      top: r.top_proveedores,
      metodos: (metodos.data ?? []) as Metodo[],
    })

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) return respuesta({ error: 'RESEND_API_KEY no configurado' }, 500)
    const envio = await enviar(correo, para, { apiKey, from: Deno.env.get('RESEND_FROM') ?? 'FrytControl <avisos@frytspa.cl>' })
    if ('error' in envio) {
      console.error('Resend:', envio.status, envio.error)
      return respuesta({ error: 'resend', detail: envio.error }, 502)
    }
    return respuesta({ ok: true, enviado: true, destinatarios: envio.enviados, ...rango })
  } catch (err) {
    console.error(err)
    return respuesta({ error: 'interno' }, 500)
  }
})
