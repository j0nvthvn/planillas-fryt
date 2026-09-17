import { describe, it, expect } from 'vitest'
import { calcularDelta } from './delta'

describe('calcularDelta', () => {
  it('sin dato previo no muestra nada; desde cero es "nuevo"', () => {
    expect(calcularDelta(100, null)).toBeNull()
    expect(calcularDelta(0, 0)).toBeNull()
    expect(calcularDelta(100, 0)).toEqual({ tipo: 'nuevo' })
  })
  it('sube en verde, baja en rojo', () => {
    expect(calcularDelta(157, 100)).toEqual({ tipo: 'cambio', sube: true, bueno: true, texto: '57%' })
    expect(calcularDelta(80, 100)).toEqual({ tipo: 'cambio', sube: false, bueno: false, texto: '20%' })
  })
  it('en gastos la flecha sigue a la cifra y el color se da vuelta', () => {
    // Proveedores: de 11 M a 8,4 M es una baja del 24 %, y es buena noticia.
    expect(calcularDelta(8_384_393, 11_018_000, true)).toEqual({ tipo: 'cambio', sube: false, bueno: true, texto: '24%' })
    expect(calcularDelta(120, 100, true)).toEqual({ tipo: 'cambio', sube: true, bueno: false, texto: '20%' })
  })
  it('si cambia el signo da la diferencia en pesos', () => {
    const d = calcularDelta(1_038_282, -595_654)
    expect(d?.tipo === 'cambio' && d.sube && d.texto.replace(/\s/g, '')).toBe('+$1.633.936')
  })
  it('bajo medio punto es "igual"', () => {
    expect(calcularDelta(1004, 1000)).toEqual({ tipo: 'igual' })
  })
})
