/**
 * Descarga un archivo CSV en el navegador. Usa ";" como separador y
 * agrega un BOM UTF-8 al inicio porque así es como Excel en español
 * (configuración regional de Chile, donde "," es separador decimal)
 * espera los CSV — sin esto, Excel junta todas las columnas en una
 * sola o rompe los acentos.
 */
export function descargarCSV(nombreArchivo, columnas, filas) {
  const sep = ';'
  const esc = (v) => {
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
