import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { DeltaBadge } from '@/components/DeltaBadge'
import { ProveedorAvatar } from '@/components/ProveedorAvatar'
import { useMetodos } from '@/features/catalogo/api'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { clp, clpCorto, fechaISO, hoy, sumarDias, fechaDiaMes, fechaCorta } from '@/lib/format'
import { descargarCSV } from '@/lib/csv'
import type { VResumenDia } from '@/features/turno/api'

interface Totales { total_ventas: number; total_proveedores: number; neto: number; efectivo_neto: number; dias_con_registro: number; dias_con_borrador?: number; [k: string]: number | undefined }
interface Resumen {
  desde: string; hasta: string
  dias: VResumenDia[]
  totales: Totales
  anterior: Totales
  top_proveedores: { proveedor_id: string | null; nombre: string; imagen_url: string | null; monto: number; compras: number }[]
}

function rango(preset: '7' | '30' | 'mes'): { desde: string; hasta: string } {
  const h = hoy()
  if (preset === 'mes') { const d = new Date(); return { desde: fechaISO(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: h } }
  return { desde: sumarDias(h, preset === '7' ? -6 : -29), hasta: h }
}

export default function Analisis() {
  const search = useSearch({ from: '/app/analisis' })
  const navigate = useNavigate()
  const { desde, hasta } = search.desde && search.hasta ? { desde: search.desde, hasta: search.hasta } : rango('7')
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
  const dias = useMemo(() => (r?.dias ?? []).map((d) => ({ ...d, label: fechaDiaMes(d.fecha).replace('.', ''), neto: Number(d.neto), total_ventas: Number(d.total_ventas) })), [r])
  const presetActivo = (['7', '30', 'mes'] as const).find((p) => { const x = rango(p); return x.desde === desde && x.hasta === hasta })

  function exportar() {
    if (!r) return
    const ms = metodos.data ?? []
    descargarCSV(`frytcontrol_${desde}_${hasta}.csv`,
      ['Fecha', 'Estado', ...ms.map((m) => m.label), 'Total ventas', 'Prov. efectivo', 'Prov. transferencia', 'Total proveedores', 'Neto', 'Efectivo esperado'],
      r.dias.map((d) => [fechaCorta(d.fecha), d.estado, ...ms.map((m) => Number((d as unknown as Record<string, unknown>)[m.key] ?? 0)), d.total_ventas, d.prov_efectivo, d.prov_transferencia, d.total_proveedores, d.neto, d.efectivo_esperado]))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="FrytControl" title="Análisis" action={<button type="button" onClick={exportar} disabled={!r} className="btn-secondary px-3" aria-label="Exportar CSV"><Icon name="download" className="w-[18px] h-[18px]" />CSV</button>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['7', '30', 'mes'] as const).map((p) => (
          <button key={p} type="button" onClick={() => void navigate({ to: '/analisis', search: rango(p) })}
            className={`min-h-[38px] rounded-full px-4 text-[13px] font-semibold border ${presetActivo === p ? 'bg-brand text-white border-brand' : 'bg-card text-ink2 border-hairline'}`}>
            {p === 'mes' ? 'Este mes' : `${p} días`}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto text-[13px]">
          <input type="date" aria-label="Desde" className="input py-1.5 min-h-[38px] w-[140px]" value={desde} max={hasta} onChange={(e) => e.target.value && void navigate({ to: '/analisis', search: { desde: e.target.value, hasta } })} />
          <span className="text-muted">→</span>
          <input type="date" aria-label="Hasta" className="input py-1.5 min-h-[38px] w-[140px]" value={hasta} min={desde} max={hoy()} onChange={(e) => e.target.value && void navigate({ to: '/analisis', search: { desde, hasta: e.target.value } })} />
        </div>
      </div>

      {q.isPending || !r ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            <Kpi label="Ventas" value={r.totales.total_ventas} anterior={r.anterior.total_ventas} />
            <Kpi label="Proveedores" value={r.totales.total_proveedores} anterior={r.anterior.total_proveedores} invertir />
            <Kpi label="Neto" value={r.totales.neto} anterior={r.anterior.neto} destacado />
            <Kpi label="Caja (efectivo neto)" value={r.totales.efectivo_neto} anterior={r.anterior.efectivo_neto} />
          </div>
          <p className="text-[12px] text-muted mb-4">
            {r.totales.dias_con_registro} día{r.totales.dias_con_registro === 1 ? '' : 's'} con registro · comparado con el período anterior del mismo largo
            {r.totales.dias_con_borrador ? <> · <b className="text-warn">{r.totales.dias_con_borrador} con borrador</b></> : null}
          </p>

          <div className="card mb-4">
            <p className="eyebrow mb-3">Neto por día</p>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dias} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={clpCorto} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={48} />
                  <Tooltip cursor={{ fill: 'var(--soft)', radius: 6 }} content={<TooltipDia />} />
                  <Bar dataKey="neto" radius={[6, 6, 0, 0]}>
                    {dias.map((d) => <Cell key={d.fecha} fill={d.neto >= 0 ? 'var(--pos)' : 'var(--neg)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card">
              <p className="eyebrow mb-3">Ventas por método</p>
              {(metodos.data ?? []).map((m) => {
                const monto = Number(r.totales[m.key] ?? 0)
                const pct = r.totales.total_ventas ? (monto / r.totales.total_ventas) * 100 : 0
                return (
                  <div key={m.key} className="mb-2.5">
                    <div className="flex items-center justify-between text-[13px]"><span className="text-ink2">{m.label}</span><span className="font-semibold tabular-nums text-ink">{clp(monto)} <span className="text-muted2 text-[11px]">{pct.toFixed(0)}%</span></span></div>
                    <div className="h-1.5 rounded-full bg-soft mt-1"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} /></div>
                  </div>
                )
              })}
            </div>
            <div className="card">
              <p className="eyebrow mb-3">Top proveedores</p>
              {r.top_proveedores.length === 0 ? <p className="text-sm text-muted">Sin compras en el período.</p> : r.top_proveedores.map((p) => (
                <Link key={p.proveedor_id ?? p.nombre} to={p.proveedor_id ? '/proveedores/$id' : '/proveedores'} params={{ id: p.proveedor_id ?? '' }} className="flex items-center gap-3 py-2 border-b border-soft last:border-0">
                  <ProveedorAvatar nombre={p.nombre} imagenUrl={p.imagen_url} size="sm" />
                  <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-medium text-ink truncate">{p.nombre}</span><span className="block text-[11px] text-muted">{p.compras} compra{p.compras === 1 ? '' : 's'}</span></span>
                  <span className="font-semibold tabular-nums text-ink text-[13.5px]">{clp(p.monto)}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Tooltip del gráfico con los tokens del tema (el de recharts venía en gris sobre gris). */
function TooltipDia({ active, payload }: { active?: boolean; payload?: { payload?: Record<string, unknown> }[] }) {
  const d = payload?.[0]?.payload as (VResumenDia & { neto: number; total_ventas: number }) | undefined
  if (!active || !d) return null
  const neto = Number(d.neto)
  return (
    <div className="rounded-xl bg-card border border-hairline shadow-hero px-3 py-2 text-[12.5px] min-w-[170px]">
      <p className="font-semibold text-ink capitalize mb-1">{fechaDiaMes(d.fecha)}</p>
      <p className="flex justify-between gap-4 text-ink2"><span>Ventas</span><b className="tabular-nums text-ink">{clp(d.total_ventas)}</b></p>
      <p className="flex justify-between gap-4 text-ink2"><span>Proveedores</span><b className="tabular-nums text-ink">{clp(d.total_proveedores)}</b></p>
      <p className={`flex justify-between gap-4 pt-1 mt-1 border-t border-hairline font-bold ${neto >= 0 ? 'text-pos' : 'text-neg'}`}><span>Neto</span><span className="tabular-nums">{clp(neto)}</span></p>
      {d.estado !== 'completo' && <p className="text-[11px] text-warn mt-1">{d.estado === 'borrador' ? 'Con borrador' : d.estado === 'parcial' ? 'Falta la tarde' : ''}</p>}
    </div>
  )
}

function Kpi({ label, value, anterior, destacado, invertir }: { label: string; value: number; anterior: number | null; destacado?: boolean; invertir?: boolean }) {
  return (
    <div className={`card p-4 ${destacado ? 'bg-brand-tint border-brand/30' : ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`amount text-[24px] leading-tight mt-1 ${value < 0 ? 'text-neg' : 'text-ink'}`}>{clp(value)}</p>
      <div className="mt-1 min-h-[16px]">{invertir ? <DeltaBadge actual={-value} anterior={anterior == null ? null : -anterior} /> : <DeltaBadge actual={value} anterior={anterior} />}</div>
    </div>
  )
}
