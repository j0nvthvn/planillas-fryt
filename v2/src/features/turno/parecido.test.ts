import { describe, expect, it } from 'vitest'
import { distancia, normalizar, proveedorParecido } from './parecido'

const lista = [{ nombre: 'Río Maipo' }, { nombre: 'Nestlé Lácteos' }, { nombre: 'PF' }, { nombre: 'Comercial Gaune' }]
const buscar = (texto: string) => proveedorParecido(normalizar(texto), lista)

describe('distancia', () => {
  it('cuenta las ediciones', () => {
    expect(distancia('riomaipo', 'riomaipo')).toBe(0)
    expect(distancia('riomaipo', 'riomapo')).toBe(1)
    expect(distancia('', 'pf')).toBe(2)
  })
})

describe('proveedorParecido', () => {
  it('propone el del catálogo cuando falta una letra', () => {
    expect(buscar('Rio Maip')?.nombre).toBe('Río Maipo')
  })
  it('no propone nada si ya existe igual (las tildes no cuentan)', () => {
    expect(buscar('rio maipo')).toBeNull()
    expect(buscar('Río Maipo')).toBeNull()
  })
  it('no propone nada para nombres cortos, donde todo se parece', () => {
    expect(buscar('PG')).toBeNull()
  })
  it('no propone un proveedor distinto', () => {
    expect(buscar('Coca Cola')).toBeNull()
  })
  it('tolera dos diferencias en nombres largos', () => {
    expect(buscar('Comercial Gaunne')?.nombre).toBe('Comercial Gaune')
  })
})
