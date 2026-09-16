/**
 * Descarga un CSV. Separador ";" y BOM UTF-8: así lo espera Excel en
 * español (Chile usa "," como decimal); sin esto junta las columnas o
 * rompe los acentos.
 */
export function descargarCSV(nombreArchivo: string, columnas: string[], filas: (string | number | null | undefined)[][]): void {
  const sep = ';'
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [columnas.map(esc).join(sep), ...filas.map((fila) => fila.map(esc).join(sep))]
  const csv = '﻿' + lineas.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
