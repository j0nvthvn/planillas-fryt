import Icon from './Icon'

const TONOS = {
  brand: {
    flat: 'bg-brand-tint text-brand border-brand/30',
    gradient: 'bg-gradient-to-br from-brand-tint to-brand-tint/30 text-brand border-brand/30',
  },
  warn: {
    flat: 'bg-warn-tint text-warn border-warn/30',
    gradient: 'bg-gradient-to-br from-warn-tint to-warn-tint/30 text-warn border-warn/30',
  },
  info: {
    flat: 'bg-info-tint text-info border-info/30',
    gradient: 'bg-gradient-to-br from-info-tint to-info-tint/30 text-info border-info/30',
  },
  pos: {
    flat: 'bg-pos-tint text-pos border-pos-border',
    gradient: 'bg-gradient-to-br from-pos-tint to-pos-tint/30 text-pos border-pos-border',
  },
}

/**
 * Pill de estado (borrador / corregido / único / completo, etc.).
 * Reemplaza el mismo bloque de clases que estaba copiado entre
 * Historial.jsx y Resumen.jsx con pequeñas variaciones (gradiente vs.
 * plano, con o sin botón). `dot` es el punto de color de "borrador",
 * `icon` es para casos como "corregido" (ícono de lápiz).
 */
export default function Badge({ tone = 'brand', gradient = false, dot = false, pulse = false, icon, children, onClick }) {
  const cls = TONOS[tone][gradient ? 'gradient' : 'flat']
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border ${cls} ${
        onClick ? 'hover:border-opacity-60 transition-colors' : ''
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${pulse ? 'animate-pulse' : ''}`} style={{ background: 'currentColor' }} />}
      {icon && <Icon name={icon} className="w-3 h-3" stroke={2.2} />}
      {children}
    </Tag>
  )
}
