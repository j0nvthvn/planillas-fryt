import { useState, useEffect } from 'react'

/**
 * Refleja navigator.onLine en tiempo real. No detecta todos los casos
 * (por ejemplo wifi conectado pero sin salida a internet), pero cubre
 * el caso común de "se cortó la conexión" / "modo avión", que es lo
 * que le importa al usuario: saber que sus cambios no se están
 * guardando en este momento.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    function handleOnline() { setOnline(true) }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
