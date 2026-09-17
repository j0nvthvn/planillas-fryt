import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { DeltaBadge } from '@/components/DeltaBadge'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { MetodoLogo } from '@/components/MetodoLogo'
import { useMetodos } from '@/features/catalogo/api'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { clp, clpCorto, clpEje, fechaISO, hoy, ajustarRango, sumarDias, fechaDiaMes } from '@/lib/format'
import { ExportarSheet } from '@/features/exportar/ExportarSheet'
import type { Resumen } from '@/features/exportar/tablas'
import type { VResumenDia } from '@/features/turno/api'
import { colorMetodo } from '@/lib/theme'
import { BarraMetodos } from '@/components/BarraMetodos'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { promedioNeto, resumenGrafico } from './resumen'


function rango(preset: '7' | '30' | 'mes'): { desde: string; hasta: string } {
  const h = hoy()
  if (preset === 'mes') { const d = new Date(); return { desde: fechaISO(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: h } }
  return { desde: sumarDias(h, preset === '7' ? -6 : -29), hasta: h }
}

export default function Analisis() {
  const search = useSearch({ from: '/app/analisis' })
  const navigate = useNavigate()
  const { desde, hasta } = search.desde && search.hasta ? ajustarRango(search.desde, search.hasta) : rango('7')
  const metodos = useMetodos()
  const q = useQuery({
    queryKey: qk.resumenPeriodo(desde, hasta),
    queryFn: async (): Promise<Resumen> => {
      const { data, error } = await supabase.rpc('resumen_periodo', { p_desde: desde, p_hasta: hasta })
      if (error) throw error
      return data as unknown as Resumen
    },
  })
  const r = q.data
  const dias = useMemo(() => (r?.dias ?? []).map((d) => ({ ...d, label: fechaDiaMes(d.fecha).replace(/,|\s\S+$/g, ''), neto: Number(d.neto), total_ventas: Number(d.total_ventas) })), [r])
  const presetActivo = (['7', '30', 'mes'] as const).find((p) => { const x = rango(p); return x.desde === desde && x.hasta === hasta })

  const [exportando, setExportando] = useState(false)

  const promedio = promedioNeto(dias)
  const diasSinAbrir = dias.filter((d) => d.cerrado).length
  const hayBorrador = dias.some((d) => d.estado === 'borrador')
  const hayNegativo = dias.some((d) => d.neto < 0)
  const escritorio = useIsDesktop()
  // Unas 6 etiquetas en el celular y 8 en escritorio, a distancias iguales.
  const intervaloX = Math.max(0, Math.ceil(dias.length / (escritorio ? 8 : 6)) - 1)
  const formatoY = clpEje(Math.max(0, ...dias.map((d) => Math.abs(d.neto))))
  const irADia = (fecha: string) => void navigate({ to: '/dia', search: { fecha } })
  const porMetodo = (metodos.data ?? [])
    .map((m) => ({ ...m, monto: Number(r?.totales[m.key] ?? 0) }))
    .filter((m) => m.monto > 0)
    .sort((a, b) => b.monto - a.monto)
  const totalProveedores = Number(r?.totales.total_proveedores ?? 0)

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow={rangoLegible(desde, hasta)} title="Análisis"
        action={
          <button type="button" onClick={() => setExportando(true)} disabled={!r}
            className="btn-secondary btn-bar md:bg-brand md:text-on-solid md:border-brand md:hover:bg-brand-hover">
            <Icon name="download" className="w-4 h-4" />Exportar
          </button>
        } />

      <div className="flex flex-col gap-2.5 mb-4 sm:flex-row sm:items-center sm:gap-2">
        <div className="segmented sm:w-auto" role="group" aria-label="Período">
          {(['7', '30', 'mes'] as const).map((p) => (
            <button key={p} type="button" aria-pressed={presetActivo === p} onClick={() => void navigate({ to: '/analisis', search: rango(p) })}
              className={`hit ${presetActivo === p ? 'segmented-item-on' : 'segmented-item'} min-h-[38px] px-3.5 whitespace-nowrap`}>
              {p === 'mes' ? 'Este mes' : `${p} días`}
            </button>
          ))}
        </div>
        {/* En el celular las fechas van en su propia fila a todo lo ancho: a 140 px cada una no cabían en 375 px. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 w-full text-sm sm:flex sm:w-auto sm:ml-auto">
          <input type="date" aria-label="Desde" className="input py-1.5 px-2.5 min-h-[40px] rounded-[10px] min-w-0 w-full sm:w-[140px]" value={desde} max={hasta} onChange={(e) => e.target.value && void navigate({ to: '/analisis', search: ajustarRango(e.target.value, hasta, 'desde') })} />
          <span className="text-muted" aria-hidden="true">→</span>
          <input type="date" aria-label="Hasta" className="input py-1.5 px-2.5 min-h-[40px] rounded-[10px] min-w-0 w-full sm:w-[140px]" value={hasta} min={desde} max={hoy()} onChange={(e) => e.target.value && void navigate({ to: '/analisis', search: ajustarRango(desde, e.target.value, 'hasta') })} />
        </div>
      </div>

      {q.isPending || !r ? <Spinner /> : (
        <>
          {/* Celular: una tarjeta partida en 2×2. Escritorio: cuatro tarjetas. */}
          <div className="card p-0 overflow-hidden grid grid-cols-2 mb-3 md:grid-cols-4 md:gap-3.5 md:p-0 md:overflow-visible md:bg-transparent md:border-0 md:shadow-none md:rounded-none">
            <Kpi label="Neto" value={r.totales.neto} anterior={r.anterior.neto} destacado className="border-r border-b" />
            <Kpi label="Ventas" value={r.totales.total_ventas} anterior={r.anterior.total_ventas} className="border-b" />
            <Kpi label="Proveedores" value={r.totales.total_proveedores} anterior={r.anterior.total_proveedores} menosEsMejor className="border-r" />
            <Kpi label="Efectivo neto" value={r.totales.efectivo_neto} anterior={r.anterior.efectivo_neto} />
          </div>
          <p className="text-xs leading-normal text-muted mb-3">
            {r.totales.dias_con_registro} día{r.totales.dias_con_registro === 1 ? '' : 's'} con registro
            {diasSinAbrir > 0 && <> · {diasSinAbrir} sin abrir</>}
            {' '}· comparado con el período anterior del mismo largo
            {r.totales.dias_con_borrador ? <> · <b className="font-semibold text-warn">{r.totales.dias_con_borrador} con borrador</b></> : null}
          </p>

          <div className="grid gap-3 md:grid-cols-[1.55fr_1fr] md:gap-3.5 md:items-start">
            <div className="card md:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
                <h2 className="text-sm font-medium text-ink">Neto por día</h2>
                {dias.length > 0 && <span className="text-xs text-muted">promedio <b className="font-semibold tabular-nums text-ink2">{clp(Math.round(promedio))}</b></span>}
                {/* Leyenda: en el celular solo los colores que no se explican solos
                    (borrador y negativo), para que nada dependa del color. */}
                <div className={`${hayBorrador || hayNegativo ? 'flex' : 'hidden md:flex'} flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted w-full`} aria-hidden="true">
                  <span className="hidden md:inline-flex items-center gap-[5px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-brand" />día con registro</span>
                  {hayBorrador && <span className="inline-flex items-center gap-[5px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-warn" />con borrador</span>}
                  {diasSinAbrir > 0 && <span className="inline-flex items-center gap-[5px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-hairline-strong" />no abrió</span>}
                  {hayNegativo && <span className="inline-flex items-center gap-[5px]"><span className="w-[9px] h-[9px] rounded-[2px] bg-neg" />neto negativo</span>}
                  <span className="hidden md:inline-flex items-center gap-[5px]"><span className="w-3.5 border-t border-dashed border-ink2" />promedio</span>
                </div>
              </div>
              {/* El gráfico es decorativo para un lector de pantalla: el resumen
                  del período va en texto, con el mejor y el peor día. */}
              <p className="sr-only">{resumenGrafico(dias)}</p>
              <div className="h-[200px] md:h-[250px]" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dias} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} accessibilityLayer={false}>
                    <CartesianGrid stroke="var(--hairline)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted2)' }} tickLine={false} axisLine={{ stroke: 'var(--hairline-strong)' }} interval={intervaloX} />
                    <YAxis tickFormatter={formatoY} tickCount={4} tick={{ fontSize: 11, fill: 'var(--muted2)' }} tickLine={false} axisLine={false} width={48} />
                    {/* Celular: el toque deja fijo el detalle, con el enlace al día.
                        Escritorio: el detalle sale al pasar el mouse y el clic abre el día. */}
                    <Tooltip cursor={{ fill: 'var(--soft)', radius: 6 }} content={<TooltipDia enlace={!escritorio} />}
                      trigger={escritorio ? 'hover' : 'click'} wrapperStyle={escritorio ? undefined : { pointerEvents: 'auto' }} />
                    <Bar dataKey="neto" radius={[5, 5, 0, 0]} maxBarSize={48} activeBar={{ fillOpacity: 0.8 }}
                      className={escritorio ? 'cursor-pointer' : undefined}
                      onClick={escritorio ? (b: { payload?: { fecha?: string } }) => { if (b.payload?.fecha) irADia(b.payload.fecha) } : undefined}>
                      {dias.map((d) => <Cell key={d.fecha} fill={d.cerrado ? 'var(--hairline-strong)' : d.neto < 0 ? 'var(--neg)' : d.estado === 'borrador' ? 'var(--warn)' : 'var(--brand)'} />)}
                    </Bar>
                    {dias.filter((d) => Number(d.turnos ?? 0) > 0).length > 1 && (
                      <ReferenceLine y={promedio} stroke="var(--ink2)" strokeDasharray="4 4" strokeOpacity={0.6} ifOverflow="extendDomain" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:gap-3.5">
              <div className="card p-0 overflow-hidden">
                <div className="px-[18px] pt-4 pb-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-medium text-ink">Ventas por método</h2>
                    <span className="cifra text-sm text-ink2">{clp(r.totales.total_ventas)}</span>
                  </div>
                  <BarraMetodos metodos={porMetodo} className="mt-3" />
                </div>
                {porMetodo.length === 0 && <p className="text-sm text-muted text-center py-4 border-t border-hairline">Sin ventas en el período.</p>}
                {porMetodo.map((m) => {
                  const pct = r.totales.total_ventas ? (m.monto / r.totales.total_ventas) * 100 : 0
                  return (
                    <div key={m.key} className="flex items-center gap-3 px-[18px] py-2.5 min-h-[60px] border-t border-hairline">
                      <MetodoLogo metodo={m} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-md font-medium text-ink truncate">{m.label}</span>
                        <span className="block h-1 rounded-full bg-soft mt-1.5 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: colorMetodo(m.color) }} /></span>
                      </span>
                      {/* Ancho fijo: así todas las barras de arriba miden lo mismo. */}
                      <span className="text-right shrink-0 min-w-[96px]">
                        <span className="block cifra text-base text-ink">{clp(m.monto)}</span>
                        <span className="block text-[11px] text-muted2 tabular-nums">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-[18px] pt-4 pb-3">
                  <h2 className="text-sm font-medium text-ink">Top proveedores</h2>
                  {totalProveedores > 0 && <span className="cifra text-sm text-neg">−{clp(totalProveedores)}</span>}
                </div>
                {r.top_proveedores.length === 0 ? <p className="text-sm text-muted px-[18px] pb-4">Sin compras en el período.</p> : r.top_proveedores.map((p) => (
                  <Link key={p.proveedor_id ?? p.nombre} to={p.proveedor_id ? '/proveedores/$id' : '/proveedores'} params={{ id: p.proveedor_id ?? '' }} className="flex items-center gap-3 px-[18px] py-2 min-h-[54px] border-t border-hairline hover:bg-soft/60">
                    <ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} size="sm" />
                    <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-ink truncate">{p.nombre}</span><span className="block text-xs text-muted mt-0.5 tabular-nums">{p.compras} compra{p.compras === 1 ? '' : 's'}{totalProveedores > 0 && <> · {Math.round((Number(p.monto) / totalProveedores) * 100)}%</>}</span></span>
                    <span className="cifra text-sm text-neg">{Number(p.monto) ? '−' : ''}{clp(p.monto)}</span>
                  </Link>
                ))}
                <Link to="/proveedores" className="flex items-center justify-center gap-1.5 min-h-[52px] border-t border-hairline text-sm font-semibold text-brand hover:bg-soft">
                  Ver todos los proveedores<Icon name="chevR" className="w-3.5 h-3.5" stroke={2.2} />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
      {exportando && r && <ExportarSheet resumen={r} onClose={() => setExportando(false)} />}
    </div>
  )
}

/** "10 – 16 septiembre"; si cruza meses o años, se nombran los dos. */
function rangoLegible(desde: string, hasta: string): string {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00').toLocaleDateString('es-CL', o)
  const anio = desde.slice(0, 4) !== hasta.slice(0, 4) || hasta.slice(0, 4) !== hoy().slice(0, 4)
  if (desde === hasta) return f(desde, { day: 'numeric', month: 'long', ...(anio ? { year: 'numeric' } : {}) })
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `${f(desde, { day: 'numeric' })} – ${f(hasta, { day: 'numeric', month: 'long', ...(anio ? { year: 'numeric' } : {}) })}`
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(anio ? { year: 'numeric' } : {}) }
  return `${f(desde, o)} – ${f(hasta, o)}`
}

/** Tooltip del gráfico con los tokens del tema (el de recharts venía en gris sobre gris). */
function TooltipDia({ active, payload, enlace }: { active?: boolean; payload?: { payload?: Record<string, unknown> }[]; enlace?: boolean }) {
  const d = payload?.[0]?.payload as (VResumenDia & { neto: number; total_ventas: number }) | undefined
  if (!active || !d) return null
  const neto = Number(d.neto)
  if (d.cerrado) {
    return (
      <div className="rounded-[12px] bg-card border border-hairline shadow-hero px-3 py-2 text-xs min-w-[170px]">
        <p className="font-semibold text-ink capitalize mb-1">{fechaDiaMes(d.fecha)}</p>
        <p className="text-ink2">No abrió{d.motivo_cierre ? ` · ${d.motivo_cierre}` : ''}</p>
      </div>
    )
  }
  return (
    <div className="rounded-[12px] bg-card border border-hairline shadow-hero px-3 py-2 text-xs min-w-[170px]">
      <p className="font-semibold text-ink capitalize mb-1">{fechaDiaMes(d.fecha)}</p>
      <p className="flex justify-between gap-4 text-ink2"><span>Ventas</span><b className="tabular-nums text-ink">{clp(d.total_ventas)}</b></p>
      <p className="flex justify-between gap-4 text-ink2"><span>Proveedores</span><b className="tabular-nums text-ink">{clp(d.total_proveedores)}</b></p>
      <p className={`flex justify-between gap-4 pt-1 mt-1 border-t border-hairline font-semibold ${neto >= 0 ? 'text-ink' : 'text-neg'}`}><span>Neto</span><span className="tabular-nums">{clp(neto)}</span></p>
      {d.estado !== 'completo' && <p className="text-xs text-warn mt-1">{d.estado === 'borrador' ? 'Con borrador' : d.estado === 'parcial' ? 'Falta la tarde' : ''}</p>}
      {/* Solo para el toque: el gráfico está oculto al lector de pantalla y el día se abre también desde Historial. */}
      {enlace
        ? <Link to="/dia" search={{ fecha: d.fecha }} tabIndex={-1} className="hit mt-1.5 flex items-center justify-end gap-1 font-semibold text-brand">Ver día<Icon name="chevR" className="w-3 h-3" stroke={2.4} /></Link>
        : <p className="text-[11px] text-muted mt-1.5">Clic para ver el día</p>}
    </div>
  )
}

function Kpi({ label, value, anterior, destacado, menosEsMejor, className = '' }: { label: string; value: number; anterior: number | null; destacado?: boolean; menosEsMejor?: boolean; className?: string }) {
  return (
    <div className={`relative p-4 border-hairline md:overflow-hidden md:rounded-[14px] md:bg-card md:border md:shadow-card md:px-[18px] ${destacado ? 'md:border-hairline-strong' : ''} ${className}`}>
      {destacado && <span className="hidden md:block absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden="true" />}
      <p className="text-xs leading-none text-muted mb-[7px] md:mb-[9px]">{label}</p>
      {/* A 375 px una cifra de 7 dígitos en 20 px tocaba el borde. */}
      <p className={`cifra text-lg min-[390px]:text-xl md:text-amount-sm leading-none ${destacado ? 'md:font-bold' : ''} ${value < 0 ? 'text-neg' : 'text-ink'}`}>{clp(value)}</p>
      <div className="mt-2.5 min-h-[22px] flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <DeltaBadge actual={value} anterior={anterior} menosEsMejor={menosEsMejor} fondo />
        {anterior != null && anterior !== 0 && <span className="text-[11px] text-muted tabular-nums whitespace-nowrap">vs. {clpCorto(anterior)}</span>}
      </div>
    </div>
  )
}
