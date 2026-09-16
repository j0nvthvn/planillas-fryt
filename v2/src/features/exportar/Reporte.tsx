import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import Icon from '@/components/Icon'
import Spinner from '@/components/Spinner'
import { DeltaBadge } from '@/components/DeltaBadge'
import { supabase } from '@/lib/supabase'
import { qk } from '@/lib/query'
import { clp, fechaCorta, fechaHora, ajustarRango } from '@/lib/format'
import { mensajeDeError } from '@/lib/errorLog'
import { useDatosExportacion } from './datos'
import { tablaCuadre, tablaDiasCompacta, tablaMetodos, tablaPorProveedor, type Resumen, type Tabla, type Valor, type TipoColumna } from './tablas'

/**
 * Reporte del período para imprimir o guardar como PDF (desde el diálogo de
 * impresión del navegador). Vive fuera del Layout: sin barra de navegación
 * y sin el contenedor con scroll, que cortaría la impresión.
 */
export default function Reporte() {
  const search = useSearch({ from: '/analisis/reporte' })
  const { desde, hasta } = ajustarRango(search.desde, search.hasta)
  const resumen = useQuery({
    queryKey: qk.resumenPeriodo(desde, hasta),
    queryFn: async (): Promise<Resumen> => {
      const { data, error } = await supabase.rpc('resumen_periodo', { p_desde: desde, p_hasta: hasta })
      if (error) throw error
      return data as unknown as Resumen
    },
  })
  const datos = useDatosExportacion(desde, hasta)

  useEffect(() => {
    const anterior = document.title
    document.title = `FrytControl ${desde} a ${hasta}`
    return () => { document.title = anterior }
  }, [desde, hasta])

  const r = resumen.data
  const d = datos.data
  const error = resumen.error ?? datos.error

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-card border-b border-hairline">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <Link to="/analisis" search={{ desde, hasta }} className="btn-ghost px-2"><Icon name="arrowLeft" className="w-5 h-5" />Análisis</Link>
          <button type="button" onClick={() => window.print()} disabled={!r || !d} className="btn-primary px-4">
            <Icon name="download" className="w-[18px] h-[18px]" />Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 print:p-0 print:max-w-none text-ink">
        <header className="mb-5 flex items-end justify-between gap-3 border-b-2 border-brand pb-3">
          <div>
            <p className="eyebrow text-brand">Minimarket Fryt · FrytControl</p>
            <h1 className="text-2xl font-bold">Reporte del {fechaCorta(desde)} al {fechaCorta(hasta)}</h1>
          </div>
          <p className="text-xs text-muted text-right">Generado el {fechaHora(new Date().toISOString())}</p>
        </header>

        {error ? <p role="alert" className="text-neg">No se pudo cargar el reporte: {mensajeDeError(error)}</p>
          : !r || !d ? <Spinner /> : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-2 mb-2">
              <Kpi label="Ventas" value={r.totales.total_ventas} anterior={r.anterior.total_ventas} />
              <Kpi label="Proveedores" value={r.totales.total_proveedores} anterior={r.anterior.total_proveedores} invertir />
              <Kpi label="Neto" value={r.totales.neto} anterior={r.anterior.neto} />
              <Kpi label="Efectivo neto" value={r.totales.efectivo_neto} anterior={r.anterior.efectivo_neto} />
            </section>
            <p className="text-xs text-muted mb-5">
              {r.totales.dias_con_registro} día{r.totales.dias_con_registro === 1 ? '' : 's'} con registro · variación contra el período anterior del mismo largo
              {r.totales.dias_con_borrador ? <> · <b className="text-warn">{r.totales.dias_con_borrador} con borrador (montos no definitivos)</b></> : null}
            </p>

            <TablaHtml tabla={tablaMetodos(r, d.metodos)} />
            <TablaHtml tabla={tablaDiasCompacta(r.dias)} />
            <TablaHtml tabla={tablaPorProveedor(d.compras)} vacio="Sin compras a proveedores en el período." />
            <TablaHtml tabla={tablaCuadre(d.turnos)} vacio="Sin turnos cerrados en el período." resaltarNegativos
              nota={d.turnos.some((t) => t.efectivo_contado != null) ? undefined : 'Ningún turno del período registró conteo de caja: no hay diferencias que mostrar.'} />
          </>
        )}
      </main>
    </div>
  )
}

function Kpi({ label, value, anterior, invertir }: { label: string; value: number; anterior: number; invertir?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-card px-3 py-2 print:break-inside-avoid">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className={`cifra text-lg ${value < 0 ? 'text-neg' : ''}`}>{clp(value)}</p>
      <div className="min-h-[16px]">{invertir ? <DeltaBadge actual={-value} anterior={-anterior} /> : <DeltaBadge actual={value} anterior={anterior} />}</div>
    </div>
  )
}

function formatear(v: Valor, tipo: TipoColumna): string {
  if (v === null || v === '') return ''
  if (typeof v === 'string') return tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fechaCorta(v) : v
  if (tipo === 'monto') return clp(v)
  if (tipo === 'pct') return `${(v * 100).toFixed(0)}%`
  return String(v)
}

function TablaHtml({ tabla, vacio, nota, resaltarNegativos }: { tabla: Tabla; vacio?: string; nota?: string; resaltarNegativos?: boolean }) {
  const alinear = (t: TipoColumna) => (t === 'texto' || t === 'fecha' ? 'text-left' : 'text-right')
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold mb-2 print:break-after-avoid">{tabla.titulo}</h2>
      {nota && tabla.filas.length > 0 && <p className="text-xs text-muted mb-2">{nota}</p>}
      {tabla.filas.length === 0 ? <p className="text-sm text-muted">{vacio ?? 'Sin datos.'}</p> : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm print:text-xs tabular-nums border-collapse">
            <thead>
              <tr className="border-b border-ink/30">
                {tabla.columnas.map((c) => <th key={c.titulo} scope="col" className={`py-1.5 px-2 font-semibold whitespace-nowrap ${alinear(c.tipo)}`}>{c.titulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f, i) => (
                <tr key={i} className="border-b border-hairline print:break-inside-avoid">
                  {f.map((v, j) => {
                    const tipo = tabla.columnas[j]?.tipo ?? 'texto'
                    const rojo = resaltarNegativos && typeof v === 'number' && v !== 0 && j === f.length - 1
                    return <td key={j} className={`py-1 px-2 whitespace-nowrap ${alinear(tipo)} ${rojo ? 'text-neg font-semibold' : ''}`}>{formatear(v, tipo)}</td>
                  })}
                </tr>
              ))}
              {/* En el cuerpo y no en <tfoot>: Chrome repite el tfoot en cada página impresa. */}
              {tabla.total?.some((v) => typeof v === 'number') && (
                <tr className="border-t-2 border-ink/40 font-bold print:break-inside-avoid">
                  {tabla.total.map((v, j) => <td key={j} className={`py-1.5 px-2 whitespace-nowrap ${alinear(tabla.columnas[j]?.tipo ?? 'texto')}`}>{formatear(v, tabla.columnas[j]?.tipo ?? 'texto')}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
