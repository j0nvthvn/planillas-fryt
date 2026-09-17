/**
 * Prueba de integración del data layer de la v2 contra STAGING (nunca prod):
 * ejercita guardar_turno, las vistas y los embeds tal como los usa la app.
 *
 *   SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=... pnpm vitest run --mode staging src/test/integracion.staging.test.ts
 *
 * Sin SMOKE_PASSWORD se omite. Usa una fecha aleatoria de 2028 y limpia al final.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/lib/supabase'
import { guardarTurno, cargarTurnosDia, ErrorGuardado } from '@/features/turno/api'

const email = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const password = process.env.SMOKE_PASSWORD
const url = import.meta.env.VITE_SUPABASE_URL as string
const fecha = `2028-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`

describe.skipIf(!password || /kfmwhtbvgqurnpotypii|aecopggpahxjaglakqwd/.test(url))('data layer v2 contra staging', () => {
  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: password! })
    if (error) throw error
  })
  afterAll(async () => {
    await supabase.from('jornadas').delete().eq('fecha', fecha)
    await supabase.from('proveedores_frecuentes').delete().ilike('nombre', `Smoke v2 ${fecha}%`)
    await supabase.auth.signOut()
  })

  it('crea un borrador de día completo y lo cierra con conteo', async () => {
    const r1 = await guardarTurno({ fecha, modo: 'completo', fondo_inicial: 20000, ventas: { efectivo: 100000, getnet: 50000 }, proveedores: [{ nombre: `Smoke v2 ${fecha}`, monto: 30000, forma_pago: 'efectivo' }] })
    expect(r1.conflicto).toBe(false)
    if (r1.conflicto) return
    expect(r1.turno.modo).toBe('completo')
    expect(r1.turno.is_draft).toBe(true)
    expect(Number(r1.turno.efectivo_esperado)).toBe(90000)

    const dia = await cargarTurnosDia(fecha)
    expect(dia).toHaveLength(1)
    expect(dia[0]?.proveedores[0]?.proveedor_id).toBeTruthy()

    const r2 = await guardarTurno({ fecha, modo: 'completo', cerrar: true, efectivo_contado: 85000, base_updated_at: r1.turno.updated_at })
    expect(r2.conflicto).toBe(false)
    if (r2.conflicto) return
    expect(r2.turno.is_draft).toBe(false)
    expect(Number(r2.turno.diferencia_efectivo)).toBe(-5000)
  })

  it('detecta conflicto con una versión base vieja', async () => {
    const r = await guardarTurno({ fecha, modo: 'completo', ventas: { efectivo: 1 }, base_updated_at: '2000-01-01T00:00:00Z' })
    expect(r.conflicto).toBe(true)
  })

  it('rechaza una tarde sobre un día completo con código legible', async () => {
    await expect(guardarTurno({ fecha, modo: 'tarde', ventas: { efectivo: 1 } })).rejects.toMatchObject({ code: '23514' } satisfies Partial<ErrorGuardado>)
  })

  it('las vistas y embeds que usa la app responden', async () => {
    const dia = await cargarTurnosDia(fecha)
    const turnoId = dia[0]!.turno.id
    const cierres = await supabase.from('turno_cierres').select('*, cerrado_por_usuario:usuarios!turno_cierres_cerrado_por_fkey(nombre)').eq('turno_id', turnoId)
    expect(cierres.error).toBeNull()
    expect(cierres.data?.[0]?.cerrado_por_usuario?.nombre).toBeTruthy()

    const resumen = await supabase.from('v_resumen_dia').select('*').eq('fecha', fecha).maybeSingle()
    expect(resumen.data?.estado).toBe('completo')
    expect(resumen.data?.con_descuadre).toBe(true)

    const provId = dia[0]!.proveedores[0]!.proveedor_id!
    const compras = await supabase.from('proveedores_turno').select('id, monto, turno:turnos!proveedores_turno_turno_id_fkey(tipo, deleted_at, jornada:jornadas(fecha))').eq('proveedor_id', provId)
    expect(compras.error).toBeNull()
    expect((compras.data?.[0] as { turno?: { jornada?: { fecha?: string } } } | undefined)?.turno?.jornada?.fecha).toBe(fecha)

    const periodo = await supabase.rpc('resumen_periodo', { p_desde: fecha, p_hasta: fecha })
    expect(periodo.error).toBeNull()
    expect((periodo.data as { totales: { total_ventas: number } }).totales.total_ventas).toBe(150000)

    const papelera = await supabase.from('turnos').select('id, tipo, deleted_at, is_draft, jornada:jornadas(fecha, es_turno_unico), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)').not('deleted_at', 'is', null).limit(1)
    expect(papelera.error).toBeNull()
  })

  it('dividir/unir solo cambia la marca del día: sin corrección ni cambios de montos', async () => {
    const antes = (await cargarTurnosDia(fecha))[0]!.turno
    const r = await guardarTurno({ fecha, modo: 'mañana', cerrar: false, base_updated_at: antes.updated_at })
    expect(r.conflicto).toBe(false)
    if (r.conflicto) return
    expect(r.turno.modo).toBe('mañana')
    expect(r.turno.cantidad_cierres).toBe(antes.cantidad_cierres)
    expect(r.turno.corregido).toBe(false)
    expect(Number(r.turno.total_ventas)).toBe(Number(antes.total_ventas))
    const back = await guardarTurno({ fecha, modo: 'completo', cerrar: false })
    expect(!back.conflicto && back.turno.modo).toBe('completo')
  })

  it('la dueña corrige un turno cerrado y queda auditado', async () => {
    const dia = await cargarTurnosDia(fecha)
    const t = dia[0]!.turno
    const r = await guardarTurno({ fecha, modo: 'completo', ventas: { efectivo: 100000, getnet: 55000 }, cerrar: true, base_updated_at: t.updated_at })
    expect(r.conflicto).toBe(false)
    if (r.conflicto) return
    expect(r.turno.corregido).toBe(true)
    expect(r.turno.cantidad_cierres).toBe(2)
  })
})
