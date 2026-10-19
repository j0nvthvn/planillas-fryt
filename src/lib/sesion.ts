/**
 * La caché (restaurada de IndexedDB) solo se descarta cuando un usuario
 * conocido cambia por otro o cierra sesión. La sesión inicial y los
 * refrescos de token no cuentan: limpiar ahí deja a las pantallas ya
 * montadas observando consultas borradas, con el spinner para siempre.
 */
export function debeLimpiarCache(anterior: string | null | undefined, nuevo: string | null) {
  return !!anterior && anterior !== nuevo
}

/**
 * A dónde volver después de ingresar: la ruta completa que se pidió (con su
 * fecha, modo y filtros), siempre dentro de la app. Nunca "//dominio" ni
 * "/\dominio" (los navegadores tratan `\` como `/`), ni otra vez el login.
 */
export function destinoTrasLogin(volver: string | undefined): string {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.includes('\\')) return '/hoy'
  if ([...volver].some((c) => c.charCodeAt(0) < 32) || /^\/login(?:[/?#]|$)/.test(volver)) return '/hoy'
  return volver
}
