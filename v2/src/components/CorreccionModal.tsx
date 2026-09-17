import { BottomSheet } from './BottomSheet'
import Icon from './Icon'
import { clp, fechaHora } from '@/lib/format'
import { METODO_KEYS } from '@/lib/totales'
import type { Cierre } from '@/features/turno/api'
import type { MetodoPago } from '@/features/catalogo/api'

interface Snap { nombre: string; monto: number; forma_pago: string }

function lista(v: unknown): Snap[] {
  return Array.isArray(v) ? (v as Snap[]) : []
}
function ventas(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}

function ListaProveedores({ items, titulo }: { items: Snap[]; titulo: string }) {
  const total = items.reduce((s, p) => s + (+p.monto || 0), 0)
  return (
    <div>
      <p className="eyebrow mb-1.5">{titulo}</p>
      {items.length === 0 ? <p className="text-xs text-muted2 italic">Sin proveedores</p> : (
        <div className="space-y-1">
          {items.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-ink2 truncate">{p.nombre}</span>
              <span className={`badge rounded-[6px] px-1.5 py-[3px] ${p.forma_pago === 'efectivo' ? 'bg-pos-tint text-pos' : 'bg-brand-tint text-brand'}`}>{p.forma_pago === 'efectivo' ? 'Ef.' : 'Tr.'}</span>
              <span className="text-ink font-semibold tabular-nums">{clp(p.monto)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs pt-1 border-t border-soft mt-1">
            <span className="flex-1 font-bold text-ink">Total</span><span className="font-bold text-ink tabular-nums">{clp(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Original vs. estado actual de un turno corregido, a partir de las
 * fotografías inmutables de turno_cierres.
 */
export function CorreccionModal({ cierres, metodos, titulo, onClose }: { cierres: Cierre[]; metodos: MetodoPago[]; titulo: string; onClose: () => void }) {
  const orden = [...cierres].sort((a, b) => a.cerrado_en.localeCompare(b.cerrado_en))
  const original = orden[0]
  const actual = orden[orden.length - 1]
  if (!original || !actual) return null
  const vo = ventas(original.ventas_snapshot)
  const va = ventas(actual.ventas_snapshot)
  const filas = METODO_KEYS.map((k) => ({ key: k, label: metodos.find((m) => m.key === k)?.label ?? k, antes: +(vo[k] ?? 0), despues: +(va[k] ?? 0) })).filter((f) => f.antes !== f.despues)
  // La caja también forma parte de la fotografía del cierre.
  const caja = [
    { key: 'esperado', label: 'Efectivo esperado', antes: original.efectivo_esperado, despues: actual.efectivo_esperado },
    { key: 'contado', label: 'Efectivo contado', antes: original.efectivo_contado, despues: actual.efectivo_contado },
  ].filter((f) => (f.antes ?? null) !== (f.despues ?? null)).map((f) => ({ ...f, antes: f.antes ?? 0, despues: f.despues ?? 0 }))
  const provsIguales = JSON.stringify(original.proveedores_snapshot) === JSON.stringify(actual.proveedores_snapshot)
  const correcciones = orden.length - 1
  const sinCambios = filas.length === 0 && caja.length === 0 && provsIguales

  return (
    <BottomSheet title={titulo} onClose={onClose}>
      <p className="text-xs text-muted -mt-1">{correcciones} corrección{correcciones === 1 ? '' : 'es'} desde el cierre original</p>
      <div className="text-xs text-muted bg-soft border border-hairline rounded-[12px] px-3 py-2">Original · {fechaHora(original.cerrado_en)} · {original.cerrado_por_usuario?.nombre ?? '—'}</div>
      {sinCambios && <p className="text-sm text-ink2 bg-soft rounded-xl px-3 py-2">Se volvió a guardar el turno sin cambios en ventas, proveedores ni caja.</p>}
      {(filas.length > 0 || caja.length > 0) ? (
        <div className="space-y-2">
          <p className="eyebrow">Qué cambió</p>
          {[...filas, ...caja].map((f) => {
            const delta = f.despues - f.antes
            return (
              <div key={f.key} className="flex items-center gap-2.5 text-sm">
                <span className="flex-1 text-ink2">{f.label}</span>
                <span className="text-muted2 tabular-nums line-through">{clp(f.antes)}</span>
                <Icon name="chevR" className="w-3 h-3 text-muted2" />
                <span className="font-bold text-ink tabular-nums">{clp(f.despues)}</span>
                <span className={`text-xs font-semibold tabular-nums ${delta > 0 ? 'text-pos' : 'text-neg'}`}>({delta > 0 ? '+' : ''}{clp(delta)})</span>
              </div>
            )
          })}
        </div>
      ) : !sinCambios && <p className="text-xs text-muted2 italic">Las ventas y la caja no cambiaron.</p>}
      <div className="grid grid-cols-2 gap-4">
        <ListaProveedores items={lista(original.proveedores_snapshot)} titulo="Proveedores (original)" />
        <ListaProveedores items={lista(actual.proveedores_snapshot)} titulo="Proveedores (actual)" />
      </div>
      {correcciones > 0 && (
        <div className="text-xs font-medium text-info bg-info-tint border border-hairline rounded-[12px] px-3 py-2">Última corrección · {fechaHora(actual.cerrado_en)} · {actual.cerrado_por_usuario?.nombre ?? '—'}</div>
      )}
    </BottomSheet>
  )
}
