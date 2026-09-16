import { describe, it, expect } from 'vitest'
import { applyKey, numeroADigitos, digitosANumero } from './Keypad'

describe('applyKey', () => {
  it('agrega dígitos y borra', () => {
    expect(applyKey('', '5')).toBe('5')
    expect(applyKey('5', '0')).toBe('50')
    expect(applyKey('50', 'del')).toBe('5')
    expect(applyKey('', 'del')).toBe('')
  })
  it('000 solo si ya hay algo; sin ceros a la izquierda', () => {
    expect(applyKey('', '000')).toBe('')
    expect(applyKey('12', '000')).toBe('12000')
    expect(applyKey('0', '0')).toBe('0')
    expect(applyKey('0', '7')).toBe('7')
  })
  it('máximo 9 dígitos', () => {
    expect(applyKey('123456789', '0')).toBe('123456789')
  })
  it('conversión ida y vuelta', () => {
    expect(numeroADigitos(15000)).toBe('15000')
    expect(numeroADigitos(0)).toBe('')
    expect(numeroADigitos(null)).toBe('')
    expect(digitosANumero('15000')).toBe(15000)
  })
})
