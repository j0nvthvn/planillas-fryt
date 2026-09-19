import { useEffect, useState } from 'react'

/**
 * Texto para una región viva que se actualiza solo cuando deja de cambiar:
 * al teclear un monto el lector lee «$12.500» una vez, no cada dígito.
 */
export function useAnuncio(texto: string, ms = 800): string {
  const [anuncio, setAnuncio] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setAnuncio(texto), ms)
    return () => clearTimeout(t)
  }, [texto, ms])
  return anuncio
}
