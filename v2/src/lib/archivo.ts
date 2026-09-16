/**
 * Entrega un archivo generado en el navegador. En el celular abre el menú
 * de compartir (WhatsApp, correo, Drive), que además es lo único que
 * funciona bien en una PWA instalada en iOS; si no se puede, lo descarga.
 * Si la persona cierra el menú sin elegir, devuelve 'cancelado'.
 */
export async function entregarArchivo(file: File, { compartir = true } = {}): Promise<'compartido' | 'descargado' | 'cancelado'> {
  if (compartir && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'compartido'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Otro error (p. ej. NotAllowedError por perder el gesto): se descarga.
    }
  }
  descargar(file)
  return 'descargado'
}

export function descargar(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Safari necesita que la URL siga viva un momento después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** ¿Este navegador puede compartir archivos? (para rotular el botón). */
export function puedeCompartirArchivos(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.csv', { type: 'text/csv' })] })
  } catch {
    return false
  }
}
