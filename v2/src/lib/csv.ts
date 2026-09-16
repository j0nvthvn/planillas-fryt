import { fechaCorta } from './format'
import type { Tabla, Valor, TipoColumna } from '@/features/exportar/tablas'

/**
 * CSV para Excel en español: separador ";" y BOM UTF-8 (Chile usa "," como
 * decimal; sin esto Excel junta las columnas o rompe los acentos).
 */
export function csvTexto(tabla: Tabla): string {
  const sep = ';'
  const celda = (v: Valor, tipo: TipoColumna) => {
    if (v === null || v === '') return ''
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
    // Un texto que empieza con = + - @ Excel lo ejecuta como fórmula (los
    // nombres de proveedores son texto libre): se antepone un apóstrofo.
    const s = tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fechaCorta(v) : /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const tipos = tabla.columnas.map((c) => c.tipo)
  const linea = (fila: Valor[]) => fila.map((v, i) => celda(v, tipos[i] ?? 'texto')).join(sep)
  const lineas = [
    tabla.columnas.map((c) => celda(c.titulo, 'texto')).join(sep),
    ...tabla.filas.map(linea),
    ...(tabla.total ? [linea(tabla.total)] : []),
  ]
  return '﻿' + lineas.join('\r\n')
}

export function archivoCSV(nombre: string, tabla: Tabla): File {
  return new File([csvTexto(tabla)], nombre, { type: 'text/csv;charset=utf-8' })
}
