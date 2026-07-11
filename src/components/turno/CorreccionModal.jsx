import { clp } from '../../utils/format'
import { METODOS_VENTA } from '../TurnoInput'
import Icon from '../Icon'

const FORM_COLORS = { efectivo: '#1E7A4F', transferencia: '#33518C' }
const FORM_LABELS = { efectivo: 'Ef.', transferencia: 'Tr.' }

function fechaHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** Fila "antes → después" para un método de venta, solo si cambió. */
function FilaVenta({ metodo, antes, despues }) {
  if (antes === despues) return null
  const delta = despues - antes
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="flex-1 text-ink2">{metodo.label}</span>
      <span className="text-muted2 tabular-nums line-through">{clp(antes)}</span>
      <Icon name="chevR" className="w-3 h-3 text-muted2" />
      <span className="font-bold text-ink tabular-nums">{clp(despues)}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${delta > 0 ? 'text-pos' : 'text-neg'}`}>
        ({delta > 0 ? '+' : ''}{clp(delta)})
      </span>
    </div>
  )
}

function ListaProveedores({ proveedores, titulo }) {
  const lista = proveedores || []
  const total = lista.reduce((s, p) => s + (+p.monto || 0), 0)
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted2 mb-1.5 min-h-[33px]">{titulo}</p>
      {lista.length === 0 ? (
        <p className="text-[12px] text-muted2 italic">Sin proveedores</p>
      ) : (
        <div className="space-y-1">
          {lista.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[12.5px]">
              <span className="flex-1 text-ink2 truncate">{p.nombre}</span>
              <span
                className="text-[9px] font-bold rounded-full px-1.5 py-0.5"
                style={{ background: `${FORM_COLORS[p.forma_pago] || '#5C3317'}15`, color: FORM_COLORS[p.forma_pago] || '#5C3317' }}
              >
                {FORM_LABELS[p.forma_pago] || p.forma_pago}
              </span>
              <span className="text-ink font-semibold tabular-nums">{clp(p.monto)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[12.5px] pt-1 border-t border-soft mt-1">
            <span className="flex-1 font-bold text-ink">Total</span>
            <span className="font-bold text-ink tabular-nums">{clp(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Muestra la comparación entre el cierre original de un turno y su
 * estado actual (después de una o más correcciones): qué cambió en
 * las ventas por método, y cómo quedaron los proveedores en cada
 * versión. Los datos vienen de los snapshots inmutables en
 * turno_cierres — no se recalculan, son exactamente lo que se guardó
 * en cada cierre/corrección.
 */
export function CorreccionModal({ turno, onClose }) {
  const cierres = [...(turno?.cierres || [])].sort((a, b) => new Date(a.cerrado_en) - new Date(b.cerrado_en))
  if (cierres.length === 0) return null
  const original = cierres[0]
  const actual = cierres[cierres.length - 1]
  const huboCorreccion = cierres.some((c) => c.es_correccion)

  const filas = METODOS_VENTA
    .map((m) => ({ metodo: m, antes: +(original.ventas_snapshot?.[m.key] || 0), despues: +(actual.ventas_snapshot?.[m.key] || 0) }))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink capitalize">Turno {turno.tipo}</h3>
              <p className="text-[12px] text-muted mt-0.5">
                {huboCorreccion ? `${cierres.length - 1} corrección${cierres.length - 1 === 1 ? '' : 'es'} desde el cierre original` : 'Sin correcciones'}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-hairline text-ink2 shrink-0" aria-label="Cerrar">
              <Icon name="close" className="w-[15px] h-[15px]" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[12px] text-muted bg-canvas rounded-xl px-3 py-2">
            <span>Original · {fechaHora(original.cerrado_en)} · {original.cerrado_por_usuario?.nombre || 'Desconocido'}</span>
          </div>

          {filas.some((f) => f.antes !== f.despues) ? (
            <div className="space-y-2">
              <p className="eyebrow">Ventas — qué cambió</p>
              {filas.map((f) => <FilaVenta key={f.metodo.key} metodo={f.metodo} antes={f.antes} despues={f.despues} />)}
            </div>
          ) : (
            <p className="text-[12px] text-muted2 italic">Las ventas no cambiaron.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ListaProveedores proveedores={original.proveedores_snapshot} titulo="Proveedores (original)" />
            <ListaProveedores proveedores={actual.proveedores_snapshot} titulo="Proveedores (actual)" />
          </div>

          {huboCorreccion && (
            <div className="flex items-center justify-between text-[12px] text-info bg-info-tint border border-info/30 rounded-xl px-3 py-2">
              <span>Última corrección · {fechaHora(actual.cerrado_en)} · {actual.cerrado_por_usuario?.nombre || 'Desconocido'}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
