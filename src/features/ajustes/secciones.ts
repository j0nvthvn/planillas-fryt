import type { IconName } from '@/components/Icon'

/** Secciones de Ajustes, agrupadas como se muestran en el menú. */
export type Seccion = 'general' | 'correos' | 'trabajadores' | 'metodos' | 'papelera' | 'usuarios' | 'errores' | 'apariencia'
interface Item { v: Seccion; label: string; hint: string; icon: IconName }

export const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: 'Local', items: [
    { v: 'general', label: 'General', hint: 'Nombre, fondo de caja y cortes', icon: 'store' },
    { v: 'trabajadores', label: 'Trabajadores', hint: 'Quiénes cierran turno', icon: 'users' },
    { v: 'metodos', label: 'Métodos de pago', hint: 'Cuáles se usan y en qué orden', icon: 'bank' },
  ] },
  { titulo: 'Avisos', items: [
    { v: 'correos', label: 'Correos', hint: 'Quién recibe qué y a qué hora', icon: 'mail' },
  ] },
  { titulo: 'Datos', items: [
    { v: 'papelera', label: 'Papelera', hint: 'Turnos eliminados', icon: 'trash' },
    { v: 'errores', label: 'Errores', hint: 'Fallos registrados por la app', icon: 'warning' },
  ] },
  { titulo: 'Cuenta y equipo', items: [
    { v: 'usuarios', label: 'Cuentas', hint: 'Quién puede entrar', icon: 'user' },
    { v: 'apariencia', label: 'Apariencia', hint: 'Tema y este dispositivo', icon: 'sun' },
  ] },
]

export function etiquetaSeccion(v: Seccion): string {
  return GRUPOS.flatMap((g) => g.items).find((i) => i.v === v)?.label ?? 'Ajustes'
}
