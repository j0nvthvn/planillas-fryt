import { useEffect, useState, startTransition } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Amount from '../components/Amount'
import { clp, toNum } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import { METODOS_VENTA, ACCENT, GREEN } from '../components/TurnoInput'
import { descargarCSV } from '../utils/csv'
import Icon from '../components/Icon'

function tickFmt(v) {
  if (v === 0) return '$0'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${abs}`
}

// Variación vs. el mismo largo de período inmediatamente anterior. Sin dato
// previo (negocio nuevo, o período anterior sin actividad) no se puede
// calcular un %, así que se omite o se marca "nuevo". "Caja" además puede
// ser negativa (una semana en que se pagó más a proveedores en efectivo que
// lo que entró en ventas en efectivo); si el signo cambia entre períodos, un
// % es engañoso — un salto de -$24.358 a +$425.962 da +1849%, técnicamente
// correcto pero sin significado útil — así que en ese caso se muestra la
// diferencia en pesos en vez del porcentaje.
function DeltaBadge({ actual, anterior }) {
  if (anterior == null) return null
  if (anterior === 0) {
    if (actual === 0) return null
    return <span className="text-[10.5px] font-semibold text-muted2">nuevo</span>
  }
  const diff = actual - anterior
  const subiendo = diff > 0
  const cruzaCero = (actual >= 0) !== (anterior >= 0)
  if (cruzaCero) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${subiendo ? 'text-pos' : 'text-neg'}`}>
        <Icon name={subiendo ? 'caretUp' : 'caretDown'} className="w-3 h-3" stroke={3} />
        {subiendo ? '+' : '−'}{clp(Math.abs(diff))}
      </span>
    )
  }
  const pct = (diff / Math.abs(anterior)) * 100
  if (Math.abs(pct) < 0.5) {
    return <span className="text-[10.5px] font-medium text-muted2">≈ igual</span>
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${subiendo ? 'text-pos' : 'text-neg'}`}>
      <Icon name={subiendo ? 'caretUp' : 'caretDown'} className="w-3 h-3" stroke={3} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function fechaEje(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return `${dias[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const KPI_COLORS = {
  ventas:    { fg: 'var(--brand)',  bg: 'var(--brand-tint)',  border: 'rgb(var(--brand-rgb) / 0.2)' },
  proveed:   { fg: 'var(--neg)',    bg: 'var(--neg-tint)',    border: 'rgb(var(--neg-rgb) / 0.25)' },
  caja:      { fg: 'var(--pos)',    bg: 'var(--pos-tint)',    border: 'rgb(var(--pos-rgb) / 0.25)' },
}

// Paleta propia del gráfico "Ventas por día". METODOS_VENTA usa colores de
// marca fijos (para reconocer cada logo en chips/keypad), pero como fill de
// barras/áreas apiladas esos mismos hex fallan: el café de transferencia casi
// desaparece en modo oscuro y edenred/amipass (ambos ámbar) se confunden entre
// sí. Esta paleta prioriza contraste y distinción de tono en el gráfico,
// separada del resto de la app donde sí importa la identidad de marca.
const CHART_COLORS = {
  efectivo:      { light: '#1E7A4F', dark: '#34D399' },
  getnet:        { light: '#33518C', dark: '#7C9CE0' },
  mercadopago:   { light: '#0EA5C4', dark: '#22D3EE' },
  edenred:       { light: '#EA8C00', dark: '#FBBF24' },
  amipass:       { light: '#B23A8C', dark: '#F472B6' },
  transferencia: { light: '#5C3317', dark: '#C99B6D' },
}

export default function Analisis() {
  const [periodo, setPeriodo] = useState('7')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => { cargarDatos() }, [periodo])

  async function cargarDatos() {
    setCargando(true)
    const hoy = new Date()
    const desde = new Date(hoy)
    const dias = periodo === '7' ? 6 : 29
    desde.setDate(hoy.getDate() - dias)
    const desdeStr = desde.toISOString().split('T')[0]

    // Ventana inmediatamente anterior, del mismo largo, para poder mostrar
    // "vs período anterior" junto al neto y los KPIs (p. ej. últimos 7 días
    // vs los 7 días previos a esos).
    const anteriorHasta = new Date(desde)
    anteriorHasta.setDate(desde.getDate() - 1)
    const anteriorDesde = new Date(anteriorHasta)
    anteriorDesde.setDate(anteriorHasta.getDate() - dias)
    const anteriorHastaStr = anteriorHasta.toISOString().split('T')[0]
    const anteriorDesdeStr = anteriorDesde.toISOString().split('T')[0]

    const [{ data: jornadas }, { data: jornadasAnterior }] = await Promise.all([
      supabase
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
        .order('fecha'),
      supabase
        .from('jornadas')
        .select(`
          turnos(
            ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
            proveedores:proveedores_turno(monto, forma_pago)
          )
        `)
        .gte('fecha', anteriorDesdeStr)
        .lte('fecha', anteriorHastaStr),
    ])

    startTransition(() => {
      const procesado = procesarDatos(jornadas || [], desdeStr)
      procesado.anterior = totalesPeriodo(jornadasAnterior || [])
      setDatos(procesado)
      setCargando(false)
    })
  }

  // Solo necesita los totales agregados del período anterior (no el desglose
  // por día que usa el gráfico), así que recorre las jornadas con una pasada
  // más liviana que procesarDatos.
  function totalesPeriodo(jornadas) {
    let ventasTotal = 0, efectivoVentas = 0, provEf = 0, provTr = 0
    for (const j of jornadas) {
      for (const t of j.turnos || []) {
        const vt = totalesVentas(t.ventas)
        const pt = totalesProveedores(t.proveedores)
        ventasTotal += vt.total
        efectivoVentas += vt.efectivo
        provEf += pt.efectivo
        provTr += pt.transferencia
      }
    }
    const proveedoresTotal = provEf + provTr
    return {
      ventasTotal,
      proveedoresTotal,
      neto: ventasTotal - proveedoresTotal,
      efectivoEnCaja: efectivoVentas - provEf,
    }
  }

  function procesarDatos(jornadas, desdeStr) {
    const ventasPorDia = []
    const saldos = []
    const contadorProveedores = {}
    const totalesGlobales = { efectivo: 0, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 }
    let totalEfectivoProveedores = 0
    let totalTransferenciaProveedores = 0

    for (const j of jornadas) {
      const turnos = j.turnos || []
      let efDia = 0, gtDia = 0, mpDia = 0, edDia = 0, amDia = 0, trDia = 0
      let efProvDia = 0, trProvDia = 0

      for (const t of turnos) {
        const vt = totalesVentas(t.ventas)
        efDia += vt.efectivo; gtDia += vt.getnet; mpDia += vt.mercadopago
        edDia += vt.edenred; amDia += vt.amipass; trDia += vt.transferencia
        const pt = totalesProveedores(t.proveedores)
        efProvDia += pt.efectivo; trProvDia += pt.transferencia
        for (const p of t.proveedores || [])
          contadorProveedores[p.nombre] = (contadorProveedores[p.nombre] || 0) + toNum(p.monto)
      }

      totalesGlobales.efectivo += efDia; totalesGlobales.getnet += gtDia
      totalesGlobales.mercadopago += mpDia; totalesGlobales.edenred += edDia
      totalesGlobales.amipass += amDia; totalesGlobales.transferencia += trDia
      totalEfectivoProveedores += efProvDia
      totalTransferenciaProveedores += trProvDia

      const totalDia = efDia + gtDia + mpDia + edDia + amDia + trDia
      ventasPorDia.push({
        fecha: fechaEje(j.fecha),
        fechaIso: j.fecha,
        Efectivo: efDia, Getnet: gtDia, 'Mercado Pago': mpDia,
        Edenred: edDia, Amipass: amDia, Transferencia: trDia,
        Total: totalDia,
      })

      if (turnos.length >= 1)
        saldos.push({ fecha: fechaEje(j.fecha), Saldo: totalDia - (efProvDia + trProvDia) })
    }

    const topProveedores = Object.entries(contadorProveedores)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nombre, monto]) => ({ nombre, monto }))

    const hoy = new Date().toISOString().split('T')[0]

    return {
      ventasPorDia, saldos, topProveedores,
      totalesGlobales, totalEfectivoProveedores, totalTransferenciaProveedores,
      hayVentas: ventasPorDia.some((d) => d.Total > 0),
      desdeStr, fechaHoy: hoy,
    }
  }

  // Exporta el detalle turno por turno del período seleccionado (no el
  // agregado diario que ya se usa para los gráficos) — es lo que un
  // contador necesita: una fila por turno, con quién lo registró, su
  // estado, y el cuadre de caja si se contó al cerrar.
  async function exportarCSV() {
    if (!datos) return
    setExportando(true)
    try {
      const { data: jornadas, error } = await supabase
        .from('jornadas')
        .select(`
          fecha,
          turnos(
            tipo, is_draft, fondo_inicial,
            usuario:usuarios(nombre),
            ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
            proveedores:proveedores_turno(monto, forma_pago),
            cierres:turno_cierres(es_correccion, cerrado_en, efectivo_esperado, efectivo_contado, diferencia_efectivo)
          )
        `)
        .gte('fecha', datos.desdeStr)
        .order('fecha')
      if (error) throw error

      const columnas = [
        'Fecha', 'Turno', 'Registrado por', 'Estado',
        'Efectivo', 'Getnet', 'Mercado Pago', 'Edenred', 'Amipass', 'Transferencia', 'Total ventas',
        'Proveedores efectivo', 'Proveedores transferencia', 'Total proveedores', 'Neto',
        'Fondo de caja', 'Efectivo esperado', 'Efectivo contado', 'Diferencia',
      ]

      const filas = []
      const totales = Array(11).fill(0) // Efectivo..Neto (11 columnas numéricas antes de fondo/conteo)

      for (const j of jornadas || []) {
        for (const t of (j.turnos || []).sort((a, b) => a.tipo.localeCompare(b.tipo))) {
          const vt = totalesVentas(t.ventas)
          const pt = totalesProveedores(t.proveedores)
          const totalVentas = vt.total
          const totalProveedores = pt.total
          const neto = totalVentas - totalProveedores
          const cierres = t.cierres || []
          const ultimoCierre = cierres.length
            ? [...cierres].sort((a, b) => new Date(b.cerrado_en) - new Date(a.cerrado_en))[0]
            : null
          const estado = t.is_draft ? 'Borrador' : cierres.some((c) => c.es_correccion) ? 'Corregido' : 'Cerrado'

          const fila = [
            j.fecha, t.tipo, t.usuario?.nombre || '', estado,
            vt.efectivo, vt.getnet, vt.mercadopago, vt.edenred, vt.amipass, vt.transferencia, totalVentas,
            pt.efectivo, pt.transferencia, totalProveedores, neto,
            t.fondo_inicial ?? 0,
            ultimoCierre?.efectivo_esperado ?? '',
            ultimoCierre?.efectivo_contado ?? '',
            ultimoCierre?.diferencia_efectivo ?? '',
          ]
          filas.push(fila)

          const numericos = [vt.efectivo, vt.getnet, vt.mercadopago, vt.edenred, vt.amipass, vt.transferencia, totalVentas, pt.efectivo, pt.transferencia, totalProveedores, neto]
          numericos.forEach((v, i) => { totales[i] += v })
        }
      }

      filas.push(['', '', '', 'TOTAL', ...totales, '', '', '', ''])

      const nombreArchivo = `frytcontrol-turnos-${datos.desdeStr}-a-${datos.fechaHoy}.csv`
      descargarCSV(nombreArchivo, columnas, filas)
    } catch (err) {
      console.error(err)
    } finally {
      setExportando(false)
    }
  }

  const ventasTotal = datos ? Object.values(datos.totalesGlobales).reduce((a, b) => a + b, 0) : 0
  const proveedoresTotal = datos ? datos.totalEfectivoProveedores + datos.totalTransferenciaProveedores : 0
  const neto = ventasTotal - proveedoresTotal
  const efectivoEnCaja = datos ? datos.totalesGlobales.efectivo - datos.totalEfectivoProveedores : 0

  const gridStroke = isDark ? '#3f3f46' : 'var(--soft)'
  const tickColor = isDark ? '#a1a1aa' : 'var(--muted)'
  const legendColor = isDark ? '#a1a1aa' : 'var(--ink2)'
  const chartColor = (key) => (isDark ? CHART_COLORS[key]?.dark : CHART_COLORS[key]?.light) || (isDark ? '#a1a1aa' : 'var(--muted)')

  const tooltipStyle = {
    background: isDark ? '#27272a' : 'var(--card)',
    border: `1px solid ${isDark ? '#52525b' : 'var(--hairline)'}`,
    borderRadius: '12px',
    fontSize: '12px',
    color: isDark ? '#f4f4f5' : 'var(--ink)',
  }
  const cursorFill = isDark ? 'rgba(255,255,255,.04)' : 'rgba(92,51,23,.04)'

  return (
    <Layout>
      <div className="max-w-screen-2xl mx-auto space-y-3.5">
        <PageHeader
          title="Análisis"
          date={`Últimos ${periodo} días`}
        />

        {/* Toggle 7 / 30 + exportar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-brand-tint rounded-[15px] w-fit">
            {[{ v: '7', l: '7 días' }, { v: '30', l: '30 días' }].map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriodo(p.v)}
                className={`px-4 py-2 rounded-[11px] text-[13px] font-semibold transition ${
                  periodo === p.v
                    ? 'bg-card text-brand shadow-sm'
                    : 'text-muted hover:text-ink2'
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>
          {datos?.hayVentas && (
            <button
              onClick={exportarCSV}
              disabled={exportando}
              className="flex items-center gap-2 rounded-xl py-2 px-3 text-[13px] font-semibold border border-hairline text-ink2 bg-card hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-50"
            >
              {exportando ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-ink2 border-t-transparent animate-spin" />
              ) : (
                <Icon name="note" className="w-4 h-4" stroke={1.8} />
              )}
              Exportar CSV
            </button>
          )}
        </div>

        {cargando && <Spinner className="py-16" />}

        {!cargando && datos && (
          <>
            {/* Hero: Neto del período */}
            <div className="card-hero">
              <p className="eyebrow">Neto del período</p>
              <Amount variant="hero" color={neto >= 0 ? 'pos' : 'neg'} value={neto} className="mt-1" />
              <p className="text-[12px] text-muted mt-2">
                {clp(ventasTotal)} ventas − {clp(proveedoresTotal)} proveedores
              </p>
              {datos.anterior && (
                <div className="flex items-center gap-1.5 mt-2">
                  <DeltaBadge actual={neto} anterior={datos.anterior.neto} />
                  <span className="text-[11px] text-muted2">vs período anterior</span>
                </div>
              )}
            </div>

            {/* KPIs tintados */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: 'ventas',  label: 'Ventas',   value: ventasTotal,     anteriorKey: 'ventasTotal' },
                { key: 'proveed', label: 'Proveed.', value: proveedoresTotal, anteriorKey: 'proveedoresTotal' },
                { key: 'caja',    label: 'Caja',     value: efectivoEnCaja,  anteriorKey: 'efectivoEnCaja' },
              ].map((k) => {
                const c = KPI_COLORS[k.key]
                return (
                  <div key={k.key} className="min-w-0 rounded-2xl p-3 border" style={{ background: c.bg, borderColor: c.border }}>
                    <p className="eyebrow mb-1.5 truncate" style={{ color: c.fg }}>{k.label}</p>
                    <p className="font-display tabular-nums text-[17px] leading-none truncate" style={{ color: c.fg }}>
                      {tickFmt(k.value)}
                    </p>
                    {datos.anterior && (
                      <div className="mt-1">
                        <DeltaBadge actual={k.value} anterior={datos.anterior[k.anteriorKey]} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Ventas por día */}
            {datos.hayVentas && (
              <div className="card">
                <div className="mb-3">
                  <p className="font-semibold text-ink text-[15px]">Ventas por día</p>
                  <p className="text-xs text-muted mt-0.5">Total vendido cada día, desglosado por método</p>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  {periodo === '7' ? (
                    <BarChart data={datos.ventasPorDia} barSize={26} maxBarSize={36}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                      <YAxis width={52} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v, name) => [clp(v), name]} contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8, color: legendColor }} />
                      {METODOS_VENTA.map((m, i, arr) => (
                        <Bar
                          key={m.key}
                          dataKey={m.label}
                          stackId="a"
                          fill={chartColor(m.key)}
                          radius={i === arr.length - 1 ? [4, 4, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <AreaChart data={datos.ventasPorDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                      <YAxis width={52} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v, name) => [clp(v), name]} contentStyle={tooltipStyle} cursor={{ fill: cursorFill }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8, color: legendColor }} />
                      {METODOS_VENTA.map((m) => (
                        <Area key={m.key} type="monotone" dataKey={m.label} stackId="a"
                          fill={chartColor(m.key)} stroke={chartColor(m.key)} fillOpacity={0.85} strokeWidth={0} />
                      ))}
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Top proveedores */}
            {datos.topProveedores.length > 0 && (
              <div className="card">
                <div className="mb-3">
                  <p className="font-semibold text-ink text-[15px]">Top proveedores</p>
                  <p className="text-xs text-muted mt-0.5">Mayor gasto acumulado en el período</p>
                </div>
                <div className="space-y-2.5">
                  {datos.topProveedores.map((p, i) => {
                    const maxMonto = datos.topProveedores[0].monto
                    const pct = (p.monto / maxMonto) * 100
                    return (
                      <div key={p.nombre} className="flex items-center gap-2.5">
                        <span className="text-xs text-muted w-4 text-right shrink-0 tabular-nums">{i + 1}</span>
                        <span className="text-[13px] text-ink2 w-28 truncate">{p.nombre}</span>
                        <div className="flex-1 bg-soft rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
                        </div>
                        <span className="text-[13px] font-semibold text-ink tabular-nums w-20 text-right">{clp(p.monto)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!datos.hayVentas && (
              <div className="card text-center py-10">
                <p className="text-sm text-muted">Sin ventas en el período seleccionado</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
