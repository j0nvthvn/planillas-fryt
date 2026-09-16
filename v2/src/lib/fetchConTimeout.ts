/**
 * Tiempo máximo por petición. En el celular, al volver de segundo plano, una
 * conexión puede quedar medio abierta y el fetch no terminar nunca: sin
 * límite no hay error, React Query no reintenta y la pantalla queda cargando.
 */
export const TIMEOUT_MS = 15_000

export function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit, ms = TIMEOUT_MS) {
  const limite = AbortSignal.timeout(ms)
  const signal = init?.signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([init.signal, limite])
    : init?.signal ?? limite
  return fetch(input, { ...init, signal })
}
