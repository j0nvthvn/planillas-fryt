import Icon from './Icon'

const VARIANTES = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  danger: 'border border-hairline text-neg hover:bg-neg-tint',
  secondary: 'border border-hairline text-ink2 hover:bg-canvas hover:text-ink',
}

/**
 * Botón cuadrado de ícono (40×40, esquinas redondeadas) usado para
 * las acciones principales de cabecera: "agregar" (Proveedores,
 * Usuarios) y "eliminar" (EditarTurno). Antes era el mismo bloque de
 * clases copiado en cada pantalla.
 */
export default function IconButton({
  icon, iconClassName = 'w-5 h-5', stroke, onClick, label, variant = 'primary', className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`w-10 h-10 rounded-[13px] grid place-items-center shrink-0 transition-colors ${VARIANTES[variant]} ${className}`}
    >
      <Icon name={icon} className={iconClassName} stroke={stroke} />
    </button>
  )
}
