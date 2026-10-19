// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTurnoForm } from './useTurnoForm'
import {
  cargarTurnosDia, guardarTurno, type GuardarTurnoInput, type ProveedorTurno, type TurnoConLineas, type VTurno,
} from './api'
import { qk } from '@/lib/query'
import { logError } from '@/lib/errorLog'

/**
 * El hook contra un servidor simulado que se comporta como guardar_turno y
 * v_turnos: cada guardado cambia updated_at, da id a las líneas nuevas e
 * invalida el día (como invalidarDia), y en un borrador efectivo_contado
 * sale vacío porque solo existe en turno_cierres. Con una versión base
 * distinta de la actual devuelve conflicto, como la RPC. El borrador del
 * dispositivo vive en memoria.
 */
vi.mock('./api', () => ({
  cargarTurnosDia: vi.fn(),
  guardarTurno: vi.fn(),
  ErrorGuardado: class ErrorGuardado extends Error {},
}))
vi.mock('./metricas', () => ({ marcarInicio: vi.fn(), registrarCierre: vi.fn() }))
vi.mock('@/lib/errorLog', () => ({ logError: vi.fn() }))
const locales = vi.hoisted(() => new Map<string, unknown>())
vi.mock('./borradorLocal', () => ({
  leerBorradorLocal: vi.fn((fecha: string, modo: string) => Promise.resolve(locales.get(`${fecha}:${modo}`) ?? null)),
  guardarBorradorLocal: vi.fn((b: { fecha: string; modo: string }) => { locales.set(`${b.fecha}:${b.modo}`, b); return Promise.resolve(true) }),
  borrarBorradorLocal: vi.fn((fecha: string, modo: string) => { locales.delete(`${fecha}:${modo}`); return Promise.resolve() }),
}))

const FECHA = '2026-09-30'
const ESPERA_AUTOGUARDADO = { timeout: 1500 + 1000 }

let servidor: TurnoConLineas | null
let cliente: QueryClient
let siguienteId = 0
let versiones = 0
/** Mientras exista, cada guardado espera a que se resuelva (red lenta). */
let pausa: Promise<void> | null
let enVuelo = 0
let maxEnVuelo = 0

function filaServidor(input: GuardarTurnoInput, anterior: VTurno | undefined): VTurno {
  return {
    ...anterior,
    id: 't1', fecha: input.fecha, tipo: 'mañana', modo: input.modo, jornada_id: 'j1',
    trabajador_id: input.trabajador_id ?? null, fondo_inicial: input.fondo_inicial ?? 0,
    ...input.ventas,
    is_draft: !input.cerrar,
    // v_turnos lo toma del último cierre: un borrador no tiene.
    efectivo_contado: input.cerrar ? input.efectivo_contado ?? null : null,
    // Cada guardado, una versión distinta aunque caigan en el mismo milisegundo.
    updated_at: new Date(Date.parse('2026-09-30T12:00:00Z') + ++versiones).toISOString(),
  } as unknown as VTurno
}

/** Como la RPC: las líneas sin id se insertan (id nuevo) y las de monto 0 no se guardan. */
function lineasServidor(input: GuardarTurnoInput): ProveedorTurno[] {
  return (input.proveedores ?? []).filter((l) => l.monto > 0).map((l) => ({
    id: l.id ?? `p${++siguienteId}`, turno_id: 't1', proveedor_id: l.proveedor_id ?? null,
    nombre: l.nombre, monto: l.monto, forma_pago: l.forma_pago,
  }) as unknown as ProveedorTurno)
}

beforeEach(() => {
  servidor = null
  pausa = null
  enVuelo = 0
  maxEnVuelo = 0
  locales.clear()
  vi.mocked(logError).mockClear()
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(cargarTurnosDia).mockReset().mockImplementation((fecha) => Promise.resolve(servidor?.turno.fecha === fecha ? [servidor] : []))
  vi.mocked(guardarTurno).mockReset().mockImplementation(async (input) => {
    enVuelo += 1
    maxEnVuelo = Math.max(maxEnVuelo, enVuelo)
    try {
      if (pausa) await pausa
      if (servidor && input.base_updated_at && input.base_updated_at !== servidor.turno.updated_at) {
        return { conflicto: true, actual: servidor.turno }
      }
      servidor = { turno: filaServidor(input, servidor?.turno), proveedores: lineasServidor(input) }
      void cliente.invalidateQueries({ queryKey: qk.turnosDia(input.fecha) })
      return { conflicto: false, turno: servidor.turno }
    } finally { enVuelo -= 1 }
  })
})

function montar() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return renderHook(({ fecha }: { fecha: string }) => useTurnoForm({ fecha, modo: 'completo', fondoPorDefecto: 0, online: true }), {
    wrapper, initialProps: { fecha: FECHA },
  })
}

type Hook = ReturnType<typeof montar>['result']

/** Pasa el debounce, se guarda el borrador y el día se vuelve a consultar. */
async function esperarAutoguardado(result: Hook, guardados = 1) {
  await waitFor(() => expect(guardarTurno).toHaveBeenCalledTimes(guardados), ESPERA_AUTOGUARDADO)
  await waitFor(() => expect(cargarTurnosDia).toHaveBeenCalledTimes(guardados + 1))
  await waitFor(() => expect(result.current.state.sucio).toBe(false))
  await act(() => new Promise((r) => setTimeout(r, 50)))
}

describe('useTurnoForm: conteo de caja', () => {
  // El autoguardado no envía el conteo; antes, el refetch que dispara
  // recargaba el formulario desde el servidor y el conteo desaparecía antes
  // de cerrar (0 de 16 cierres con conteo en producción).
  it('conserva el conteo hasta el cierre aunque pase un autoguardado entre medio', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.state.cargado).toBe(true))

    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 120000 }))
    act(() => result.current.cambiar({ type: 'caja', conto: true, monto: 100000, desglose: { 20000: 5 } }))
    await esperarAutoguardado(result)

    expect(result.current.state.contoCaja).toBe(true)
    expect(result.current.state.efectivoContado).toBe(100000)
    expect(result.current.state.desgloseConteo).toEqual({ 20000: 5 })

    await act(async () => { await result.current.cerrar() })
    const cierre = vi.mocked(guardarTurno).mock.calls.at(-1)?.[0]
    expect(cierre).toMatchObject({ cerrar: true, efectivo_contado: 100000 })
  })

  it('al reabrir la pantalla después de un autoguardado, el conteo sigue ahí', async () => {
    const primera = montar()
    await waitFor(() => expect(primera.result.current.state.cargado).toBe(true))
    act(() => primera.result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 120000 }))
    act(() => primera.result.current.cambiar({ type: 'caja', conto: true, monto: 100000, desglose: { 20000: 5 } }))
    await esperarAutoguardado(primera.result)
    primera.unmount()

    const segunda = montar()
    await waitFor(() => expect(segunda.result.current.state.cargado).toBe(true))
    expect(segunda.result.current.state.contoCaja).toBe(true)
    expect(segunda.result.current.state.efectivoContado).toBe(100000)
    expect(segunda.result.current.state.ventas.efectivo).toBe(120000)
  })
})

describe('useTurnoForm: refetch después de guardar', () => {
  it('una línea nueva recibe su id sin cambiar de key, y editarla no la duplica', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.state.cargado).toBe(true))
    const linea = { key: 'nueva', nombre: 'PF', monto: 5000, forma_pago: 'efectivo' as const }
    act(() => result.current.cambiar({ type: 'proveedor', linea }))
    await esperarAutoguardado(result)

    expect(result.current.state.proveedores).toEqual([expect.objectContaining({ key: 'nueva', id: 'p1' })])

    // La hoja se abrió antes de que llegara el id y devuelve la línea sin él.
    act(() => result.current.cambiar({ type: 'proveedor', linea: { ...linea, monto: 6000 } }))
    expect(result.current.state.proveedores).toEqual([expect.objectContaining({ key: 'nueva', id: 'p1', monto: 6000 })])
    await esperarAutoguardado(result, 2)
    expect(servidor?.proveedores).toEqual([expect.objectContaining({ id: 'p1', monto: 6000 })])
  })

  it('un cambio guardado desde otro dispositivo sí se carga', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.state.cargado).toBe(true))
    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 120000 }))
    await esperarAutoguardado(result)

    servidor = {
      turno: { ...servidor!.turno, efectivo: 130000, updated_at: new Date(Date.now() + 60_000).toISOString() },
      proveedores: [],
    }
    await act(() => cliente.invalidateQueries({ queryKey: qk.turnosDia(FECHA) }))
    await waitFor(() => expect(result.current.state.ventas.efectivo).toBe(130000))
  })
})

describe('useTurnoForm: una solicitud a la vez', () => {
  // Antes, Cerrar salía con la misma versión base que el autoguardado en
  // curso; la RPC cambia updated_at en cada guardado, así que el cierre
  // recibía «Este turno cambió en otro dispositivo».
  it('cerrar con un autoguardado en curso espera y no se genera un conflicto propio', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.state.cargado).toBe(true))
    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 120000 }))
    await esperarAutoguardado(result)

    let soltar!: () => void
    pausa = new Promise((r) => { soltar = r })
    act(() => result.current.cambiar({ type: 'venta', key: 'getnet', monto: 30000 }))
    await waitFor(() => expect(guardarTurno).toHaveBeenCalledTimes(2), ESPERA_AUTOGUARDADO)

    let cierre!: ReturnType<typeof result.current.cerrar>
    act(() => { cierre = result.current.cerrar() })
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(guardarTurno).toHaveBeenCalledTimes(2)
    pausa = null
    soltar()

    await act(async () => { expect(await cierre).toEqual({ estado: 'ok' }) })
    expect(maxEnVuelo).toBe(1)
    expect(result.current.conflicto).toBeNull()
    const [, auto, cerrar] = vi.mocked(guardarTurno).mock.calls.map((c) => c[0])
    expect(cerrar).toMatchObject({ cerrar: true, ventas: expect.objectContaining({ efectivo: 120000, getnet: 30000 }) })
    expect(cerrar!.base_updated_at).not.toBe(auto!.base_updated_at)
  }, 10_000)
})

describe('useTurnoForm: errores y conflictos', () => {
  // Con la consulta caída, el formulario se abría vacío y el primer dato
  // salía sin versión base: la RPC sobrescribía el borrador del servidor.
  it('si falla la consulta del día no se abre el formulario ni se guarda nada', async () => {
    vi.mocked(cargarTurnosDia).mockRejectedValueOnce(new Error('sin red'))
    const { result } = montar()
    await waitFor(() => expect(result.current.errorDia).toBe(true))
    expect(result.current.state.cargado).toBe(false)
    expect(guardarTurno).not.toHaveBeenCalled()

    act(() => result.current.reintentarDia())
    await waitFor(() => expect(result.current.state.cargado).toBe(true))
    expect(result.current.errorDia).toBe(false)
  })

  it('con un conflicto pendiente no se manda nada más, lo local se conserva y queda registrado', async () => {
    const { result } = montar()
    await waitFor(() => expect(result.current.state.cargado).toBe(true))
    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 120000 }))
    await esperarAutoguardado(result)

    // Otro dispositivo guarda; este no se entera hasta su próximo guardado.
    servidor = { ...servidor!, turno: { ...servidor!.turno, efectivo: 1, updated_at: new Date(Date.now() + 60_000).toISOString() } }
    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 125000 }))
    await waitFor(() => expect(result.current.conflicto).not.toBeNull(), ESPERA_AUTOGUARDADO)
    expect(result.current.conflicto?.alCerrar).toBe(false)
    expect(logError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ contexto: 'guardar' }))

    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 126000 }))
    await act(() => new Promise((r) => setTimeout(r, 2000)))
    expect(guardarTurno).toHaveBeenCalledTimes(2)
    expect(result.current.state.ventas.efectivo).toBe(126000)

    // Cerrar no manda nada, pero «reemplazar» pasa a cerrar también.
    await act(async () => { expect(await result.current.cerrar()).toEqual({ estado: 'conflicto' }) })
    expect(guardarTurno).toHaveBeenCalledTimes(2)
    expect(result.current.conflicto?.alCerrar).toBe(true)

    await act(async () => { expect(await result.current.sobrescribir(true)).toEqual({ estado: 'ok' }) })
    expect(vi.mocked(guardarTurno).mock.calls.at(-1)?.[0]).toMatchObject({ cerrar: true, base_updated_at: null, ventas: expect.objectContaining({ efectivo: 126000 }) })
    expect(result.current.conflicto).toBeNull()
  }, 10_000)
})

describe('useTurnoForm: lo pendiente', () => {
  it('al abrir, recupera lo que no alcanzó a subir y lo sube sin esperar otra edición', async () => {
    locales.set(`${FECHA}:completo`, {
      fecha: FECHA, modo: 'completo', trabajadorId: null, fondoInicial: 0, ventas: { efectivo: 7000 }, proveedores: [],
      efectivoContado: null, contoCaja: false, guardadoEn: 0, baseUpdatedAt: null, pendiente: true,
    })
    const { result } = montar()
    await waitFor(() => expect(result.current.listo).toBe(true))
    expect(result.current.state.ventas.efectivo).toBe(7000)
    expect(result.current.sync).toBe('pendiente')
    await esperarAutoguardado(result)
    expect(servidor?.turno).toMatchObject({ efectivo: 7000 })
    expect(result.current.sync).toBe('sincronizado')
  })

  it('al cambiar de fecha, lo pendiente sale antes con su fecha y no se mezcla con la nueva', async () => {
    const OTRA = '2026-09-29'
    const { result, rerender } = montar()
    await waitFor(() => expect(result.current.listo).toBe(true))
    act(() => result.current.cambiar({ type: 'venta', key: 'efectivo', monto: 9000 }))
    rerender({ fecha: OTRA })
    expect(result.current.listo).toBe(false)

    await waitFor(() => expect(result.current.listo).toBe(true))
    expect(guardarTurno).toHaveBeenCalledTimes(1)
    expect(vi.mocked(guardarTurno).mock.calls[0]?.[0]).toMatchObject({ fecha: FECHA, ventas: expect.objectContaining({ efectivo: 9000 }) })
    expect(result.current.state.ventas.efectivo).toBe(0)
    expect(result.current.state.sucio).toBe(false)

    // Pasado el debounce no sale nada más: ni lo viejo con la fecha nueva.
    await act(() => new Promise((r) => setTimeout(r, 2000)))
    expect(guardarTurno).toHaveBeenCalledTimes(1)
  }, 10_000)
})

describe('useTurnoForm: fondo por defecto', () => {
  function montarConFondo(fondo: number | null) {
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    return renderHook(({ fondo }: { fondo: number | null }) => useTurnoForm({ fecha: FECHA, modo: 'completo', fondoPorDefecto: fondo, online: true }), {
      wrapper, initialProps: { fondo },
    })
  }

  // Con la configuración lenta el día llegaba antes y el turno nuevo partía
  // con el fondo de CONFIG_DEFAULT ($0); la configuración ya no lo cambiaba.
  it('un turno nuevo espera la configuración para tomar el fondo', async () => {
    const { result, rerender } = montarConFondo(null)
    await waitFor(() => expect(cargarTurnosDia).toHaveBeenCalled())
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(result.current.listo).toBe(false)

    rerender({ fondo: 50000 })
    await waitFor(() => expect(result.current.listo).toBe(true))
    expect(result.current.state.fondoInicial).toBe(50000)
  })

  it('un fondo ya editado no cambia si la configuración se actualiza', async () => {
    const { result, rerender } = montarConFondo(50000)
    await waitFor(() => expect(result.current.listo).toBe(true))
    act(() => result.current.cambiar({ type: 'fondo', monto: 30000 }))
    rerender({ fondo: 60000 })
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(result.current.state.fondoInicial).toBe(30000)
  })
})
