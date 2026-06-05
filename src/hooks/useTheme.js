import { useState, useEffect } from 'react'

export function useTheme() {
  const [tema, setTemaState] = useState(() => localStorage.getItem('tema') || 'sistema')

  useEffect(() => {
    const html = document.documentElement

    function aplicar(t) {
      if (t === 'oscuro') {
        html.classList.add('dark')
      } else if (t === 'claro') {
        html.classList.remove('dark')
      } else {
        html.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }

    aplicar(tema)
    localStorage.setItem('tema', tema)

    if (tema === 'sistema') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => document.documentElement.classList.toggle('dark', e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [tema])

  function setTema(t) {
    setTemaState(t)
  }

  return { tema, setTema }
}
