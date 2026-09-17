/**
 * Estado de un día, tal como lo calcula `v_resumen_dia`.
 *
 * `cerrado` es el día en que el local no abrió. En la base se llama así
 * porque es la palabra del dominio, pero en pantalla nunca se dice
 * "cerrado": acá eso ya significa un turno cerrado, y en la leyenda del
 * gráfico de Análisis, un día *con* registro. En la interfaz siempre es
 * "No abrió".
 */
export type Estado = 'sin_registro' | 'cerrado' | 'borrador' | 'parcial' | 'completo'

interface Etiqueta {
  /** Para el chip, donde solo caben dos palabras. */
  chip: string
  /** Para el Excel y el reporte, donde no hay color que ayude. */
  largo: string
  cls: string
}

/** Una sola fuente para el chip de estado y para la exportación. */
export const ESTADOS: Record<Estado, Etiqueta> = {
  sin_registro: { chip: 'Sin registro', largo: 'Sin registro',   cls: 'bg-soft text-muted' },
  // Neutro a propósito: que el local no abra es normal, no una alerta.
  cerrado:      { chip: 'No abrió',     largo: 'No abrió',       cls: 'bg-soft text-muted2' },
  borrador:     { chip: 'Borrador',     largo: 'Con borrador',   cls: 'bg-warn-tint text-warn' },
  parcial:      { chip: 'Falta la tarde', largo: 'Falta un turno', cls: 'bg-info-tint text-info' },
  completo:     { chip: 'Completo',     largo: 'Completo',       cls: 'bg-pos-tint text-pos' },
}

export function etiquetaEstado(estado: string | null | undefined): Etiqueta {
  return ESTADOS[estado as Estado] ?? ESTADOS.sin_registro
}
