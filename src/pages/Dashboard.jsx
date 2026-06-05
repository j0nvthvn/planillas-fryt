import { useEffect, useState, startTransition } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { clp, toNum } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'

const METODOS = [
  { key: 'efectivo',      label: 'Efectivo',      color: '#1E7A4F' },
  { key: 'getnet',        label: 'Getnet',         color: '#33518C' },
  { key: 'mercadopago',   label: 'Mercado Pago',   color: '#00b1ea' },
  { key: 'edenred',       label: 'Edenred',        color: '#f59e0b' },
  { key: 'amipass',       label: 'Amipass',        color: '#a16207' },
  { key: 'transferencia', label: 'Transferencia',  color: '#5C3317' },
]

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

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('semana')
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
    if (periodo === 'semana') desde.setDate(hoy.getDate() - 6)
    else if (periodo === 'mes') desde.setDate(hoy.getDate() - 29)

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
      setDatos(procesarDatos(jornadas || []))
      setCargando(false)
    })
  }

  function procesarDatos(jornadas) {
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
        Efectivo: efDia, Getnet: gtDia, 'Mercado Pago': mpDia,
        Edenred: edDia, Amipass: amDia, Transferencia: trDia,
        Total: totalDia,
      })

      if (turnos.length >= 1)
        saldos.push({ fecha: fechaEje(j.fecha), Saldo: totalDia - (efProvDia + trProvDia) })
    }

    const topProveedores = Object.entries(contadorProveedores)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([nombre, monto]) => ({ nombre, monto }))

    const pieVentas = METODOS
      .map((m) => ({ name: m.label, value: totalesGlobales[m.key], color: m.color }))
      .filter((d) => d.value > 0)

    const pieProveedores = [
      { name: 'Efectivo', value: totalEfectivoProveedores, color: '#1E7A4F' },
      { name: 'Transferencia', value: totalTransferenciaProveedores, color: '#33518C' },
    ].filter((d) => d.value > 0)

    const hayVentas = ventasPorDia.some((d) => d.Total > 0)

    return {
      ventasPorDia, saldos, topProveedores, pieVentas, pieProveedores,
      totalesGlobales, totalEfectivoProveedores, totalTransferenciaProveedores,
      hayVentas,
    }
  }

  const kpis = datos ? [
    { label: 'Ventas totales',            value: Object.values(datos.totalesGlobales).reduce((a, b) => a + b, 0), color: '#5C3317' },
    { label: 'Efectivo ventas',           value: datos.totalesGlobales.efectivo,           color: '#1E7A4F' },
    { label: 'Proveedores efectivo',      value: datos.totalEfectivoProveedores,           color: '#b91c1c' },
    { label: 'Proveedores transferencia', value: datos.totalTransferenciaProveedores,      color: '#33518C' },
  ] : []

  const tooltipStyle = {
    background: isDark ? '#27272a' : '#fff',
    border: `1px solid ${isDark ? '#52525b' : '#e5e7eb'}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: isDark ? '#f4f4f5' : '#111827',
  }

  const gridStroke = isDark ? '#3f3f46' : '#f0f0f0'
  const refLineStroke = isDark ? '#52525b' : '#D1D5DB'
  const tickColor = isDark ? '#a1a1aa' : '#6b7280'
  const legendColor = isDark ? '#a1a1aa' : '#374151'
  const cursorFill = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const tooltipTextStyle = { color: isDark ? '#f4f4f5' : '#111827' }
  const tooltipItemStyle = { color: isDark ? '#d4d4d8' : '#374151' }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-200">Dashboard</h1>
          <div className="flex gap-1.5">
            {[
              { value: 'dia',    label: 'Hoy' },
              { value: 'semana', label: '7 días' },
              { value: 'mes',    label: '30 días' },
            ].map((p) => (
              <button key={p.value} onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodo === p.value
                    ? 'bg-[#5C3317] text-white'
                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {cargando && <Spinner className="py-16" />}

        {!cargando && datos && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="card text-center py-4"
                  style={{ background: isDark ? `${kpi.color}30` : `${kpi.color}0d` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 leading-tight"
                    style={{ color: isDark ? `${kpi.color}cc` : `${kpi.color}99` }}>{kpi.label}</p>
                  <p className="text-[22px] font-black tabular-nums leading-none"
                    style={{ color: isDark ? `${kpi.color}ee` : kpi.color }}>{clp(kpi.value)}</p>
                </div>
              ))}
            </div>

            {/* Ventas por día — solo períodos multi-día */}
            {periodo !== 'dia' && datos.hayVentas && (() => {
              const metodosActivos = METODOS.filter((m) => datos.totalesGlobales[m.key] > 0)
              const ejeComun = (
                <>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis width={52} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v, name) => [clp(v), name]} contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8, color: legendColor }} />
                </>
              )
              return (
                <div className="card">
                  <div className="mb-3">
                    <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Ventas por día</h2>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Total vendido cada día, desglosado por método de pago</p>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    {periodo === 'semana' ? (
                      <BarChart data={datos.ventasPorDia} barSize={28} maxBarSize={40}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        {ejeComun}
                        {metodosActivos.map((m, i) => (
                          <Bar key={m.key} dataKey={m.label} stackId="a" fill={m.color}
                            radius={i === metodosActivos.length - 1 ? [3, 3, 0, 0] : undefined} />
                        ))}
                      </BarChart>
                    ) : (
                      <AreaChart data={datos.ventasPorDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        {ejeComun}
                        {metodosActivos.map((m) => (
                          <Area key={m.key} type="monotone" dataKey={m.label} stackId="a"
                            fill={m.color} stroke={m.color} fillOpacity={0.85} strokeWidth={0} />
                        ))}
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )
            })()}

            {/* Vista de hoy: desglose por método + efectivo neto */}
            {periodo === 'dia' && datos.hayVentas && (
              <>
                <div className="card">
                  <div className="mb-3">
                    <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Desglose de hoy</h2>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Distribución de las ventas del día por método de pago</p>
                  </div>
                  <div className="space-y-2.5">
                    {METODOS.filter((m) => datos.totalesGlobales[m.key] > 0).map((m) => {
                      const total = Object.values(datos.totalesGlobales).reduce((a, b) => a + b, 0)
                      const val = datos.totalesGlobales[m.key]
                      const pct = total > 0 ? (val / total) * 100 : 0
                      return (
                        <div key={m.key} className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="text-xs text-gray-600 dark:text-zinc-300 w-24 truncate">{m.label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: m.color }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right shrink-0">{pct.toFixed(0)}%</span>
                          <span className="text-xs font-semibold tabular-nums text-gray-800 dark:text-zinc-200 w-20 text-right">{clp(val)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="card bg-[#F5EAD4] dark:bg-[#3d2817]">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-[#5C3317]/60 dark:text-[#E8C9A8]">Efectivo neto en caja hoy</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Efectivo cobrado en ventas − efectivo pagado a proveedores</p>
                  <p className="text-3xl font-black tabular-nums text-[#5C3317] dark:text-[#E8C9A8]">
                    {clp(datos.totalesGlobales.efectivo - datos.totalEfectivoProveedores)}
                  </p>
                </div>
              </>
            )}

            {/* Saldo neto por día — gráfico de tendencia (solo multi-día, mínimo 2 puntos) */}
            {periodo !== 'dia' && datos.saldos.length > 1 && (
              <div className="card">
                <div className="mb-3">
                  <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Saldo neto por día</h2>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Total ventas − total pagado a proveedores</p>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={datos.saldos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                    <YAxis width={52} tickFormatter={tickFmt} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [clp(v), 'Saldo neto']} contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
                    <ReferenceLine y={0} stroke={refLineStroke} strokeWidth={1.5} />
                    <Bar dataKey="Saldo" radius={[3, 3, 0, 0]} maxBarSize={40}>
                      {datos.saldos.map((entry, i) => (
                        <Cell key={i} fill={entry.Saldo >= 0 ? '#1E7A4F' : '#DC2626'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie charts */}
            {(datos.pieVentas.length > 0 || datos.pieProveedores.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {datos.pieVentas.length > 0 && (() => {
                  const total = datos.pieVentas.reduce((s, d) => s + d.value, 0)
                  return (
                    <div className="card flex flex-col gap-3">
                      <div>
                        <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Mix de ventas</h2>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Proporción por método en el período</p>
                      </div>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={datos.pieVentas} cx="50%" cy="50%"
                            outerRadius="72%" innerRadius="48%" dataKey="value"
                            stroke={isDark ? '#27272a' : '#fff'}
                            paddingAngle={2}>
                            {datos.pieVentas.map((d, i) => <Cell key={i} fill={d.color} />)}
                            <Label content={({ viewBox: { cx, cy } }) => (
                              <text textAnchor="middle">
                                <tspan x={cx} y={cy - 7} fontSize={10} fill={tickColor}>Total</tspan>
                                <tspan x={cx} y={cy + 9} fontSize={13} fontWeight="700" fill={isDark ? '#f4f4f5' : '#111827'}>{clp(total)}</tspan>
                              </text>
                            )} />
                          </Pie>
                          <Tooltip formatter={(v, name) => [clp(v), name]} contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipItemStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5">
                        {datos.pieVentas.map((d) => {
                          const pct = total > 0 ? (d.value / total) * 100 : 0
                          return (
                            <div key={d.name} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                              <span className="flex-1 text-xs text-gray-600 dark:text-zinc-300 truncate">{d.name}</span>
                              <span className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-xs font-semibold tabular-nums w-20 text-right" style={{ color: d.color }}>{clp(d.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {datos.pieProveedores.length > 0 && (() => {
                  const total = datos.pieProveedores.reduce((s, d) => s + d.value, 0)
                  return (
                    <div className="card flex flex-col gap-3">
                      <div>
                        <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Proveedores por pago</h2>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Efectivo vs. transferencia en el período</p>
                      </div>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie data={datos.pieProveedores} cx="50%" cy="50%"
                            outerRadius="72%" innerRadius="48%" dataKey="value"
                            stroke={isDark ? '#27272a' : '#fff'}
                            paddingAngle={3}>
                            {datos.pieProveedores.map((d, i) => <Cell key={i} fill={d.color} />)}
                            <Label content={({ viewBox: { cx, cy } }) => (
                              <text textAnchor="middle">
                                <tspan x={cx} y={cy - 7} fontSize={10} fill={tickColor}>Total</tspan>
                                <tspan x={cx} y={cy + 9} fontSize={13} fontWeight="700" fill={isDark ? '#f4f4f5' : '#111827'}>{clp(total)}</tspan>
                              </text>
                            )} />
                          </Pie>
                          <Tooltip formatter={(v, name) => [clp(v), name]} contentStyle={tooltipStyle} labelStyle={tooltipTextStyle} itemStyle={tooltipItemStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5">
                        {datos.pieProveedores.map((d) => {
                          const pct = total > 0 ? (d.value / total) * 100 : 0
                          return (
                            <div key={d.name} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                              <span className="flex-1 text-xs text-gray-600 dark:text-zinc-300 truncate">{d.name}</span>
                              <span className="text-xs text-gray-400 dark:text-zinc-500 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                              <span className="text-xs font-semibold tabular-nums w-20 text-right" style={{ color: d.color }}>{clp(d.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Top proveedores */}
            {datos.topProveedores.length > 0 && (
              <div className="card">
                <div className="mb-3">
                  <h2 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Top proveedores</h2>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Proveedores con mayor gasto acumulado en el período</p>
                </div>
                <div className="space-y-2">
                  {datos.topProveedores.map((p, i) => {
                    const pct = (p.monto / datos.topProveedores[0].monto) * 100
                    return (
                      <div key={p.nombre} className="flex items-center gap-2.5">
                        <span className="text-xs text-gray-400 dark:text-zinc-500 w-4 text-right shrink-0">{i + 1}</span>
                        <span className="text-xs text-gray-700 dark:text-zinc-300 w-28 truncate">{p.nombre}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#5C3317] dark:bg-[#8B5D39] h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-zinc-300 w-20 text-right">{clp(p.monto)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Estado vacío */}
            {!datos.hayVentas && (
              <div className="card text-center py-10">
                <p className="text-sm text-gray-400 dark:text-zinc-500">Sin ventas en el período seleccionado</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
