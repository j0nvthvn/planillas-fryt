import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from '@/components/BottomSheet'
import Icon, { type IconName } from '@/components/Icon'
import { useToast } from '@/components/Toast'
import { archivoCSV } from '@/lib/csv'
import { entregarArchivo, puedeCompartirArchivos } from '@/lib/archivo'
import { mensajeDeError } from '@/lib/errorLog'
import { fechaCorta } from '@/lib/format'
import { opcionesDatos, type DatosExportacion } from './datos'
import { tablaCompras, tablaCuadre, tablaDias, tablaIndicadores, tablaMetodos, tablaPorProveedor, tablaTurnos, type Resumen } from './tablas'

type Formato = 'excel' | 'turnos' | 'compras'

const OPCIONES: { id: Formato; icon: IconName; titulo: string; detalle: string }[] = [
  { id: 'excel', icon: 'summary', titulo: 'Excel completo', detalle: 'Resumen, días, turnos, compras y proveedores en hojas separadas' },
  { id: 'turnos', icon: 'note', titulo: 'CSV por turno', detalle: 'Ventas por método, proveedores y cuadre de caja de cada turno' },
  { id: 'compras', icon: 'suppliers', titulo: 'CSV de compras a proveedores', detalle: 'Una fila por compra, con fecha, turno y forma de pago' },
]

export function ExportarSheet({ resumen, onClose }: { resumen: Resumen; onClose: () => void }) {
  const { desde, hasta } = resumen
  const qc = useQueryClient()
  const toast = useToast()
  const [ocupado, setOcupado] = useState<Formato | null>(null)
  const [compartible] = useState(puedeCompartirArchivos)
  const [compartir, setCompartir] = useState(true)
  const borradores = resumen.totales.dias_con_borrador ?? 0
  const base = `frytcontrol_${desde}_${hasta}`

  async function exportar(formato: Formato) {
    setOcupado(formato)
    try {
      const datos: DatosExportacion = await qc.fetchQuery(opcionesDatos(desde, hasta))
      let file: File
      if (formato === 'turnos') file = archivoCSV(`${base}_turnos.csv`, tablaTurnos(datos.turnos, datos.metodos))
      else if (formato === 'compras') file = archivoCSV(`${base}_compras.csv`, tablaCompras(datos.compras))
      else {
        const { libroExcel } = await import('./xlsx')
        file = await libroExcel([
          { nombre: 'Resumen', tablas: [tablaIndicadores(resumen), tablaMetodos(resumen, datos.metodos)] },
          { nombre: 'Días', tablas: [tablaDias(resumen.dias, datos.metodos)], fijarEncabezado: true },
          { nombre: 'Turnos', tablas: [tablaTurnos(datos.turnos, datos.metodos)], fijarEncabezado: true },
          { nombre: 'Cuadre de caja', tablas: [tablaCuadre(datos.turnos)], fijarEncabezado: true },
          { nombre: 'Compras', tablas: [tablaCompras(datos.compras)], fijarEncabezado: true },
          { nombre: 'Por proveedor', tablas: [tablaPorProveedor(datos.compras)], fijarEncabezado: true },
        ], `${base}.xlsx`)
      }
      const res = await entregarArchivo(file, { compartir: compartible && compartir })
      if (res === 'descargado') toast.ok(`Descargado: ${file.name}`)
      if (res !== 'cancelado') onClose()
    } catch (e) {
      toast.error(`No se pudo exportar: ${mensajeDeError(e)}`)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <BottomSheet title="Exportar" onClose={onClose}>
      <p className="text-sm text-muted">Del {fechaCorta(desde)} al {fechaCorta(hasta)}</p>
      {borradores > 0 && (
        <p role="status" className="text-sm font-medium text-warn bg-warn-tint border border-hairline rounded-[12px] px-3.5 py-2.5">
          {borradores} día{borradores === 1 ? '' : 's'} con borrador: esos montos todavía pueden cambiar.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {OPCIONES.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => void exportar(o.id)} disabled={ocupado !== null}
              className="w-full flex items-center gap-3 text-left rounded-[14px] border border-hairline-strong bg-card px-4 py-3 min-h-[64px] hover:bg-soft disabled:opacity-60">
              <span className="w-10 h-10 shrink-0 rounded-[11px] grid place-items-center bg-brand-tint text-brand"><Icon name={o.icon} className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-ink">{o.titulo}{o.id === 'excel' && <span className="badge ml-2 bg-pos-tint text-pos">Recomendado</span>}</span>
                <span className="block text-xs text-muted">{ocupado === o.id ? 'Preparando…' : o.detalle}</span>
              </span>
              <Icon name={compartible && compartir ? 'chevR' : 'download'} className="w-4 h-4 text-muted shrink-0" />
            </button>
          </li>
        ))}
        <li>
          <Link to="/analisis/reporte" search={{ desde, hasta }} onClick={onClose}
            className="w-full flex items-center gap-3 rounded-[14px] border border-hairline-strong bg-card px-4 py-3 min-h-[64px] hover:bg-soft">
            <span className="w-10 h-10 shrink-0 rounded-[11px] grid place-items-center bg-brand-tint text-brand"><Icon name="chart" className="w-5 h-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-ink">Reporte para imprimir o PDF</span>
              <span className="block text-xs text-muted">Resumen del período en una página, listo para guardar como PDF</span>
            </span>
            <Icon name="chevR" className="w-4 h-4 text-muted shrink-0" />
          </Link>
        </li>
      </ul>
      {compartible && (
        <label className="flex items-center gap-2 text-sm text-ink2 py-1">
          <input type="checkbox" className="w-5 h-5 accent-[var(--brand)]" checked={compartir} onChange={(e) => setCompartir(e.target.checked)} />
          Compartir al terminar (WhatsApp, correo, Drive)
        </label>
      )}
    </BottomSheet>
  )
}
