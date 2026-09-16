import { describe, it, expect } from 'vitest'
import { modoPorDefecto, modosDisponibles, etiquetaCerrar } from './modo'

const m = (tipo: 'mañana' | 'tarde', modo: 'completo' | 'mañana' | 'tarde', is_draft = false) => ({ tipo, modo, is_draft })

describe('modoPorDefecto', () => {
  it('sin turnos → día completo', () => {
    expect(modoPorDefecto({ turnos: [], diaUnicoConfig: false })).toBe('completo')
  })
  it('sigue el borrador si existe', () => {
    expect(modoPorDefecto({ turnos: [m('tarde', 'tarde', true)], diaUnicoConfig: false })).toBe('tarde')
  })
  it('mañana cerrada y sin tarde → tarde', () => {
    expect(modoPorDefecto({ turnos: [m('mañana', 'mañana')], diaUnicoConfig: false })).toBe('tarde')
  })
  it('mañana cerrada en día único → se sigue con esa mañana (no se ofrece tarde)', () => {
    expect(modoPorDefecto({ turnos: [m('mañana', 'mañana')], diaUnicoConfig: true })).toBe('mañana')
    expect(modosDisponibles({ turnos: [m('mañana', 'mañana')], diaUnicoConfig: true })).toEqual(['completo', 'mañana'])
  })
  it('día completo ya registrado → completo (corrección)', () => {
    expect(modoPorDefecto({ turnos: [m('mañana', 'completo')], diaUnicoConfig: false })).toBe('completo')
  })
})

describe('modosDisponibles', () => {
  it('día completo registrado: no se puede agregar tarde', () => {
    expect(modosDisponibles({ turnos: [m('mañana', 'completo')], diaUnicoConfig: false })).toEqual(['completo', 'mañana'])
  })
  it('con tarde existente: no se puede marcar completo', () => {
    expect(modosDisponibles({ turnos: [m('mañana', 'mañana'), m('tarde', 'tarde')], diaUnicoConfig: false })).toEqual(['mañana', 'tarde'])
  })
  it('día único por configuración y sin turnos: solo completo', () => {
    expect(modosDisponibles({ turnos: [], diaUnicoConfig: true })).toEqual(['completo'])
  })
  it('día normal sin turnos: los tres', () => {
    expect(modosDisponibles({ turnos: [], diaUnicoConfig: false })).toEqual(['completo', 'mañana', 'tarde'])
  })
})

describe('etiquetaCerrar', () => {
  it('varía según modo y si ya estaba cerrado', () => {
    expect(etiquetaCerrar('completo', false)).toBe('Cerrar el día')
    expect(etiquetaCerrar('tarde', false)).toBe('Cerrar turno tarde')
    expect(etiquetaCerrar('mañana', true)).toBe('Guardar corrección')
  })
})
