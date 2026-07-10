import { useState, useEffect, useCallback } from 'react'

function estaInstalada() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function esIOS() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Expone el evento nativo `beforeinstallprompt` (Chrome/Edge/Android) para
 * poder ofrecer un botón "Instalar app" propio, en vez de depender de que el
 * usuario note el ícono del navegador. En iOS no existe ese evento — ahí solo
 * podemos detectar la plataforma y mostrar instrucciones manuales.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null)
  const [instalada, setInstalada] = useState(estaInstalada)

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredEvent(e)
    }
    function onInstalled() {
      setInstalada(true)
      setDeferredEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const instalar = useCallback(async () => {
    if (!deferredEvent) return false
    deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    setDeferredEvent(null)
    return outcome === 'accepted'
  }, [deferredEvent])

  return {
    instalada,
    puedeInstalarNativo: !!deferredEvent,
    esIOS: esIOS(),
    instalar,
  }
}
