import { clp } from '../utils/format'

const VARIANTS = {
  hero:   'text-[56px] leading-none',
  card:   'text-2xl',
  inline: 'text-[15px]',
}

const COLOR_TEXT = {
  pos:   'text-pos',
  neg:   'text-neg',
  brand: 'text-brand',
  ink:   'text-ink',
  ink2:  'text-ink2',
  muted: 'text-muted',
}

export default function Amount({ value, variant = 'card', color, className = '', as: Tag = 'span' }) {
  const n = Number(value) || 0
  const colorClass = color ? (COLOR_TEXT[color] || '') : ''
  const sizeClass = VARIANTS[variant] || VARIANTS.card
  return (
    <Tag className={`font-display tabular-nums ${sizeClass} ${colorClass} ${className}`}>
      {clp(n)}
    </Tag>
  )
}
