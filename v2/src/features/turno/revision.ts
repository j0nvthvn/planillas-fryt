import { clp } from '@/lib/format'

/**
 * Lo que conviene mirar antes de cerrar. En producción 1 de cada 4 cierres
 * termina siendo una corrección: la hoja de revisión muestra el resumen y
 * estos avisos, pero ninguno bloquea el cierre.
 */
export interface DatosRevision {
  trabajadorId: string | null
  /** Hay lista de trabajadores configurada (si no, no tiene sentido avisar). */
  hayTrabajadores: boolean
  contoCaja: boolean
  /** contado − esperado; null si no contó. */
  diferenciaCaja: number | null
  totalVentas: number
  totalProveedores: number
}

export interface Aviso {
  id: 'vacio' | 'descuadre' | 'trabajador' | 'conteo'
  texto: string
  tono: 'neg' | 'warn'
}

export function avisosCierre(d: DatosRevision): Aviso[] {
  const avisos: Aviso[] = []
  if (d.totalVentas === 0 && d.totalProveedores === 0) {
    avisos.push({ id: 'vacio', texto: 'No registraste ventas ni proveedores.', tono: 'neg' })
  }
  if (d.contoCaja && d.diferenciaCaja != null && d.diferenciaCaja !== 0) {
    const falta = d.diferenciaCaja < 0
    avisos.push({
      id: 'descuadre',
      texto: `La caja no cuadra: ${falta ? 'faltan' : 'sobran'} ${clp(Math.abs(d.diferenciaCaja))}.`,
      tono: 'neg',
    })
  }
  if (d.hayTrabajadores && !d.trabajadorId) {
    avisos.push({ id: 'trabajador', texto: 'No elegiste quién atendió.', tono: 'warn' })
  }
  if (!d.contoCaja) {
    avisos.push({ id: 'conteo', texto: 'No contaste la caja: no se puede comparar con el efectivo esperado.', tono: 'warn' })
  }
  return avisos
}
