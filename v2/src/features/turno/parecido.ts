/**
 * Detección de nombres de proveedor casi iguales. Escribir uno a mano crea
 * uno nuevo, y así aparecieron los duplicados de producción ("Río Maipo" y
 * "Rio Maipo", "PF" y "Pf"): antes de crear uno, se pregunta.
 */

/** Distancia de edición (Levenshtein) entre dos nombres ya normalizados. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i]
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      siguiente.push(Math.min(
        (fila[j] ?? 0) + 1,
        (siguiente[j - 1] ?? 0) + 1,
        (fila[j - 1] ?? 0) + costo,
      ))
    }
    fila = siguiente
  }
  return fila[b.length] ?? 0
}

/** Cuánta diferencia se tolera según el largo del nombre. */
function tolerancia(largo: number): number {
  if (largo < 4) return 0
  if (largo <= 6) return 1
  return 2
}

/**
 * El proveedor del catálogo más parecido a lo escrito, o null si no hay
 * ninguno suficientemente cerca (o si hay uno idéntico: ahí no hay duda).
 */
export function proveedorParecido<T extends { nombre: string }>(
  normalizado: string,
  lista: readonly T[],
  normalizar: (s: string) => string,
): T | null {
  if (normalizado.length < 3) return null
  const max = tolerancia(normalizado.length)
  if (max === 0) return null
  let mejor: T | null = null
  let mejorD = Number.POSITIVE_INFINITY
  for (const p of lista) {
    const d = distancia(normalizado, normalizar(p.nombre))
    if (d === 0) return null
    if (d < mejorD) { mejorD = d; mejor = p }
  }
  return mejorD <= max ? mejor : null
}
