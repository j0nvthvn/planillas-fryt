import { BottomSheet } from '@/components/BottomSheet'
import Icon from '@/components/Icon'
import { Ledger, LedgerHead, LedgerLine, LedgerTotal } from '@/components/Ledger'
import { clpSigno } from '@/lib/format'
import type { MetodoKey } from '@/lib/totales'
import type { Modo } from './api'
import { etiquetaCerrar } from './modo'
import { avisosCierre, type DatosRevision } from './revision'
import type { LineaForm } from './useTurnoForm'

interface Props {
  modo: Modo
  yaCerrado: boolean
  metodos: { key: string; label: string }[]
  ventas: Record<MetodoKey, number>
  proveedores: LineaForm[]
  trabajador: string | null
  datos: DatosRevision
  totales: { total_ventas: number; total_proveedores: number; neto: number; efectivo_esperado: number }
  fondoInicial: number
  efectivoContado: number | null
  guardando: boolean
  onConfirmar: () => void
  onClose: () => void
}

/**
 * Última mirada antes de cerrar: el resumen completo y lo que falta. El
 * botón de la barra ya no cierra de inmediato; se pasa por acá.
 */
export function RevisionSheet({
  modo, yaCerrado, metodos, ventas, proveedores, trabajador, datos, totales,
  fondoInicial, efectivoContado, guardando, onConfirmar, onClose,
}: Props) {
  const avisos = avisosCierre(datos)
  const conMonto = metodos.filter((m) => (ventas[m.key as MetodoKey] ?? 0) > 0)
  const que = modo === 'completo' ? 'del día' : `del turno ${modo}`

  return (
    <BottomSheet title={yaCerrado ? 'Revisar la corrección' : 'Revisar antes de cerrar'} onClose={onClose}>
      {yaCerrado && (
        <p className="rounded-2xl bg-info-tint border border-info/30 px-4 py-2.5 text-sm text-info">
          Se guardará una <b>corrección</b>: queda registrada la versión anterior y la nueva.
        </p>
      )}

      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {avisos.map((a) => (
            <li key={a.id} className={`flex items-start gap-2 rounded-2xl px-4 py-2.5 text-sm ${a.tono === 'neg' ? 'bg-neg-tint text-neg' : 'bg-warn-tint text-warn'}`}>
              <Icon name="warning" className="w-[18px] h-[18px] shrink-0 mt-px" />
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      <Ledger>
        <LedgerHead label={`Resumen ${que}`} />
        <LedgerLine label="Atendió" value={null} hint={trabajador ?? 'sin registrar'} />
        {conMonto.length === 0
          ? <LedgerLine label="Ventas" value={0} muted />
          : conMonto.map((m) => <LedgerLine key={m.key} label={m.label} value={ventas[m.key as MetodoKey] ?? 0} />)}
        <LedgerTotal label="Total ventas" value={totales.total_ventas} size="sm" />
        <LedgerHead label="Proveedores" />
        {proveedores.length === 0
          ? <LedgerLine label="Sin proveedores pagados" value={0} muted />
          : proveedores.map((p) => (
            <LedgerLine key={p.key} label={p.nombre} value={p.monto} dot={p.forma_pago === 'efectivo' ? 'pos' : 'info'}
              hint={p.forma_pago === 'efectivo' ? 'efectivo' : 'transf.'} />
          ))}
        <LedgerTotal label="Total proveedores" value={totales.total_proveedores} size="sm" />
        <LedgerHead label="Caja" />
        <LedgerLine label="Fondo inicial" value={fondoInicial} />
        <LedgerLine label="Efectivo esperado" value={totales.efectivo_esperado} />
        <LedgerLine label="Contado" value={efectivoContado}
          hint={datos.diferenciaCaja == null ? 'sin conteo' : datos.diferenciaCaja === 0 ? 'cuadra' : clpSigno(datos.diferenciaCaja)}
          color={datos.diferenciaCaja == null ? undefined : datos.diferenciaCaja === 0 ? 'var(--pos)' : 'var(--neg)'} />
        <LedgerTotal label={`Neto ${que}`} value={totales.neto} color={totales.neto >= 0 ? undefined : 'var(--neg)'} />
      </Ledger>

      <div className="flex gap-2 pt-1 pb-1">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={guardando}>Revisar</button>
        <button type="button" className="btn-primary flex-[2]" onClick={onConfirmar} disabled={guardando}>
          {guardando ? 'Guardando…' : etiquetaCerrar(modo, yaCerrado)}
        </button>
      </div>
    </BottomSheet>
  )
}
