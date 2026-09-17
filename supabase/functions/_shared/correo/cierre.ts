// Correo "turno cerrado": la fotografía del cierre (turno_cierres).

import { clp, clpSigno, escapeHtml, fechaLarga, fechaDiaMes, participacion } from './formato.ts'
import { APP_URL, T, aviso, barra, boton, documento, filaKpis, fila, heroe, icono, lista, pildora, seccion, tarjeta, type Tono } from './layout.ts'

export type Metodo = { key: string; label: string; color: string; logo: string | null; orden: number }
export type PagoProveedor = { nombre: string; monto: number; forma_pago: string; imagen_url?: string | null }

export type DatosCierre = {
  fecha: string
  /** "Día completo", "Turno mañana"… */
  etiqueta: string
  hora: string | null
  metodos: Metodo[]
  ventas: Record<string, unknown>
  proveedores: PagoProveedor[]
  atendio: string | null
  cerradoPor: string | null
  fondo: number
  esperado: number
  contado: number | null
  diferencia: number | null
}

export type Correo = { asunto: string; html: string; texto: string }

export function estadoCaja(contado: number | null, diferencia: number | null): { texto: string; tono: Tono } {
  if (contado === null || contado === undefined) return { texto: 'Caja sin contar', tono: 'neutro' }
  const d = Number(diferencia) || 0
  if (d === 0) return { texto: 'Cuadra exacto', tono: 'pos' }
  return d > 0 ? { texto: `Sobran ${clp(d)}`, tono: 'warn' } : { texto: `Faltan ${clp(-d)}`, tono: 'neg' }
}

export function correoCierre(d: DatosCierre): Correo {
  const metodos = [...d.metodos].sort((a, b) => a.orden - b.orden)
  const montos = metodos.map((m) => ({ m, monto: Number(d.ventas[m.key]) || 0 })).filter((x) => x.monto !== 0)
  const ventas = montos.reduce((s, x) => s + x.monto, 0)
  const provEf = d.proveedores.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + Number(p.monto), 0)
  const provTr = d.proveedores.reduce((s, p) => s + Number(p.monto), 0) - provEf
  const prov = provEf + provTr
  const neto = ventas - prov
  const caja = estadoCaja(d.contado, d.diferencia)
  const cuando = [fechaLarga(d.fecha), d.hora].filter(Boolean).join(' · ')

  const principal = tarjeta(`
<p style="margin:0;font-size:15px;font-weight:600;color:${T.ink};">${escapeHtml(d.etiqueta)} cerrado</p>
<p style="margin:2px 0 16px;font-size:13px;color:${T.muted};">${escapeHtml(cuando)}${d.atendio ? ` · atendió ${escapeHtml(d.atendio)}` : ''}</p>
${heroe({ etiqueta: 'Neto', valor: clp(neto), color: neto < 0 ? T.neg : T.ink, detalle: pildora(caja.texto, caja.tono) })}
${filaKpis([
    { etiqueta: 'Ventas', valor: clp(ventas) },
    { etiqueta: 'Proveedores', valor: clp(prov) },
    { etiqueta: 'Efectivo esperado', valor: clp(d.esperado) },
  ])}
${boton('Ver la planilla del día', `${APP_URL}/dia?fecha=${d.fecha}`)}`)

  const filasVentas = montos.map((x, i) => fila({
    icono: icono({ src: x.m.logo, texto: x.m.label, color: x.m.color }),
    titulo: x.m.label,
    sub: participacion(x.monto, ventas),
    monto: clp(x.monto),
    debajo: barra(ventas ? (x.monto / ventas) * 100 : 0, x.m.color),
    ultima: i === montos.length - 1,
  }))
  const bloqueVentas = seccion('Ventas por método', montos.length
    ? lista(filasVentas)
    : `<p class="pad" style="margin:0;padding:0 22px 12px;font-size:14px;color:${T.muted};">Sin ventas registradas.</p>`, { sinPadding: true })

  const proveedores = [...d.proveedores].sort((a, b) => Number(b.monto) - Number(a.monto))
  const filasProv = proveedores.map((p, i) => fila({
    icono: icono({ src: p.imagen_url, texto: p.nombre, color: '#475569' }),
    titulo: p.nombre,
    sub: p.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia',
    monto: clp(p.monto),
    ultima: i === proveedores.length - 1,
  }))
  const bloqueProv = d.proveedores.length
    ? seccion(`Proveedores · ${clp(prov)}`, lista(filasProv) + `<p class="pad" style="margin:0;padding:8px 22px 12px;font-size:12px;color:${T.muted};">En efectivo ${clp(provEf)} · por transferencia ${clp(provTr)}</p>`, { sinPadding: true })
    : ''

  const filasCaja = [
    fila({ titulo: 'Fondo inicial', monto: clp(d.fondo) }),
    fila({ titulo: 'Ventas en efectivo', monto: clp(Number(d.ventas.efectivo) || 0) }),
    fila({ titulo: 'Proveedores en efectivo', monto: provEf ? `−${clp(provEf)}` : clp(0) }),
    fila({ titulo: 'Efectivo esperado', monto: clp(d.esperado), ultima: d.contado === null }),
    ...(d.contado !== null
      ? [fila({ titulo: 'Contado', monto: clp(d.contado) }),
         fila({ titulo: 'Diferencia', monto: clpSigno(Number(d.diferencia) || 0), montoColor: caja.tono === 'neg' ? T.neg : caja.tono === 'pos' ? T.pos : T.warn, ultima: true })]
      : []),
  ]
  const bloqueCaja = seccion('Caja', lista(filasCaja), { sinPadding: true })
    + (d.contado === null ? aviso('Se cerró sin contar la caja. Contar los billetes al cerrar ayuda a detectar diferencias a tiempo.', 'neutro') : '')

  const asunto = `${d.etiqueta} cerrado · ${fechaDiaMes(d.fecha)} · Neto ${clp(neto)}`
  const html = documento({
    asunto,
    preencabezado: `Ventas ${clp(ventas)} · Proveedores ${clp(prov)} · ${caja.texto}`,
    tipo: 'Cierre',
    cuerpo: principal + bloqueVentas + bloqueProv + bloqueCaja,
  })

  const texto = [
    `${d.etiqueta} cerrado — ${cuando}`,
    d.atendio ? `Atendió: ${d.atendio}` : null,
    '',
    `Neto: ${clp(neto)}`,
    `Ventas: ${clp(ventas)}`,
    ...montos.map((x) => `  ${x.m.label}: ${clp(x.monto)}`),
    `Proveedores: ${clp(prov)} (efectivo ${clp(provEf)}, transferencia ${clp(provTr)})`,
    ...d.proveedores.map((p) => `  ${p.nombre}: ${clp(p.monto)}`),
    `Efectivo esperado: ${clp(d.esperado)}`,
    `Caja: ${caja.texto}`,
    '',
    `Ver la planilla: ${APP_URL}/dia?fecha=${d.fecha}`,
    `Elegir qué correos recibo: ${APP_URL}/ajustes?seccion=correos`,
  ].filter((l) => l !== null).join('\n')

  return { asunto, html, texto }
}

