/**
 * Una sola solicitud de guardado a la vez, sin React.
 *
 * `guardar_turno` siempre cambia `updated_at`, así que dos solicitudes del
 * mismo dispositivo con la misma versión base (autoguardado + envío al
 * ocultar, autoguardado + Cerrar, red lenta + otra edición) hacían que la
 * segunda recibiera `conflicto`: la app se lo generaba a sí misma. En la
 * cola, cada tarea empieza cuando termina la anterior y lee el estado en ese
 * momento, ya con la versión que devolvió la anterior.
 */
export interface ColaGuardado {
  /**
   * Corre `tarea` cuando termine lo que está antes en la cola. Con
   * `fusionable` (autoguardados), si ya hay otra fusionable esperando se
   * devuelve esa: todavía no empezó, así que también lleva estos cambios.
   */
  encolar<T>(tarea: () => Promise<T>, opciones?: { fusionable?: boolean }): Promise<T>
  /** Hay una tarea corriendo o esperando. */
  ocupada(): boolean
}

export function crearColaGuardado(): ColaGuardado {
  let ultima: Promise<unknown> = Promise.resolve()
  let enCola = 0
  let esperando: Promise<unknown> | null = null
  return {
    encolar<T>(tarea: () => Promise<T>, { fusionable = false } = {}): Promise<T> {
      if (fusionable && esperando) return esperando as Promise<T>
      enCola += 1
      // Una tarea que falla no detiene a las siguientes.
      const p: Promise<T> = ultima.catch(() => undefined).then(() => {
        if (esperando === p) esperando = null
        return tarea()
      }).finally(() => { enCola -= 1 })
      // Lo que se encola después de una no fusionable (el cierre) va detrás.
      esperando = fusionable ? p : null
      ultima = p
      return p
    },
    ocupada: () => enCola > 0,
  }
}
