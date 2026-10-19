import { describe, it, expect } from 'vitest'
import {
  cargaInicial, debeAutoguardar, debeEnviarAlSalir, desdeLocal, desdeServidor, esEscrituraPropia, idsLineasNuevas,
  inicial, mismaVersion, reducer, textoGuardado, tieneContenido,
  type FormState,
} from './estadoTurno'
import type { TurnoConLineas, VTurno } from './api'
import type { BorradorLocal } from './borradorLocal'

/** Turno del servidor con lo mínimo que usa el formulario. */
function turno(p: Partial<VTurno> = {}, proveedores: TurnoConLineas['proveedores'] = []): TurnoConLineas {
  return {
    turno: {
      id: 't1', fecha: '2026-09-18', tipo: 'mañana', modo: 'completo', is_draft: true, jornada_id: 'j1',
      updated_at: '2026-09-18T10:00:00Z', trabajador_id: null, fondo_inicial: 20000,
      efectivo: 1000, getnet: 2000, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0,
      efectivo_contado: null,
      ...p,
    } as unknown as VTurno,
    proveedores,
  }
}

function borrador(p: Partial<BorradorLocal> = {}): BorradorLocal {
  return {
    fecha: '2026-09-18', modo: 'completo', trabajadorId: null, fondoInicial: 20000,
    ventas: { efectivo: 5000 }, proveedores: [], efectivoContado: null, contoCaja: false,
    guardadoEn: Date.parse('2026-09-18T12:00:00Z'), baseUpdatedAt: null,
    ...p,
  }
}

function estado(p: Partial<FormState> = {}): FormState {
  return { ...inicial, cargado: true, ...p }
}

describe('reducer', () => {
  it('una venta ensucia el estado y deja el resto igual', () => {
    const s = reducer(estado(), { type: 'venta', key: 'efectivo', monto: 3000 })
    expect(s.ventas.efectivo).toBe(3000)
    expect(s.ventas.getnet).toBe(0)
    expect(s.sucio).toBe(true)
  })

  it('un proveedor con la misma key reemplaza, no duplica', () => {
    const linea = { key: 'a', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' as const }
    let s = reducer(estado(), { type: 'proveedor', linea })
    s = reducer(s, { type: 'proveedor', linea: { ...linea, monto: 2500 } })
    expect(s.proveedores).toHaveLength(1)
    expect(s.proveedores[0]!.monto).toBe(2500)
  })

  it('una línea devuelta sin id por una hoja abierta antes conserva el id que ya tenía', () => {
    const linea = { key: 'a', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' as const }
    let s = reducer(estado(), { type: 'proveedor', linea })
    s = reducer(s, { type: 'idsLineas', ids: { a: 'p1' } })
    s = reducer(s, { type: 'proveedor', linea: { ...linea, monto: 2500 } })
    expect(s.proveedores).toEqual([expect.objectContaining({ key: 'a', id: 'p1', monto: 2500 })])
  })

  it('asignar ids no cambia las keys, no pisa ids existentes y no ensucia', () => {
    const s = reducer(estado({
      proveedores: [
        { key: 'a', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' },
        { key: 'b', id: 'viejo', nombre: 'Río Maipo', monto: 500, forma_pago: 'transferencia' },
      ],
    }), { type: 'idsLineas', ids: { a: 'p1', b: 'otro' } })
    expect(s.proveedores.map((p) => [p.key, p.id])).toEqual([['a', 'p1'], ['b', 'viejo']])
    expect(s.sucio).toBe(false)
  })

  it('quitar un proveedor deja los demás', () => {
    let s = reducer(estado(), { type: 'proveedor', linea: { key: 'a', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' } })
    s = reducer(s, { type: 'proveedor', linea: { key: 'b', nombre: 'Río Maipo', monto: 500, forma_pago: 'transferencia' } })
    s = reducer(s, { type: 'quitarProveedor', key: 'a' })
    expect(s.proveedores.map((p) => p.nombre)).toEqual(['Río Maipo'])
  })

  it('destildar el conteo borra el monto y el desglose', () => {
    let s = reducer(estado(), { type: 'caja', conto: true, monto: 48000, desglose: { 1000: 48 } })
    expect(s.efectivoContado).toBe(48000)
    s = reducer(s, { type: 'caja', conto: false, monto: null })
    expect(s.efectivoContado).toBeNull()
    expect(s.desgloseConteo).toBeNull()
  })

  it('una carga parte limpia salvo que el origen traiga cambios sin subir', () => {
    expect(reducer(estado({ sucio: true }), { type: 'cargar', state: { fondoInicial: 20000 } })).toMatchObject({ sucio: false, cargado: true })
    expect(reducer(estado(), { type: 'cargar', state: { fondoInicial: 20000, sucio: true } }).sucio).toBe(true)
  })

  it('sincronizado guarda la versión del servidor y respeta lo que se escribió mientras viajaba', () => {
    const s = reducer(estado({ sucio: true }), {
      type: 'sincronizado',
      turno: { id: 't9', updated_at: '2026-09-18T11:00:00Z' } as VTurno,
      sucio: true,
    })
    expect(s.turnoId).toBe('t9')
    expect(s.baseUpdatedAt).toBe('2026-09-18T11:00:00Z')
    expect(s.sucio).toBe(true)
  })

  it('sincronizado sin cambios pendientes deja el estado limpio', () => {
    const s = reducer(estado({ sucio: true }), {
      type: 'sincronizado', turno: { id: 't9', updated_at: 'x' } as VTurno, sucio: false,
    })
    expect(s.sucio).toBe(false)
  })
})

describe('desdeServidor', () => {
  it('trae los seis métodos, el fondo y las líneas de proveedor', () => {
    const s = desdeServidor(turno({ efectivo_contado: 48000 }, [
      { id: 'p1', proveedor_id: 'c1', nombre: 'PF', monto: 1500, forma_pago: 'transferencia' } as never,
    ]))
    expect(s.ventas).toEqual({ efectivo: 1000, getnet: 2000, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 })
    expect(s.fondoInicial).toBe(20000)
    expect(s.proveedores![0]).toMatchObject({ key: 'p1', id: 'p1', nombre: 'PF', monto: 1500, forma_pago: 'transferencia' })
    expect(s.contoCaja).toBe(true)
  })

  it('un turno que ya no es borrador llega como cerrado', () => {
    expect(desdeServidor(turno({ is_draft: false })).cerrado).toBe(true)
  })

  it('una forma de pago desconocida cae en efectivo', () => {
    const s = desdeServidor(turno({}, [{ id: 'p1', nombre: 'X', monto: 10, forma_pago: 'otra' } as never]))
    expect(s.proveedores![0]!.forma_pago).toBe('efectivo')
  })
})

describe('desdeLocal', () => {
  it('completa los métodos que el borrador no trae', () => {
    const s = desdeLocal(borrador(), undefined)
    expect(s.ventas).toEqual({ efectivo: 5000, getnet: 0, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 0 })
  })

  it('sin turno en el servidor no hay id ni cierre, y la versión base es la del borrador', () => {
    const s = desdeLocal(borrador({ baseUpdatedAt: '2026-09-18T09:00:00Z' }), undefined)
    expect(s.turnoId).toBeNull()
    expect(s.cerrado).toBe(false)
    expect(s.baseUpdatedAt).toBe('2026-09-18T09:00:00Z')
  })

  it('con turno en el servidor toma su id y su versión, no la del borrador', () => {
    const s = desdeLocal(borrador({ baseUpdatedAt: 'vieja' }), turno())
    expect(s.turnoId).toBe('t1')
    expect(s.baseUpdatedAt).toBe('2026-09-18T10:00:00Z')
  })

  it('las líneas sin id de base reciben una key propia', () => {
    const s = desdeLocal(borrador({ proveedores: [{ nombre: 'PF', monto: 100, forma_pago: 'efectivo' }] }), undefined)
    expect(s.proveedores![0]!.key).toBeTruthy()
  })
})

describe('cargaInicial', () => {
  it('sin nada, abre con el fondo por defecto', () => {
    const r = cargaInicial({ servidor: undefined, local: null, fondoPorDefecto: 20000 })
    expect(r.state).toEqual({ fondoInicial: 20000 })
    expect(r.descartarLocal).toBe(false)
  })

  it('el borrador local gana si es más nuevo que el turno del servidor', () => {
    const r = cargaInicial({ servidor: turno(), local: borrador(), fondoPorDefecto: 0 })
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.descartarLocal).toBe(false)
  })

  it('el servidor gana si su turno es más nuevo, y el borrador viejo se descarta', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: '2026-09-18T13:00:00Z' }),
      local: borrador(),
      fondoPorDefecto: 0,
    })
    expect(r.state.ventas?.efectivo).toBe(1000)
    expect(r.descartarLocal).toBe(true)
  })

  it('sobre un turno ya cerrado manda el servidor aunque lo local sea más nuevo', () => {
    const r = cargaInicial({ servidor: turno({ is_draft: false }), local: borrador(), fondoPorDefecto: 0 })
    expect(r.state.ventas?.efectivo).toBe(1000)
    expect(r.state.cerrado).toBe(true)
    expect(r.descartarLocal).toBe(true)
  })

  it('el borrador local editado sobre la versión vigente gana aunque el reloj del dispositivo vaya atrasado', () => {
    // Después de un autoguardado el borrador queda con la versión nueva y
    // con el conteo, que el servidor no tiene.
    const r = cargaInicial({
      servidor: turno({ updated_at: '2026-09-18T13:00:00Z' }),
      local: borrador({ baseUpdatedAt: '2026-09-18T13:00:00Z', contoCaja: true, efectivoContado: 21000 }),
      fondoPorDefecto: 0,
    })
    expect(r.state.efectivoContado).toBe(21000)
    expect(r.descartarLocal).toBe(false)
  })

  it('sin turno en el servidor, el borrador local se recupera', () => {
    const r = cargaInicial({ servidor: undefined, local: borrador(), fondoPorDefecto: 0 })
    expect(r.state.ventas?.efectivo).toBe(5000)
  })
})

describe('tieneContenido', () => {
  it('es falso con todo en cero', () => {
    expect(tieneContenido(estado())).toBe(false)
  })
  it('basta una venta o un proveedor con monto', () => {
    expect(tieneContenido(estado({ ventas: { ...inicial.ventas, edenred: 10 } }))).toBe(true)
    expect(tieneContenido(estado({ proveedores: [{ key: 'a', nombre: 'PF', monto: 1, forma_pago: 'efectivo' }] }))).toBe(true)
  })
})

describe('debeAutoguardar', () => {
  const sucioConContenido = estado({ sucio: true, ventas: { ...inicial.ventas, efectivo: 100 } })

  it('manda cuando hay cambios, contenido y conexión', () => {
    expect(debeAutoguardar(sucioConContenido, { online: true, guardando: false })).toBe(true)
  })

  it('no manda sin cambios, sin conexión, cerrando o sobre un turno cerrado', () => {
    expect(debeAutoguardar(estado({ ventas: sucioConContenido.ventas }), { online: true, guardando: false })).toBe(false)
    expect(debeAutoguardar(sucioConContenido, { online: false, guardando: false })).toBe(false)
    expect(debeAutoguardar(sucioConContenido, { online: true, guardando: true })).toBe(false)
    expect(debeAutoguardar({ ...sucioConContenido, cerrado: true }, { online: true, guardando: false })).toBe(false)
  })

  it('sin contenido espera al primer dato, salvo que el borrador ya exista en el servidor', () => {
    const vacio = estado({ sucio: true })
    expect(debeAutoguardar(vacio, { online: true, guardando: false })).toBe(false)
    expect(debeAutoguardar({ ...vacio, turnoId: 't1' }, { online: true, guardando: false })).toBe(true)
  })
})

describe('debeEnviarAlSalir', () => {
  it('manda lo pendiente al salir, pero no si no hay conexión', () => {
    const s = estado({ sucio: true, ventas: { ...inicial.ventas, efectivo: 100 } })
    expect(debeEnviarAlSalir(s, true)).toBe(true)
    expect(debeEnviarAlSalir(s, false)).toBe(false)
  })

  it('no manda si no hay nada que guardar', () => {
    expect(debeEnviarAlSalir(estado(), true)).toBe(false)
  })
})

describe('mismaVersion', () => {
  it('compara updated_at aunque el formato cambie', () => {
    expect(mismaVersion('2026-09-18T10:00:00Z', '2026-09-18T10:00:00Z')).toBe(true)
    expect(mismaVersion('2026-09-18T10:00:00.000Z', '2026-09-18T10:00:00+00:00')).toBe(true)
    expect(mismaVersion('2026-09-18T10:00:00Z', '2026-09-18T10:00:01Z')).toBe(false)
  })

  it('sin versión no hay coincidencia', () => {
    expect(mismaVersion(null, null)).toBe(false)
    expect(mismaVersion('2026-09-18T10:00:00Z', undefined)).toBe(false)
  })
})

describe('esEscrituraPropia', () => {
  const guardado = estado({ turnoId: 't1', baseUpdatedAt: '2026-09-18T10:00:00Z' })

  it('el turno que el formulario acaba de guardar, en la misma versión', () => {
    expect(esEscrituraPropia(turno(), guardado)).toBe(true)
  })

  it('no lo es si otro guardó después, si es otro turno o si cambió el cierre', () => {
    expect(esEscrituraPropia(turno({ updated_at: '2026-09-18T11:00:00Z' }), guardado)).toBe(false)
    expect(esEscrituraPropia(turno({ id: 't2' }), guardado)).toBe(false)
    expect(esEscrituraPropia(turno({ is_draft: false }), guardado)).toBe(false)
    expect(esEscrituraPropia(undefined, guardado)).toBe(false)
  })

  it('no lo es antes de la primera carga', () => {
    expect(esEscrituraPropia(turno(), { ...guardado, cargado: false })).toBe(false)
  })
})

describe('idsLineasNuevas', () => {
  const lineaServidor = (p: Partial<TurnoConLineas['proveedores'][number]>) => ({
    id: 'p1', turno_id: 't1', proveedor_id: null, nombre: 'PF', monto: 1000, forma_pago: 'efectivo', ...p,
  }) as TurnoConLineas['proveedores'][number]

  it('empareja por proveedor del catálogo, monto y forma de pago', () => {
    const ids = idsLineasNuevas(
      [{ key: 'a', proveedor_id: 'cat1', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' }],
      [lineaServidor({ id: 'p9', proveedor_id: 'cat1', nombre: 'Pf Alimentos' })],
    )
    expect(ids).toEqual({ a: 'p9' })
  })

  it('sin catálogo empareja por nombre normalizado', () => {
    const ids = idsLineasNuevas(
      [{ key: 'a', nombre: 'Río Maipo', monto: 500, forma_pago: 'transferencia' }],
      [lineaServidor({ id: 'p2', nombre: 'rio maipo', monto: '500' as unknown as number, forma_pago: 'transferencia' })],
    )
    expect(ids).toEqual({ a: 'p2' })
  })

  it('no reutiliza una línea ya reclamada ni empareja montos o formas distintas', () => {
    const ids = idsLineasNuevas(
      [
        { key: 'x', id: 'p1', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' },
        { key: 'a', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' },
        { key: 'b', nombre: 'PF', monto: 1000, forma_pago: 'efectivo' },
        { key: 'c', nombre: 'PF', monto: 1000, forma_pago: 'transferencia' },
      ],
      [lineaServidor({ id: 'p1' }), lineaServidor({ id: 'p2' })],
    )
    expect(ids).toEqual({ a: 'p2' })
  })

  it('las líneas en cero no se guardan en el servidor y quedan sin id', () => {
    expect(idsLineasNuevas([{ key: 'a', nombre: 'PF', monto: 0, forma_pago: 'efectivo' }], [lineaServidor({})])).toEqual({})
  })
})

describe('cargaInicial con cambios sin subir (pendiente)', () => {
  const V1 = '2026-09-18T10:00:00Z'
  const V2 = '2026-09-18T13:00:00Z'

  it('editado sobre la versión vigente y sin subir: gana lo local y abre sucio, aunque el reloj vaya atrasado', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V1 }),
      local: borrador({ baseUpdatedAt: V1, pendiente: true, guardadoEn: Date.parse('2020-01-01T00:00:00Z') }),
      fondoPorDefecto: 0,
    })
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.state.sucio).toBe(true)
    expect(r.conflicto).toBeNull()
    expect(r.descartarLocal).toBe(false)
  })

  it('editado sobre la versión vigente y ya subido: gana lo local, limpio (trae el conteo)', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V1 }),
      local: borrador({ baseUpdatedAt: V1, pendiente: false, contoCaja: true, efectivoContado: 21000 }),
      fondoPorDefecto: 0,
    })
    expect(r.state.efectivoContado).toBe(21000)
    expect(r.state.sucio).toBe(false)
  })

  it('editado sobre otra versión y sin subir: abre lo local con el conflicto, sin descartarlo', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V2 }),
      local: borrador({ baseUpdatedAt: V1, pendiente: true }),
      fondoPorDefecto: 0,
    })
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.state.baseUpdatedAt).toBe(V1)
    expect(r.state.sucio).toBe(true)
    expect(r.conflicto?.updated_at).toBe(V2)
    expect(r.descartarLocal).toBe(false)
  })

  it('editado sobre otra versión y ya subido: gana el servidor aunque lo local parezca más nuevo', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V2 }),
      local: borrador({ baseUpdatedAt: V1, pendiente: false, guardadoEn: Date.parse('2030-01-01T00:00:00Z') }),
      fondoPorDefecto: 0,
    })
    expect(r.state.ventas?.efectivo).toBe(1000)
    expect(r.descartarLocal).toBe(true)
  })

  it('una corrección sin guardar sobre el turno cerrado se recupera', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V1, is_draft: false }),
      local: borrador({ baseUpdatedAt: V1, pendiente: true }),
      fondoPorDefecto: 0,
    })
    expect(r.state.cerrado).toBe(true)
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.state.sucio).toBe(true)
  })

  it('una corrección sobre un cierre que cambió: conflicto que, al reemplazar, cierra', () => {
    const r = cargaInicial({
      servidor: turno({ updated_at: V2, is_draft: false }),
      local: borrador({ baseUpdatedAt: V1, pendiente: true }),
      fondoPorDefecto: 0,
    })
    expect(r.conflicto?.is_draft).toBe(false)
  })

  it('sin turno en el servidor: lo que nunca se subió se recupera para subirlo', () => {
    const r = cargaInicial({ servidor: undefined, local: borrador({ baseUpdatedAt: null, pendiente: true }), fondoPorDefecto: 0 })
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.state.sucio).toBe(true)
  })

  it('sin turno en el servidor y ya subido: se borró a propósito, no se revive', () => {
    const r = cargaInicial({ servidor: undefined, local: borrador({ baseUpdatedAt: V1, pendiente: false }), fondoPorDefecto: 20000 })
    expect(r.state).toEqual({ fondoInicial: 20000 })
    expect(r.descartarLocal).toBe(true)
  })

  it('sin turno en el servidor pero con cambios sin subir: se recupera sin versión base', () => {
    const r = cargaInicial({ servidor: undefined, local: borrador({ baseUpdatedAt: V1, pendiente: true }), fondoPorDefecto: 0 })
    expect(r.state.ventas?.efectivo).toBe(5000)
    expect(r.state.baseUpdatedAt).toBeNull()
    expect(r.state.sucio).toBe(true)
  })
})

describe('textoGuardado', () => {
  const t = (sync: Parameters<typeof textoGuardado>[0]['sync'], cerrado = false, localOk = true) => textoGuardado({ sync, cerrado, localOk })?.texto ?? null

  it('separa lo guardado en el dispositivo de lo sincronizado', () => {
    expect(t('pendiente')).toBe('Guardado en este dispositivo')
    expect(t('enviando')).toBe('Guardando…')
    expect(t('sincronizado')).toBe('Borrador sincronizado')
    expect(t('nuevo')).toBeNull()
  })

  it('sin almacenamiento local, lo pendiente no está guardado en ninguna parte', () => {
    expect(t('pendiente', false, false)).toBe('Sin guardar')
  })

  it('en un turno cerrado no habla de borradores', () => {
    expect(t('pendiente', true)).toBe('Corrección sin guardar')
    expect(t('sincronizado', true)).toBeNull()
  })

  it('error y conflicto', () => {
    expect(t('error')).toBe('No se pudo guardar')
    expect(textoGuardado({ sync: 'conflicto', cerrado: false, localOk: true })).toEqual({ texto: 'Sin guardar', tono: 'neg' })
  })
})
