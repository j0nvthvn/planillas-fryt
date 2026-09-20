/**
 * Un PostgREST mínimo sobre los datos de ejemplo.
 *
 * El renderizador intercepta las llamadas a `/rest/v1/**` y las contesta con
 * esto, así que las pantallas hacen exactamente las mismas consultas que en
 * producción — con sus filtros, su orden y su paginación — y nadie necesita
 * credenciales ni una base levantada.
 *
 * Sostiene lo que la app usa hoy. Si una pantalla estrena un operador, esto
 * lanza con el nombre a la vista en vez de devolver una lista equivocada: una
 * maqueta silenciosamente vacía es peor que una corrida que falla.
 */

const OPERADORES = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  is: (a, b) => a === b,
  in: (a, b) => b.includes(a),
}

/** `eq.true`, `in.(a,b)`, `is.null` → un valor comparable con el de la fila. */
function interpretar(op, crudo, ejemplo) {
  if (op === 'in') {
    const lista = crudo.replace(/^\(|\)$/g, '')
    return lista ? lista.split(',').map((v) => interpretar('eq', v.replace(/^"|"$/g, ''), ejemplo)) : []
  }
  if (crudo === 'null') return null
  if (crudo === 'true') return true
  if (crudo === 'false') return false
  if (typeof ejemplo === 'number' && crudo !== '' && !Number.isNaN(Number(crudo))) return Number(crudo)
  return crudo
}

function comparar(filas, columna, expresion) {
  const punto = expresion.indexOf('.')
  const op = expresion.slice(0, punto)
  const crudo = expresion.slice(punto + 1)
  const fn = OPERADORES[op]
  if (!fn) throw new Error(`operador PostgREST no soportado: ${op} (en ${columna}=${expresion})`)
  const ejemplo = filas.find((f) => f[columna] != null)?.[columna]
  const valor = interpretar(op, crudo, ejemplo)
  return filas.filter((f) => fn(f[columna] ?? null, valor))
}

const IGNORADOS = new Set(['select', 'offset', 'limit', 'order', 'on_conflict', 'columns'])

/**
 * Responde una consulta de lectura.
 * @returns {{status:number, cuerpo:unknown}}
 */
export function consultar(recurso, params, headers, datos) {
  const tabla = datos[recurso]
  if (!tabla) throw new Error(`sin datos de ejemplo para "${recurso}": agrégalo en maquetas/datos.mjs`)

  let filas = [...tabla]
  for (const [columna, expresion] of params.entries()) {
    if (IGNORADOS.has(columna)) continue
    filas = comparar(filas, columna, expresion)
  }

  const orden = params.getAll('order').join(',')
  if (orden) {
    const claves = orden.split(',').filter(Boolean).map((t) => {
      const [columna, ...resto] = t.split('.')
      return { columna, desc: resto.includes('desc') }
    })
    filas.sort((a, b) => {
      for (const { columna, desc } of claves) {
        const x = a[columna] ?? ''
        const y = b[columna] ?? ''
        if (x === y) continue
        return (x > y ? 1 : -1) * (desc ? -1 : 1)
      }
      return 0
    })
  }

  const total = filas.length
  const offset = Number(params.get('offset') ?? 0)
  const limite = params.get('limit')
  filas = filas.slice(offset, limite ? offset + Number(limite) : undefined)

  // `.single()` pide un objeto; `.maybeSingle()` recibe la lista y elige.
  if ((headers.accept ?? '').includes('vnd.pgrst.object+json')) {
    if (filas.length !== 1) {
      return {
        status: 406,
        cuerpo: { code: 'PGRST116', details: `Results contain ${filas.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' },
      }
    }
    return { status: 200, cuerpo: filas[0] }
  }
  return { status: 200, cuerpo: filas, total }
}
