import { useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useJornadaRealtime({ fecha, jornadaId, turnoIds = [], onChange, enabled = true }) {
  const onChangeRef = useRef(onChange)
  const timerRef = useRef(null)
  const turnoKey = useMemo(() => turnoIds.filter(Boolean).sort().join(','), [turnoIds])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled || !fecha) return undefined

    const notify = (payload) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => onChangeRef.current?.(payload), 180)
    }

    const channel = supabase
      .channel(`jornada-${fecha}-${jornadaId || 'sin-jornada'}-${turnoKey || 'sin-turnos'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jornadas', filter: `fecha=eq.${fecha}` },
        notify
      )

    if (jornadaId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos', filter: `jornada_id=eq.${jornadaId}` },
        notify
      )
    }

    for (const id of turnoIds.filter(Boolean)) {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ventas_turno', filter: `turno_id=eq.${id}` },
          notify
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'proveedores_turno', filter: `turno_id=eq.${id}` },
          notify
        )
    }

    channel.subscribe()

    return () => {
      clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [enabled, fecha, jornadaId, turnoKey])
}
