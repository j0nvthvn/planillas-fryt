import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchConTimeout } from './fetchConTimeout'

/** Un fetch que nunca responde, salvo que lo aborten. */
function fetchColgado() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_ok, fallar) => {
    init?.signal?.addEventListener('abort', () => fallar(init.signal?.reason as Error))
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('fetchConTimeout', () => {
  it('una petición colgada termina en error al vencer el plazo', async () => {
    vi.stubGlobal('fetch', fetchColgado())
    await expect(fetchConTimeout('https://x.test', undefined, 20)).rejects.toMatchObject({ name: 'TimeoutError' })
  })
  it('respeta la señal de quien llama', async () => {
    vi.stubGlobal('fetch', fetchColgado())
    const ctrl = new AbortController()
    const p = fetchConTimeout('https://x.test', { signal: ctrl.signal }, 10_000)
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('deja pasar las respuestas normales', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('ok'))))
    const r = await fetchConTimeout('https://x.test')
    expect(await r.text()).toBe('ok')
  })
})
