interface Consulta { data: unknown; isError: boolean }

/**
 * Lo que Cerrar turno necesita del catálogo antes de mostrarse. Sin métodos
 * no hay ventas que revisar (la pantalla quedaba sin campos y se podía
 * cerrar igual) y sin configuración el fondo sale en $0. Una copia en caché
 * basta aunque el refresco falle; sin copia, un fallo es un error, no una
 * lista vacía.
 */
export function estadoCatalogo({ config, metodos, trabajadores }: {
  config: Consulta
  metodos: Consulta
  trabajadores: Consulta
}): 'listo' | 'cargando' | 'error' {
  const consultas = [config, metodos, trabajadores]
  if (consultas.every((c) => c.data !== undefined)) return 'listo'
  return consultas.some((c) => c.data === undefined && c.isError) ? 'error' : 'cargando'
}
