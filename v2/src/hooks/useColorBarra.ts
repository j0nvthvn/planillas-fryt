import { useEffect } from 'react'
import { observarTema } from '@/lib/barraEstado'

/**
 * Mantiene el `theme-color` al día con el tema elegido en la app. El color
 * según la pantalla lo pone la banda (ver `lib/barraEstado`).
 */
export function useColorBarra() {
  useEffect(() => observarTema(), [])
}
