import { describe, it, expect } from 'vitest'
import { debeLimpiarCache, destinoTrasLogin } from './sesion'

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

describe('destinoTrasLogin', () => {
  it('vuelve a la ruta completa, con fecha, modo y filtros', () => {
    expect(destinoTrasLogin('/turno?fecha=2026-10-13&modo=tarde')).toBe('/turno?fecha=2026-10-13&modo=tarde')
    expect(destinoTrasLogin('/historial?filtro=borradores')).toBe('/historial?filtro=borradores')
  })

  it.each([undefined, '', 'https://otro.cl', '//otro.cl', '/\\otro.cl', '/\\/otro.cl', '/login', '/login?volver=/hoy', 'hoy', '/\u0000x'])('rechaza %j', (v) => {
    expect(destinoTrasLogin(v)).toBe('/hoy')
  })

  it('una ruta que solo empieza con «login» no es el login', () => {
    expect(destinoTrasLogin('/loginx')).toBe('/loginx')
  })
})
