import { useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Spinner from '@/components/Spinner'
import Icon from '@/components/Icon'
import { EstadoChip } from '@/features/hoy/Hoy'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from '@/components/pildora'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import type { VResumenDia } from '@/features/turno/api'
import { clp, fechaDiaMes, mesAnio, hoy } from '@/lib/format'

const PAGINA = 30
type Filtro = 'todos' | 'borradores' | 'corregidos' | 'descuadres' | 'parciales'
const FILTROS: { v: Filtro; label: string }[] = [
  { v: 'todos', label: 'Todos' }, { v: 'borradores', label: 'Borradores' }, { v: 'parciales', label: 'Falta tarde' },
  { v: 'corregidos', label: 'Corregidos' }, { v: 'descuadres', label: 'Descuadres' },
]

export default function Historial() {
  const { filtro = 'todos' } = useSearch({ from: '/app/historial' })
  const navigate = useNavigate()
  const q = useInfiniteQuery({
    queryKey: qk.historial(filtro),
    initialPageParam: 0,
    getNextPageParam: (last: VResumenDia[], all) => (last.length < PAGINA ? undefined : all.length * PAGINA),
    queryFn: async ({ pageParam }): Promise<VResumenDia[]> => {
      let s = supabase.from('v_resumen_dia').select('*').order('fecha', { ascending: false }).range(pageParam, pageParam + PAGINA - 1)
      if (filtro === 'borradores') s = s.eq('tiene_borrador', true)
      if (filtro === 'corregidos') s = s.eq('corregido', true)
      if (filtro === 'descuadres') s = s.eq('con_descuadre', true)
      if (filtro === 'parciales') s = s.eq('estado', 'parcial')
      const { data, error } = await s
      if (error) throw error
      return data as VResumenDia[]
    },
  })
  const filas = q.data?.pages.flat() ?? []
  // Agrupadas por mes, en el orden en que llegan (de la más nueva a la más antigua).
  const meses: { mes: string; dias: VResumenDia[] }[] = []
  for (const d of filas) {
    const mes = d.fecha.slice(0, 7)
    const ultimo = meses.at(-1)
    if (ultimo?.mes === mes) ultimo.dias.push(d)
    else meses.push({ mes, dias: [d] })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Historial" />
      {/* En el celular el borde derecho se desvanece: avisa que hay más filtros al deslizar. */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pr-10 pb-3 mascara-derecha md:flex-wrap md:mx-0 md:px-0 md:[mask-image:none]" role="group" aria-label="Filtro">
        {FILTROS.map((f) => (
          <button key={f.v} type="button" aria-pressed={filtro === f.v}
            onClick={() => void navigate({ to: '/historial', search: { filtro: f.v } })}
            className={`${PILDORA} ${filtro === f.v ? PILDORA_ON : PILDORA_OFF}`}>
            {f.label}
          </button>
        ))}
      </div>

      {q.isPending ? <Spinner /> : filas.length === 0 ? (
        <p className="text-center text-muted py-10">Nada que mostrar con este filtro.</p>
      ) : (
        <div className="space-y-1">
          {meses.map(({ mes, dias }, i) => {
            // El neto del mes solo si ya están todos sus días (la paginación puede cortarlo).
            const completo = i < meses.length - 1 || !q.hasNextPage
            const netoMes = dias.reduce((a, d) => a + Number(d.neto ?? 0), 0)
            const maxMes = Math.max(0, ...dias.map((d) => Math.abs(Number(d.neto ?? 0))))
            return (
              <section key={mes} aria-label={mesAnio(`${mes}-01`)}>
                <div className="sticky -top-5 z-10 -mx-4 px-4 pt-3 pb-2 bg-canvas flex items-baseline justify-between gap-3 md:mx-0 md:px-0">
                  <h2 className="eyebrow">{mesAnio(`${mes}-01`)}</h2>
                  <p className="text-xs text-muted tabular-nums whitespace-nowrap">
                    {dias.length} día{dias.length === 1 ? '' : 's'}
                    {completo && <> · neto <span className={`cifra ${netoMes < 0 ? 'text-neg' : 'text-ink2'}`}>{clp(netoMes)}</span></>}
                  </p>
                </div>
                <div className="card p-0 divide-y divide-hairline overflow-hidden">
                  {dias.map((d) => <FilaDia key={d.jornada_id} d={d} max={maxMes} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {q.hasNextPage && (
        <button type="button" className="btn-secondary w-full mt-3 min-h-[46px] rounded-[12px]" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          {q.isFetchingNextPage ? 'Cargando…' : 'Ver más días'}
        </button>
      )}
    </div>
  )
}

function FilaDia({ d, max }: { d: VResumenDia; max: number }) {
  const dia = fechaDiaMes(d.fecha).split(' ')[0]?.replace(',', '')
  const neto = Number(d.neto ?? 0)
  const proveedores = Number(d.total_proveedores ?? 0)
  const esHoy = d.fecha === hoy()
  // "Completo" es lo normal: solo se marcan las excepciones.
  const chips = d.estado !== 'completo' || d.corregido || d.con_descuadre
  return (
    <Link to="/dia" search={{ fecha: d.fecha }} className="flex items-center gap-3 px-4 py-2.5 min-h-[64px] hover:bg-soft/60 active:bg-soft">
      <div className={`w-[46px] h-[46px] shrink-0 rounded-[10px] border grid place-content-center text-center ${d.tiene_borrador ? 'bg-warn-tint border-hairline' : esHoy ? 'bg-brand-tint border-brand/30' : 'bg-soft border-hairline'}`}>
        <p className={`text-[11px] leading-none font-semibold uppercase ${esHoy && !d.tiene_borrador ? 'text-brand' : 'text-muted'}`}>{esHoy ? 'Hoy' : dia}</p>
        <p className={`font-display text-lg leading-none font-semibold tabular-nums mt-[3px] ${esHoy && !d.tiene_borrador ? 'text-brand' : 'text-ink'}`}>{Number(d.fecha.slice(8, 10))}</p>
      </div>
      <div className="flex-1 min-w-0">
        {chips && (
          <div className="flex items-center gap-1 flex-wrap mb-1.5">
            {d.estado !== 'completo' && <EstadoChip estado={d.estado} />}
            {d.corregido && <span className="badge bg-brand-tint text-brand">Corregido</span>}
            {d.con_descuadre && <span className="badge bg-neg-tint text-neg">Descuadre</span>}
          </div>
        )}
        {/* Bajo 390 px "proveedores" invade la columna del neto: se abrevia. En escritorio, una sola línea. */}
        <p className="text-xs text-muted tabular-nums flex flex-col md:flex-row md:gap-1.5">
          <span className="whitespace-nowrap">{clp(d.total_ventas)} ventas</span>
          <span className="hidden md:inline" aria-hidden="true">·</span>
          {proveedores > 0
            ? <span className="whitespace-nowrap">−{clp(proveedores)} <span className="max-[389px]:hidden">proveedores</span><span className="min-[390px]:hidden">prov.</span></span>
            : <span className="whitespace-nowrap">sin proveedores</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className={`block cifra text-base min-[390px]:text-lg leading-tight ${neto >= 0 ? 'text-ink' : 'text-neg'}`}>{clp(neto)}</span>
        <span className="block text-[11px] text-muted">neto</span>
        {/* Tamaño relativo al mejor día del mes; mismo código de color que el gráfico de Análisis. */}
        {max > 0 && (
          <span className="flex justify-end mt-1" aria-hidden="true">
            <span className={`block h-[3px] rounded-full ${neto < 0 ? 'bg-neg' : d.tiene_borrador ? 'bg-warn' : 'bg-brand'}`}
              style={{ width: `${Math.max(4, (Math.abs(neto) / max) * 64)}px` }} />
          </span>
        )}
      </div>
      <Icon name="chevR" className="w-[15px] h-[15px] text-muted2 shrink-0" />
    </Link>
  )
}
