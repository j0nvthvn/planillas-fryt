/**
 * La caché (restaurada de IndexedDB) solo se descarta cuando un usuario
 * conocido cambia por otro o cierra sesión. La sesión inicial y los
 * refrescos de token no cuentan: limpiar ahí deja a las pantallas ya
 * montadas observando consultas borradas, con el spinner para siempre.
 */
export function debeLimpiarCache(anterior: string | null | undefined, nuevo: string | null) {
  return !!anterior && anterior !== nuevo
}
