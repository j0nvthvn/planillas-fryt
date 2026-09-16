import { useSyncExternalStore } from 'react'

const mq = () => window.matchMedia('(min-width: 768px)')

function subscribe(cb: () => void) {
  const m = mq()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => mq().matches, () => false)
}
