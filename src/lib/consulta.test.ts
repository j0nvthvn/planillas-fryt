import { describe, it, expect } from 'vitest'
import { vistaDe } from './consulta'

const lista = { data: [1], isPending: false, isError: false }
const cargando = { data: undefined, isPending: true, isError: false }
const fallo = { data: undefined, isPending: false, isError: true }
const falloConDatos = { data: [1], isPending: false, isError: true }

describe('vistaDe', () => {
  it('una falla sin datos es error, nunca una pantalla vacía', () => {
    expect(vistaDe(fallo)).toEqual({ vista: 'error', desactualizado: false })
    expect(vistaDe(lista, fallo)).toEqual({ vista: 'error', desactualizado: false })
  })

  it('el error pesa más que la carga: no queda un spinner para siempre', () => {
    expect(vistaDe(cargando, fallo).vista).toBe('error')
  })

  it('mientras falte cualquiera, carga', () => {
    expect(vistaDe(lista, cargando)).toEqual({ vista: 'cargando', desactualizado: false })
  })

  it('con datos previos y un refresco fallido, se muestran avisando', () => {
    expect(vistaDe(lista, falloConDatos)).toEqual({ vista: 'datos', desactualizado: true })
    expect(vistaDe(lista)).toEqual({ vista: 'datos', desactualizado: false })
  })

  it('null es un dato (un día sin jornada), no una falla', () => {
    expect(vistaDe({ data: null, isPending: false, isError: false }).vista).toBe('datos')
  })
})
