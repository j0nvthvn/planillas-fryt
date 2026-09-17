import { describe, expect, it } from 'vitest'
import { correoValido } from './api'

describe('correoValido', () => {
  it('acepta correos comunes, con espacios alrededor', () => {
    expect(correoValido('frytspa@gmail.com')).toBe(true)
    expect(correoValido('  contador@empresa.cl ')).toBe(true)
  })
  it('rechaza lo que Resend no podría enviar', () => {
    expect(correoValido('')).toBe(false)
    expect(correoValido('frytspa@gmail')).toBe(false)
    expect(correoValido('frytspa gmail.com')).toBe(false)
    expect(correoValido('a b@c.cl')).toBe(false)
  })
})
