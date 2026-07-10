import { useEffect, useRef } from 'react'
import { useToast } from '../components/Toast'

/**
 * Centraliza el aviso de "este turno cambió en otro dispositivo" que
 * usaban Turno.jsx y EditarTurno.jsx con el mismo toast copiado en
 * ambos archivos: un mensaje persistente con botón "Recargar".
 *
 * Cada pantalla sigue decidiendo CUÁNDO marcar `pendiente` — eso no
 * se unifica a propósito, porque son mecanismos genuinamente
 * distintos: Turno.jsx lo detecta en vivo vía useJornadaRealtime
 * mientras hay ediciones sin guardar; EditarTurno.jsx lo detecta
 * recién al guardar, comparando `updated_at` contra lo que tenía
 * cuando cargó la pantalla (no se suscribe a cambios en tiempo real).
 * Lo único que era idéntico entre ambas era este toast, que ahora
 * vive en un solo lugar.
 *
 * @param {boolean} pendiente
 * @param {() => void} onRecargar - qué hacer cuando el usuario toca
 *   "Recargar". Se llama siempre con la versión más reciente, sin que
 *   quien use el hook tenga que envolverla en su propio useRef.
 */
export function useConflictoRemoto(pendiente, onRecargar) {
  const toast = useToast()
  const onRecargarRef = useRef(onRecargar)
  onRecargarRef.current = onRecargar

  useEffect(() => {
    if (!pendiente) return
    const id = toast.show({
      message: 'Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.',
      actionLabel: 'Recargar',
      onAction: () => onRecargarRef.current?.(),
      duration: null,
    })
    return () => toast.hide(id)
  }, [pendiente, toast])
}
