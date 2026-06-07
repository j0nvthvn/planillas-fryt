import { clp } from '../../utils/format'
import {
  GREEN, NAVY, METODOS_VENTA,
  TurnoIcon as Icon, ProveedorAvatar, SectionHead, MetodoLogo,
} from '../TurnoInput'

/* Lista de proveedores del turno (vacía → botón punteado; con datos → card + agregar) */
export function ProveedoresSection({ provs, onAdd, onEdit, accent, accentTint }) {
  return (
    <section>
      <SectionHead title="Proveedores" right={provs.length || null} />
      {provs.length === 0 ? (
        <button onClick={onAdd} className="w-full flex flex-col items-center gap-2 py-7 rounded-xl border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 text-sm font-medium">
          <Icon name="plus" /> Agrega el primer proveedor
        </button>
      ) : (
        <>
          <div className="card !p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700">
            {provs.map((p, i) => (
              <button key={i} onClick={() => onEdit(i)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <ProveedorAvatar nombre={p.nombre} imagen_url={p.imagen_url} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-gray-900 dark:text-zinc-100 truncate">{p.nombre}</span>
                  <span className="block text-xs capitalize" style={{ color: p.forma_pago === 'efectivo' ? GREEN : NAVY }}>{p.forma_pago}</span>
                </span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{clp(p.monto)}</span>
                <Icon name="chevR" className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
              </button>
            ))}
          </div>
          <button onClick={onAdd} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: accentTint, color: accent }}>
            <Icon name="plus" className="w-4 h-4" stroke={2} /> Agregar proveedor
          </button>
        </>
      )}
    </section>
  )
}

/* Lista de los 6 métodos de pago, abre el editor de monto al tocar */
export function VentasSection({ ventas, onEdit }) {
  return (
    <section>
      <SectionHead title="Ventas del turno" />
      <div className="card !p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-700">
        {METODOS_VENTA.map((m) => {
          const tiene = ventas[m.key] > 0
          return (
            <button key={m.key} onClick={() => onEdit(m.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${tiene ? 'bg-[#F7FBF9] dark:bg-emerald-950/30' : ''}`}>
              <MetodoLogo metodo={m} active={tiene} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium text-gray-900 dark:text-zinc-100">{m.label}</span>
                <span className="block text-xs text-gray-500 dark:text-zinc-400">{m.sub}</span>
              </span>
              <span className={`font-semibold tabular-nums ${tiene ? 'text-gray-900 dark:text-zinc-100' : 'text-gray-300 dark:text-zinc-600'}`}>{clp(ventas[m.key])}</span>
              <Icon name="chevR" className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
            </button>
          )
        })}
      </div>
    </section>
  )
}
