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

function tickFmt(v) {
  if (v === 0) return '$0'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${abs}`
}

function fechaEje(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return `${dias[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const KPI_COLORS = {
  ventas:    { fg: 'var(--brand)',  bg: 'var(--brand-tint)' },
  proveed:   { fg: 'var(--neg)',    bg: 'var(--neg-tint)' },
  caja:      { fg: 'var(--pos)',    bg: 'var(--pos-tint)' },
}

export default function Analisis() {
  const [periodo, setPeriodo] = useState('7')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

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
      .order('fecha')

    startTransition(() => {
      setDatos(procesarDatos(jornadas || [], desdeStr))
      setCargando(false)
    })
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

  const ventasTotal = datos ? Object.values(datos.totalesGlobales).reduce((a, b) => a + b, 0) : 0
  const proveedoresTotal = datos ? datos.totalEfectivoProveedores + datos.totalTransferenciaProveedores : 0
  const neto = ventasTotal - proveedoresTotal
  const efectivoEnCaja = datos ? datos.totalesGlobales.efectivo - datos.totalEfectivoProveedores : 0

  const gridStroke = isDark ? '#3f3f46' : 'var(--soft)'
  const tickColor = isDark ? '#a1a1aa' : 'var(--muted)'
  const legendColor = isDark ? '#a1a1aa' : 'var(--ink2)'

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

        {/* Toggle 7 / 30 */}
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
            </div>

            {/* KPIs tintados */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: 'ventas',  label: 'Ventas',   value: ventasTotal },
                { key: 'proveed', label: 'Proveed.', value: proveedoresTotal },
                { key: 'caja',    label: 'Caja',     value: efectivoEnCaja },
              ].map((k) => {
                const c = KPI_COLORS[k.key]
                return (
                  <div key={k.key} className="min-w-0 rounded-2xl p-3 border" style={{ background: c.bg, borderColor: `${c.fg}33` }}>
                    <p className="eyebrow mb-1.5 truncate" style={{ color: c.fg }}>{k.label}</p>
                    <p className="font-display tabular-nums text-[17px] font-bold leading-none truncate" style={{ color: c.fg }}>
                      {tickFmt(k.value)}
                    </p>
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
                          fill={m.color}
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
                          fill={m.color} stroke={m.color} fillOpacity={0.85} strokeWidth={0} />
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
