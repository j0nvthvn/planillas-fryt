import { useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { mensajeDeError } from '@/lib/errorLog'

/**
 * Ejecuta una escritura y avisa: con `ok`, un toast al terminar; ante
 * cualquier error, el mensaje legible. Es el mismo `try/catch` que estaba
 * copiado en cada pantalla (y cuatro veces solo en Ajustes, con firmas
 * distintas): una acción que falla nunca debe quedarse en silencio.
 */
export function useAccion() {
  const toast = useToast()
  return useCallback(
    (fn: () => Promise<unknown>, ok?: string) =>
      fn()
        .then(() => { if (ok) toast.ok(ok) })
        .catch((e: unknown) => { toast.error(mensajeDeError(e)) }),
    [toast],
  )
}
