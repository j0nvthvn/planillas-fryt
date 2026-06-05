import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULTS = {
  diasTurnoUnico: [0],  // 0 = domingo
  horaCorteManana: 14,
  notificacionesActivas: true,
  notificacionesEmailExtra: '',
  nombreLocal: 'Fryt',
}

const ConfigContext = createContext(null)

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from('configuracion')
        .select('clave, valor')

      if (!error && data?.length) {
        const map = Object.fromEntries(data.map((r) => [r.clave, r.valor]))
        setConfig({
          diasTurnoUnico:          Array.isArray(map.dias_turno_unico)       ? map.dias_turno_unico       : DEFAULTS.diasTurnoUnico,
          horaCorteManana:         typeof map.hora_corte_manana === 'number'  ? map.hora_corte_manana      : DEFAULTS.horaCorteManana,
          notificacionesActivas:   map.notificaciones_activas !== false,
          notificacionesEmailExtra: typeof map.notificaciones_email_extra === 'string' ? map.notificaciones_email_extra : '',
          nombreLocal:             typeof map.nombre_local === 'string' && map.nombre_local ? map.nombre_local : DEFAULTS.nombreLocal,
        })
      }
      setLoading(false)
    }
    cargar()
  }, [])

  function esDiaUnico(fechaStr) {
    if (!fechaStr) return false
    const d = new Date(fechaStr + 'T12:00:00')
    return config.diasTurnoUnico.includes(d.getDay())
  }

  async function guardar(nuevaConfig) {
    const upserts = [
      { clave: 'dias_turno_unico',           valor: nuevaConfig.diasTurnoUnico },
      { clave: 'hora_corte_manana',          valor: nuevaConfig.horaCorteManana },
      { clave: 'notificaciones_activas',     valor: nuevaConfig.notificacionesActivas },
      { clave: 'notificaciones_email_extra', valor: nuevaConfig.notificacionesEmailExtra || '' },
      { clave: 'nombre_local',               valor: nuevaConfig.nombreLocal || DEFAULTS.nombreLocal },
    ]
    const { error } = await supabase
      .from('configuracion')
      .upsert(upserts, { onConflict: 'clave' })
    if (!error) setConfig(nuevaConfig)
    return { error }
  }

  return (
    <ConfigContext.Provider value={{ config, loading, esDiaUnico, guardar }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig debe usarse dentro de ConfigProvider')
  return ctx
}
