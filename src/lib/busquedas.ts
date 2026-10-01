import { z } from 'zod'

/**
 * Filtros de las pantallas que viven en la URL. Un valor que no se entiende
 * (un enlace viejo, uno mal copiado) se descarta y la pantalla abre con el
 * valor por defecto, en vez de caer en la pantalla de error.
 */
const opcional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined)

/** Rechaza también fechas imposibles (por ejemplo, 31 de febrero). */
const fecha = opcional(z.iso.date())

export const busquedaHistorial = z.object({
  filtro: opcional(z.enum(['todos', 'borradores', 'corregidos', 'descuadres', 'parciales', 'sin_abrir'])),
})

export const busquedaAnalisis = z.object({ desde: fecha, hasta: fecha })

export const busquedaProveedores = z.object({
  q: opcional(z.string()),
  estado: opcional(z.enum(['activos', 'inactivos', 'todos'])),
  uso: opcional(z.enum(['todos', 'con', 'sin'])),
  orden: opcional(z.enum(['uso', 'monto', 'az', 'nuevos'])),
  desde: fecha,
  hasta: fecha,
})

export const busquedaAjustes = z.object({
  seccion: opcional(z.enum(['general', 'correos', 'trabajadores', 'metodos', 'papelera', 'usuarios', 'errores', 'apariencia'])),
})
