/** Fondos de avatar: todos dan ≥ 5:1 con la inicial en blanco, en claro y en oscuro. */
const COLORS = ['#475569', '#047857', '#4F46E5', '#B45309', '#0F766E', '#BE185D']

export function avatarColor(nombre: string): string {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[h % COLORS.length] ?? COLORS[0]!
}
