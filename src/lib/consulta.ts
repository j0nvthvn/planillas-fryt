/** Lo mínimo de una consulta de TanStack Query para decidir qué mostrar. */
export interface EstadoConsulta {
  data: unknown
  isPending: boolean
  isError: boolean
}

/**
 * Qué muestra una pantalla según sus consultas principales, para que una
 * falla nunca se vea como cero o como «sin registros»:
 *  - `error`: alguna falló y no tiene datos previos → error con «Reintentar»;
 *  - `cargando`: alguna todavía no trae nada → esqueleto o spinner;
 *  - `datos`: todas tienen algo. Si alguna falló al refrescar, `desactualizado`
 *    pide avisar que lo que se ve puede no estar al día.
 * `data === null` cuenta como dato (por ejemplo, un día sin jornada).
 */
export function vistaDe(...consultas: EstadoConsulta[]): { vista: 'error' | 'cargando' | 'datos'; desactualizado: boolean } {
  if (consultas.some((c) => c.isError && c.data === undefined)) return { vista: 'error', desactualizado: false }
  if (consultas.some((c) => c.isPending)) return { vista: 'cargando', desactualizado: false }
  return { vista: 'datos', desactualizado: consultas.some((c) => c.isError) }
}
