import Icon from './Icon'

/**
 * Chip de estado mañana/tarde. Cubre dos usos que antes eran dos
 * componentes casi idénticos (Hoy.jsx y Resumen.jsx): con `onClick` y
 * `subtotal` se renderiza como botón navegable con monto y badge de
 * borrador (Hoy.jsx); sin esos props se renderiza como bloque
 * estático de solo lectura (Resumen.jsx).
 */
export default function TurnoStatusChip({ tipo, presente, usuario, subtotal, isDraft, onClick }) {
  const icon = tipo === 'mañana' ? 'sun' : 'moon'
  const label = tipo === 'mañana' ? 'Mañana' : 'Tarde'

  if (!presente) {
    return (
      <div className="flex-1 rounded-2xl border border-hairline bg-canvas px-3 py-2.5 flex items-center gap-2.5 opacity-60">
        <Icon name={icon} className="w-4 h-4 text-muted2" stroke={1.6} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">{label}</p>
          <p className="text-[11px] text-muted2 leading-tight">Sin registrar</p>
        </div>
      </div>
    )
  }

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? `Ver resumen de ${label}${isDraft ? ' (borrador)' : ''}` : undefined}
      className={`relative flex-1 text-left rounded-2xl border border-pos-border bg-pos-tint px-3 py-2.5 flex items-center gap-2.5 ${
        onClick ? 'hover:border-pos hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pos focus-visible:ring-offset-2 focus-visible:ring-offset-canvas transition-all group' : ''
      }`}
    >
      <Icon name={icon} className="w-4 h-4 text-pos" stroke={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-pos">{label}</p>
        <p className="text-[11px] text-pos/80 truncate leading-tight">
          {usuario}
          {subtotal != null && (
            <> · <span className="tabular-nums font-semibold">${subtotal.toLocaleString('es-CL')}</span></>
          )}
        </p>
      </div>
      {onClick && (
        <Icon name="chevR" className="w-3.5 h-3.5 text-pos/50 group-hover:text-pos group-hover:translate-x-0.5 transition-all" />
      )}
      {isDraft && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-warn text-white shadow-sm">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          borrador
        </span>
      )}
    </Tag>
  )
}
