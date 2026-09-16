import { clp } from '@/lib/format'

const SIZES = { hero: 'text-[52px] leading-none', card: 'text-2xl', inline: 'text-[15px]', sm: 'text-[13px]' } as const
const COLORS = { pos: 'text-pos', neg: 'text-neg', brand: 'text-brand', ink: 'text-ink', ink2: 'text-ink2', muted: 'text-muted' } as const

interface Props {
  value: number | null | undefined
  variant?: keyof typeof SIZES
  color?: keyof typeof COLORS
  className?: string
}

export default function Amount({ value, variant = 'card', color = 'ink', className = '' }: Props) {
  return <span className={`amount ${SIZES[variant]} ${COLORS[color]} ${className}`}>{clp(Number(value) || 0)}</span>
}
