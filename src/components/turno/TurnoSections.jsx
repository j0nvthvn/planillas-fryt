import { clp } from '../../utils/format'
import Icon from '../Icon'
import {
  METODOS_VENTA, ProveedorAvatar, MetodoLogo,
} from '../TurnoInput'

const FORM_COLORS = { efectivo: '#1E7A4F', transferencia: '#33518C' }
const FORM_LABELS = { efectivo: 'Ef.', transferencia: 'Tr.' }

function ProveedorRow({ p, onEdit }) {
  return (
    <button onClick={onEdit} className="w-full flex items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0">
      <ProveedorAvatar nombre={p.nombre} imagen_url={p.imagen_url} size="sm" />
      <span className="flex-1 min-w-0 text-[14px] font-semibold text-ink truncate">{p.nombre}</span>
      <span
        className="text-[10px] font-bold rounded-full px-2.5 py-0.5"
        style={{ background: `${FORM_COLORS[p.forma_pago] || '#5C3317'}15`, color: FORM_COLORS[p.forma_pago] || '#5C3317' }}
      >
        {FORM_LABELS[p.forma_pago] || p.forma_pago}
      </span>
      <span className="text-[14px] font-semibold text-ink tabular-nums min-w-[90px] text-right">{clp(p.monto)}</span>
      <Icon name="pencil" className="w-3.5 h-3.5 text-muted2" stroke={1.8} />
    </button>
  )
}

export function ProveedoresSection({ provs, onAdd, onEdit, accent, accentTint }) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between px-1 mb-2.5">
        <p className="eyebrow">Proveedores</p>
        {provs.length > 0 && (
          <AmountTotal value={provs.reduce((s, p) => s + p.monto, 0)} />
        )}
      </div>
      {provs.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full rounded-2xl border border-dashed border-hairline py-6 text-[13px] font-semibold text-muted2 hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" stroke={1.8} />
          Añadir proveedor
        </button>
      ) : (
        <div className="card !p-4 divide-y divide-soft">
          {provs.map((p, i) => (
            <ProveedorRow key={`${p.nombre}-${i}`} p={p} onEdit={() => onEdit(i)} />
          ))}
          <button
            onClick={onAdd}
            className="w-full mt-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5"
            style={{ background: accentTint, color: accent }}
          >
            <Icon name="plus" className="w-4 h-4" stroke={2} />
            Añadir proveedor
          </button>
        </div>
      )}
    </section>
  )
}

function AmountTotal({ value }) {
  return (
    <span className="font-display tabular-nums text-[20px] text-brand">
      {clp(value)}
    </span>
  )
}

export function VentasSection({ ventas, onEdit }) {
  const total = METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0)
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between px-1 mb-2.5">
        <p className="eyebrow">Ventas · toca para editar</p>
        <AmountTotal value={total} />
      </div>
      <div className="card !p-2.5 divide-y divide-soft">
        {METODOS_VENTA.map((m) => {
          const n = ventas[m.key] || 0
          const vacio = n === 0
          return (
            <button
              key={m.key}
              onClick={() => onEdit(m.key)}
              className="w-full flex items-center gap-3 py-2.5 px-2 text-left first:pt-1 last:pb-1"
            >
              <MetodoLogo metodo={m} size="sm" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{m.label}</span>
              </span>
              <span className={`font-display tabular-nums text-[18px] ${vacio ? 'text-muted2' : 'text-ink'}`}>
                {vacio ? '—' : clp(n)}
              </span>
              <Icon name="pencil" className="w-3.5 h-3.5 text-muted2" stroke={1.8} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
