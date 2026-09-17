// Resúmenes diario, semanal y mensual. Los números vienen de
// resumen_periodo() (la misma fuente que Análisis en la app); acá solo se
// presentan.

import type { Correo, Metodo } from './cierre.ts'
import { clp, escapeHtml, fechaDia, fechaDiaMes, fechaLarga, mesAnio, participacion, rango, variacion } from './formato.ts'
import { APP_URL, T, aviso, barra, boton, documento, filaKpis, fila, heroe, icono, lista, pildora, seccion, tarjeta, type Tono } from './layout.ts'
import { diaSemana, sumarDias, type TipoResumen } from './periodos.ts'

export type Totales = {
  total_ventas: number
  total_proveedores: number
  prov_efectivo?: number
  prov_transferencia?: number
  neto: number
  efectivo_neto: number
  dias_con_registro: number
  dias_con_borrador?: number
  dias_cerrados?: number
  [metodo: string]: number | undefined
}

export type Dia = {
  fecha: string
  turnos: number
  total_ventas: number
  total_proveedores: number
  neto: number
  estado: string
  corregido: boolean
  con_descuadre: boolean
  tiene_borrador: boolean
  /** El local no abrió ese día. En el correo se dice "No abrió". */
  cerrado?: boolean
  motivo_cierre?: string | null
}

export type TopProveedor = { nombre: string; monto: number; compras: number; imagen_url: string | null }

export type DatosPeriodo = {
  tipo: TipoResumen
  desde: string
  hasta: string
  totales: Totales
  /** Período calendario anterior del mismo tipo (null si no hubo registros). */
  anterior: Totales | null
  dias: Dia[]
  top: TopProveedor[]
  metodos: Metodo[]
}

const NOMBRE: Record<TipoResumen, { tipo: string; previo: string }> = {
  diario: { tipo: 'Resumen diario', previo: 'el día anterior' },
  semanal: { tipo: 'Resumen semanal', previo: 'la semana anterior' },
  mensual: { tipo: 'Resumen mensual', previo: 'el mes anterior' },
}

function titulo(d: DatosPeriodo): string {
  if (d.tipo === 'diario') return fechaLarga(d.desde)
  if (d.tipo === 'semanal') return `Semana del ${rango(d.desde, d.hasta)}`
  return mesAnio(d.desde)
}

function cambio(actual: number, anterior: number | undefined, { subirEsBueno = true } = {}): { texto: string; tono: Tono } | null {
  if (anterior === undefined) return null
  const v = variacion(actual, anterior)
  if (v === null) return null
  if (v === 0) return { texto: 'Igual', tono: 'neutro' }
  const bueno = (v > 0) === subirEsBueno
  return { texto: `${v > 0 ? '▲' : '▼'} ${Math.abs(v)} %`, tono: subirEsBueno ? (bueno ? 'pos' : 'neg') : 'neutro' }
}

function pildorasDia(d: Dia): string {
  // Un día sin abrir no tiene nada más que decir.
  if (d.cerrado) return pildora('No abrió', 'neutro')
  const p: string[] = []
  if (d.tiene_borrador) p.push(pildora('Sin cerrar', 'warn'))
  if (d.con_descuadre) p.push(pildora('Descuadre', 'neg'))
  if (d.corregido) p.push(pildora('Corregido', 'brand'))
  return p.join(' ')
}

/** Semanas (lunes a domingo) dentro del mes, para el mensual. */
function porSemana(dias: Dia[]): { desde: string; hasta: string; ventas: number; prov: number; neto: number; conRegistro: number; sinAbrir: number; alerta: boolean }[] {
  const grupos = new Map<string, ReturnType<typeof porSemana>[number]>()
  for (const d of dias) {
    const lunes = sumarDias(d.fecha, -((diaSemana(d.fecha) + 6) % 7))
    const g = grupos.get(lunes) ?? { desde: d.fecha, hasta: d.fecha, ventas: 0, prov: 0, neto: 0, conRegistro: 0, sinAbrir: 0, alerta: false }
    g.hasta = d.fecha
    g.ventas += Number(d.total_ventas)
    g.prov += Number(d.total_proveedores)
    g.neto += Number(d.neto)
    if (d.turnos > 0) g.conRegistro += 1
    if (d.cerrado) g.sinAbrir += 1
    if (d.tiene_borrador || d.con_descuadre) g.alerta = true
    grupos.set(lunes, g)
  }
  return [...grupos.values()]
}

/** Todos los días del rango; los que no tienen jornada van en cero. */
export function completarDias(desde: string, hasta: string, dias: Dia[]): Dia[] {
  const porFecha = new Map(dias.map((x) => [x.fecha, x]))
  const todos: Dia[] = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    // Ojo: el relleno es 'sin_registro', nunca 'cerrado'. Un día sin
    // jornada es un día que nadie registró; que el local no abriera es
    // algo que alguien tuvo que marcar.
    todos.push(porFecha.get(f) ?? { fecha: f, turnos: 0, total_ventas: 0, total_proveedores: 0, neto: 0, estado: 'sin_registro', corregido: false, con_descuadre: false, tiene_borrador: false, cerrado: false, motivo_cierre: null })
  }
  return todos
}

export function correoPeriodo(entrada: DatosPeriodo): Correo {
  const d = { ...entrada, dias: completarDias(entrada.desde, entrada.hasta, entrada.dias) }
  const n = NOMBRE[d.tipo]
  const t = d.totales
  const a = d.anterior ?? undefined
  const ventas = Number(t.total_ventas)
  const prov = Number(t.total_proveedores)
  const neto = Number(t.neto)
  const conRegistro = d.dias.filter((x) => x.turnos > 0)
  const sinAbrir = d.dias.filter((x) => x.cerrado)
  // Ni turnos ni marca: o se olvidó registrar, o el local no abrió y falta
  // decirlo. Hasta ahora estos días no aparecían en ninguna parte.
  const sinRegistrar = d.dias.filter((x) => x.turnos === 0 && !x.cerrado)
  const cNeto = cambio(neto, a && Number(a.neto))
  const cVentas = cambio(ventas, a && Number(a.total_ventas))
  const cProv = cambio(prov, a && Number(a.total_proveedores), { subirEsBueno: false })
  const enlace = d.tipo === 'diario' ? `${APP_URL}/dia?fecha=${d.desde}` : `${APP_URL}/analisis?desde=${d.desde}&hasta=${d.hasta}`
  const totalDias = d.dias.length - sinAbrir.length

  const detalleHeroe = [
    cNeto ? `${pildora(cNeto.texto, cNeto.tono)} <span style="font-size:13px;color:${T.muted};">vs. ${n.previo}</span>` : '',
    d.tipo !== 'diario' ? `<br><span style="display:inline-block;margin-top:8px;font-size:13px;color:${T.muted};">${conRegistro.length} de ${totalDias} días con registro${sinAbrir.length ? ` · ${sinAbrir.length} sin abrir` : ''}</span>` : '',
  ].join('')

  const principal = tarjeta(`
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${T.ink};">${escapeHtml(titulo(d))}</p>
${heroe({ etiqueta: 'Neto', valor: clp(neto), color: neto < 0 ? T.neg : T.ink, detalle: detalleHeroe })}
${filaKpis([
    { etiqueta: 'Ventas', valor: clp(ventas), nota: cVentas ? `${cVentas.texto} vs. ${n.previo.replace(/^el |^la /, '')}` : undefined },
    { etiqueta: 'Proveedores', valor: clp(prov), nota: cProv ? `${cProv.texto} vs. ${n.previo.replace(/^el |^la /, '')}` : undefined },
    { etiqueta: 'Efectivo neto', valor: clp(t.efectivo_neto), nota: 'Ventas − proveedores, en efectivo' },
  ])}
${boton(d.tipo === 'diario' ? 'Ver la planilla del día' : 'Ver el análisis', enlace)}`)

  const pendientes = d.dias.filter((x) => x.tiene_borrador)
  const alertas = [
    pendientes.length
      ? aviso(`<strong>${pendientes.length === 1 ? 'Hay un día sin cerrar' : `Hay ${pendientes.length} días sin cerrar`}</strong> (${pendientes.map((x) => escapeHtml(fechaDiaMes(x.fecha))).join(', ')}). Sus montos están incluidos, pero pueden cambiar al cerrarlos.`)
      : '',
    // En el diario no aporta: si no hubo registros, el correo ni se envía.
    d.tipo !== 'diario' && sinRegistrar.length
      ? aviso(`<strong>${sinRegistrar.length === 1 ? 'Hay un día sin registrar' : `Hay ${sinRegistrar.length} días sin registrar`}</strong> (${sinRegistrar.slice(0, 6).map((x) => escapeHtml(fechaDiaMes(x.fecha))).join(', ')}${sinRegistrar.length > 6 ? '…' : ''}). Si el local no abrió, márcalos en la app para que no queden como olvidos.`, 'neutro')
      : '',
  ].join('')

  // Mejor y peor día (semanal y mensual).
  let destacados = ''
  if (d.tipo !== 'diario' && conRegistro.length >= 2) {
    const orden = [...conRegistro].sort((x, y) => Number(y.neto) - Number(x.neto))
    const mejor = orden[0]!
    const peor = orden[orden.length - 1]!
    destacados = seccion('Destacados', lista([
      fila({ titulo: 'Mejor día', sub: fechaLarga(mejor.fecha), monto: clp(mejor.neto), montoColor: T.pos }),
      fila({ titulo: 'Día más bajo', sub: fechaLarga(peor.fecha), monto: clp(peor.neto), montoColor: Number(peor.neto) < 0 ? T.neg : T.ink, ultima: true }),
    ]), { sinPadding: true })
  }

  // Detalle: días (semanal) o semanas (mensual).
  let detalle = ''
  if (d.tipo === 'semanal') {
    detalle = seccion('Día a día', lista(d.dias.map((x, i) => fila({
      titulo: fechaDia(x.fecha),
      sub: x.turnos
        ? `Ventas ${clp(x.total_ventas)} · Prov. ${clp(x.total_proveedores)}`
        : x.cerrado
          ? `No abrió${x.motivo_cierre ? ` · ${x.motivo_cierre}` : ''}`  // fila() escapa el sub
          : 'Sin registro',
      monto: x.turnos ? clp(x.neto) : '—',
      montoColor: Number(x.neto) < 0 ? T.neg : x.turnos ? T.ink : T.muted,
      extra: pildorasDia(x),
      ultima: i === d.dias.length - 1,
    }))), { sinPadding: true })
  } else if (d.tipo === 'mensual') {
    const semanas = porSemana(d.dias)
    detalle = seccion('Semana a semana', lista(semanas.map((s, i) => fila({
      titulo: rango(s.desde, s.hasta),
      sub: `Ventas ${clp(s.ventas)} · Prov. ${clp(s.prov)} · ${s.conRegistro} día${s.conRegistro === 1 ? '' : 's'}${s.sinAbrir ? ` · ${s.sinAbrir} sin abrir` : ''}`,
      monto: clp(s.neto),
      montoColor: s.neto < 0 ? T.neg : T.ink,
      extra: s.alerta ? pildora('Revisar', 'warn') : '',
      ultima: i === semanas.length - 1,
    }))), { sinPadding: true })
  }

  // Métodos de pago.
  const metodos = [...d.metodos].sort((x, y) => x.orden - y.orden)
    .map((m) => ({ m, monto: Number(t[m.key]) || 0 }))
    .filter((x) => x.monto !== 0)
  const bloqueMetodos = seccion('Ventas por método', metodos.length
    ? lista(metodos.map((x, i) => fila({
      icono: icono({ src: x.m.logo, texto: x.m.label, color: x.m.color }),
      titulo: x.m.label,
      sub: participacion(x.monto, ventas),
      monto: clp(x.monto),
      debajo: barra(ventas ? (x.monto / ventas) * 100 : 0, x.m.color),
      ultima: i === metodos.length - 1,
    })))
    : `<p class="pad" style="margin:0;padding:0 22px 12px;font-size:14px;color:${T.muted};">Sin ventas.</p>`, { sinPadding: true })

  const bloqueTop = d.top.length
    ? seccion(`Proveedores · ${clp(prov)}`, lista(d.top.map((p, i) => fila({
      icono: icono({ src: p.imagen_url, texto: p.nombre, color: '#475569' }),
      titulo: p.nombre,
      sub: `${p.compras} compra${p.compras === 1 ? '' : 's'}`,
      monto: clp(p.monto),
      ultima: i === d.top.length - 1,
    }))) + (t.prov_efectivo !== undefined
      ? `<p class="pad" style="margin:0;padding:8px 22px 12px;font-size:12px;color:${T.muted};">En efectivo ${clp(t.prov_efectivo)} · por transferencia ${clp(t.prov_transferencia ?? 0)}${d.top.length === 5 ? ' · los 5 con más gasto' : ''}</p>`
      : ''), { sinPadding: true })
    : ''

  const nombreAsunto = d.tipo === 'diario' ? fechaDiaMes(d.desde) : d.tipo === 'semanal' ? rango(d.desde, d.hasta) : mesAnio(d.desde)
  const asunto = `${n.tipo} · ${nombreAsunto} · Neto ${clp(neto)}`
  const html = documento({
    asunto,
    preencabezado: `Ventas ${clp(ventas)} · Proveedores ${clp(prov)}${cNeto ? ` · Neto ${cNeto.texto} vs. ${n.previo}` : ''}`,
    tipo: n.tipo,
    cuerpo: principal + alertas + destacados + detalle + bloqueMetodos + bloqueTop,
  })

  const texto = [
    `${n.tipo} — ${titulo(d)}`,
    '',
    `Neto: ${clp(neto)}${cNeto ? ` (${cNeto.texto} vs. ${n.previo})` : ''}`,
    `Ventas: ${clp(ventas)}`,
    `Proveedores: ${clp(prov)}`,
    `Efectivo neto: ${clp(t.efectivo_neto)}`,
    pendientes.length ? `Días sin cerrar: ${pendientes.map((x) => fechaDiaMes(x.fecha)).join(', ')}` : null,
    sinAbrir.length ? `Días en que el local no abrió: ${sinAbrir.map((x) => fechaDiaMes(x.fecha)).join(', ')}` : null,
    d.tipo !== 'diario' && sinRegistrar.length ? `Días sin registrar: ${sinRegistrar.map((x) => fechaDiaMes(x.fecha)).join(', ')}` : null,
    '',
    ...metodos.map((x) => `${x.m.label}: ${clp(x.monto)}`),
    '',
    ...d.top.map((p) => `${p.nombre}: ${clp(p.monto)}`),
    '',
    `Ver en FrytControl: ${enlace}`,
    `Elegir qué correos recibo: ${APP_URL}/ajustes?seccion=correos`,
  ].filter((l) => l !== null).join('\n')

  return { asunto, html, texto }
}
