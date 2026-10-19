import { describe, it, expect } from 'vitest'
import { estadoCatalogo } from './catalogoCierre'

const ok = { data: [], isError: false }
const cargando = { data: undefined, isError: false }
const fallo = { data: undefined, isError: true }

describe('estadoCatalogo', () => {
  it('listo con las tres consultas, aunque un refresco haya fallado', () => {
    expect(estadoCatalogo({ config: ok, metodos: ok, trabajadores: ok })).toBe('listo')
    expect(estadoCatalogo({ config: ok, metodos: { data: [], isError: true }, trabajadores: ok })).toBe('listo')
  })

  // Antes los métodos fallidos dejaban la pantalla sin ventas y con
  // «Cerrar» habilitado.
  it('error si falla una consulta sin copia en caché', () => {
    expect(estadoCatalogo({ config: ok, metodos: fallo, trabajadores: ok })).toBe('error')
    expect(estadoCatalogo({ config: fallo, metodos: ok, trabajadores: cargando })).toBe('error')
  })

  it('cargando mientras falta alguna sin error', () => {
    expect(estadoCatalogo({ config: cargando, metodos: ok, trabajadores: ok })).toBe('cargando')
  })
})
