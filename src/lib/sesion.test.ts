import { describe, it, expect } from 'vitest'
import { debeLimpiarCache } from './sesion'

describe('debeLimpiarCache', () => {
  it('la sesión inicial no borra la caché restaurada', () => {
    expect(debeLimpiarCache(undefined, 'u1')).toBe(false)
    expect(debeLimpiarCache(undefined, null)).toBe(false)
  })
  it('entrar sin sesión previa ni refrescar el token no la borran', () => {
    expect(debeLimpiarCache(null, 'u1')).toBe(false)
    expect(debeLimpiarCache('u1', 'u1')).toBe(false)
  })
  it('cerrar sesión o cambiar de usuario sí la borran', () => {
    expect(debeLimpiarCache('u1', null)).toBe(true)
    expect(debeLimpiarCache('u1', 'u2')).toBe(true)
  })
})
