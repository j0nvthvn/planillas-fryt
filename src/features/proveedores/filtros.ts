import { fechaISO, fechaLocal, sumarDias } from '@/lib/format'
import { normalizar } from '@/features/turno/parecido'

export type EstadoFiltro = 'activos' | 'inactivos' | 'todos'
export type UsoFiltro = 'todos' | 'con' | 'sin'
export type OrdenFiltro = 'uso' | 'monto' | 'az' | 'nuevos'
export type PresetPeriodo = '30' | 'mes' | '90' | '365'

export interface Filtros {
  q: string
  estado: EstadoFiltro
  uso: UsoFiltro
  orden: OrdenFiltro
}

/** Lo que no va en la URL: con estos valores la lista se ve como siempre. */
export const FILTROS_BASE: Filtros = { q: '', estado: 'activos', uso: 'todos', orden: 'uso' }
export const PRESET_BASE: PresetPeriodo = '90'

export interface ComprasProveedor { compras: number; monto: number }
/** Por `proveedor_id`. Objeto y no Map: la caché de consultas se persiste como JSON. */
export type ComprasPorProveedor = Record<string, ComprasProveedor>

export function periodo(preset: PresetPeriodo, hoyISO: string): { desde: string; hasta: string } {
  if (preset === 'mes') { const d = fechaLocal(hoyISO); return { desde: fechaISO(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: hoyISO } }
  return { desde: sumarDias(hoyISO, -(Number(preset) - 1)), hasta: hoyISO }
}

export function agruparCompras(filas: { proveedor_id: string | null; monto: number | string }[]): ComprasPorProveedor {
  const r: ComprasPorProveedor = {}
  for (const f of filas) {
    if (!f.proveedor_id) continue
    const c = (r[f.proveedor_id] ??= { compras: 0, monto: 0 })
    c.compras += 1
    c.monto += Number(f.monto)
  }
  return r
}

interface ProveedorBase { id: string; nombre: string; activo: boolean; creado_en: string }

/** Aplica nombre, estado y uso en el período, y ordena. Los empates van por nombre. */
export function filtrarProveedores<P extends ProveedorBase>(lista: P[], compras: ComprasPorProveedor, f: Filtros): (P & ComprasProveedor)[] {
  const n = normalizar(f.q)
  const porNombre = (a: P, b: P) => a.nombre.localeCompare(b.nombre, 'es')
  return lista
    .map((p) => ({ ...p, compras: compras[p.id]?.compras ?? 0, monto: compras[p.id]?.monto ?? 0 }))
    .filter((p) => f.estado === 'todos' || p.activo === (f.estado === 'activos'))
    .filter((p) => f.uso === 'todos' || (p.compras > 0) === (f.uso === 'con'))
    .filter((p) => !n || normalizar(p.nombre).includes(n))
    .sort((a, b) => {
      if (f.orden === 'uso') return b.compras - a.compras || b.monto - a.monto || porNombre(a, b)
      if (f.orden === 'monto') return b.monto - a.monto || b.compras - a.compras || porNombre(a, b)
      if (f.orden === 'nuevos') return b.creado_en.localeCompare(a.creado_en) || porNombre(a, b)
      return porNombre(a, b)
    })
}
