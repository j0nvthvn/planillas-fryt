import { describe, it, expect } from 'vitest'
import { crearColaGuardado } from './colaGuardado'

/** Promesa que se resuelve o rechaza desde fuera. */
function diferida<T = void>() {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej })
  return { promesa, resolver, rechazar }
}

const tic = () => new Promise((r) => setTimeout(r, 0))
/** Tarea que termina al instante con lo que devuelve `f`. */
const ya = <T>(f: () => T) => () => Promise.resolve(f())

describe('crearColaGuardado', () => {
  it('la segunda tarea empieza cuando termina la primera', async () => {
    const cola = crearColaGuardado()
    const orden: string[] = []
    const primera = diferida()
    void cola.encolar(async () => { orden.push('inicio 1'); await primera.promesa; orden.push('fin 1') })
    void cola.encolar(ya(() => { orden.push('inicio 2') }))
    await tic()
    expect(orden).toEqual(['inicio 1'])
    primera.resolver()
    await tic()
    expect(orden).toEqual(['inicio 1', 'fin 1', 'inicio 2'])
  })

  it('un autoguardado que espera absorbe a los que llegan después', async () => {
    const cola = crearColaGuardado()
    const primera = diferida()
    let corridas = 0
    void cola.encolar(() => primera.promesa)
    const a = cola.encolar(ya(() => ++corridas), { fusionable: true })
    const b = cola.encolar(ya(() => ++corridas), { fusionable: true })
    expect(b).toBe(a)
    primera.resolver()
    expect(await a).toBe(1)
    expect(corridas).toBe(1)
  })

  it('el que ya está corriendo no absorbe: el siguiente se encola', async () => {
    const cola = crearColaGuardado()
    const primera = diferida<number>()
    const a = cola.encolar(() => primera.promesa, { fusionable: true })
    await tic()
    const b = cola.encolar(ya(() => 2), { fusionable: true })
    expect(b).not.toBe(a)
    primera.resolver(1)
    expect(await a).toBe(1)
    expect(await b).toBe(2)
  })

  it('el cierre no se fusiona, y un autoguardado posterior va detrás de él', async () => {
    const cola = crearColaGuardado()
    const primera = diferida()
    const orden: string[] = []
    void cola.encolar(() => primera.promesa)
    const auto = cola.encolar(ya(() => { orden.push('auto') }), { fusionable: true })
    const cierre = cola.encolar(ya(() => { orden.push('cierre') }))
    const despues = cola.encolar(ya(() => { orden.push('después') }), { fusionable: true })
    expect(despues).not.toBe(auto)
    primera.resolver()
    await Promise.all([auto, cierre, despues])
    expect(orden).toEqual(['auto', 'cierre', 'después'])
  })

  it('una tarea que falla no detiene la cola', async () => {
    const cola = crearColaGuardado()
    const falla = cola.encolar(() => Promise.reject(new Error('red')))
    const sigue = cola.encolar(ya(() => 'ok'))
    await expect(falla).rejects.toThrow('red')
    expect(await sigue).toBe('ok')
  })

  it('ocupada mientras hay algo corriendo o esperando', async () => {
    const cola = crearColaGuardado()
    expect(cola.ocupada()).toBe(false)
    const primera = diferida()
    const p = cola.encolar(() => primera.promesa)
    expect(cola.ocupada()).toBe(true)
    primera.resolver()
    await p
    expect(cola.ocupada()).toBe(false)
  })
})
