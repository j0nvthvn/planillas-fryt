import { describe, it, expect } from 'vitest'
import { estadoDia } from './estadoDia'
import type { TurnoConLineas, VTurno } from '@/features/turno/api'

function turno(p: Partial<VTurno>): TurnoConLineas {
  return { turno: { id: 't', tipo: 'mañana', modo: 'mañana', is_draft: false, ...p } as VTurno, proveedores: [] }
}

const manana = turno({ tipo: 'mañana', modo: 'mañana' })
const tarde = turno({ tipo: 'tarde', modo: 'tarde' })
const completo = turno({ tipo: 'mañana', modo: 'completo' })

describe('estadoDia', () => {
  it('día vacío: la acción es cerrar el día completo', () => {
    const e = estadoDia({ turnos: [], noAbrio: false, diaUnico: false })
    expect(e.cta).toEqual({ label: 'Cerrar el día', modo: 'completo' })
    expect(e.turnosEsperados).toBe(2)
    expect(e.pendiente).toBeNull()
  })

  it('con la mañana cerrada, toca la tarde', () => {
    const e = estadoDia({ turnos: [manana], noAbrio: false, diaUnico: false })
    expect(e.cta).toEqual({ label: 'Cerrar turno tarde', modo: 'tarde' })
    expect(e.pendiente).toBe('tarde')
    expect(e.turnosEsperados).toBe(2)
  })

  it('con la tarde cerrada y sin mañana, la que falta es la mañana', () => {
    const e = estadoDia({ turnos: [tarde], noAbrio: false, diaUnico: false })
    expect(e.pendiente).toBe('mañana')
    expect(e.cta).toBeNull()
  })

  it('mañana y tarde cerradas: no queda nada que hacer', () => {
    const e = estadoDia({ turnos: [manana, tarde], noAbrio: false, diaUnico: false })
    expect(e.cta).toBeNull()
    expect(e.pendiente).toBeNull()
  })

  it('un día completo cuenta por uno solo', () => {
    const e = estadoDia({ turnos: [completo], noAbrio: false, diaUnico: false })
    expect(e.turnosEsperados).toBe(1)
    expect(e.cta).toBeNull()
    expect(e.pendiente).toBeNull()
  })

  it('en un día de un solo turno no se ofrece cerrar la tarde', () => {
    const e = estadoDia({ turnos: [manana], noAbrio: false, diaUnico: true })
    expect(e.cta).toBeNull()
    expect(e.turnosEsperados).toBe(1)
    expect(e.pendiente).toBeNull()
  })

  it('un borrador se termina de cerrar, con su propio texto', () => {
    expect(estadoDia({ turnos: [turno({ modo: 'completo', is_draft: true })], noAbrio: false, diaUnico: false }).cta)
      .toEqual({ label: 'Terminar de cerrar el día', modo: 'completo' })
    expect(estadoDia({ turnos: [turno({ tipo: 'tarde', modo: 'tarde', is_draft: true })], noAbrio: false, diaUnico: false }).cta)
      .toEqual({ label: 'Terminar de cerrar la tarde', modo: 'tarde' })
    expect(estadoDia({ turnos: [turno({ is_draft: true })], noAbrio: false, diaUnico: false }).hayBorrador).toBe(true)
  })

  it('si el local no abrió no hay caja que cerrar', () => {
    expect(estadoDia({ turnos: [], noAbrio: true, diaUnico: false }).cta).toBeNull()
    expect(estadoDia({ turnos: [turno({ is_draft: true })], noAbrio: true, diaUnico: false }).cta).toBeNull()
  })
})
