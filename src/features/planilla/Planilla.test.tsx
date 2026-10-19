// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import Planilla from './Planilla'
import { useMetodos } from '@/features/catalogo/api'
import { useResumenDia, useTurnosDia } from '@/features/turno/api'

/**
 * La pantalla con el router y las consultas simulados: lo que se prueba es
 * qué muestra según el estado de cada consulta, no la red.
 */
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({ fecha: '2026-10-15' }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => false,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}))
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ show: vi.fn(), ok: vi.fn(), error: vi.fn() }) }))
vi.mock('@/hooks/useUsuario', () => ({ useUsuario: () => ({ esDueno: true }) }))
vi.mock('@/features/turno/useQuitarMarcaDia', () => ({ useQuitarMarcaDia: () => vi.fn() }))
vi.mock('@/features/catalogo/api', () => ({ useMetodos: vi.fn() }))
vi.mock('@/features/turno/api', () => ({
  useResumenDia: vi.fn(), useTurnosDia: vi.fn(), useCierres: vi.fn(),
  guardarTurno: vi.fn(), eliminarTurno: vi.fn(), etiquetaModo: (m: string) => m,
}))

const consulta = (data: unknown, extra: Partial<{ isError: boolean; isPending: boolean }> = {}) =>
  ({ data, isPending: false, isError: false, refetch: vi.fn(), ...extra }) as never
const RESUMEN = { estado: 'completo', cerrado: false, neto: 100000, total_ventas: 100000, total_proveedores: 0, efectivo_esperado: 0 }

beforeEach(() => {
  vi.mocked(useResumenDia).mockReturnValue(consulta(RESUMEN))
  vi.mocked(useMetodos).mockReturnValue(consulta([]))
})
afterEach(cleanup)

describe('Planilla: carga y error', () => {
  // Antes, con la consulta de turnos fallida la lista quedaba vacía: «Sin
  // registro este día» bajo un resumen «Completo», sin reintentar.
  it('un fallo de los turnos se muestra como error, no como día sin registro', () => {
    vi.mocked(useTurnosDia).mockReturnValue(consulta(undefined, { isError: true }))
    render(<Planilla />)
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar la planilla de este día')
    expect(screen.queryByText('Sin registro este día')).toBeNull()
    expect(screen.queryByText('Neto del día')).toBeNull()
  })

  it('con datos previos y un refresco fallido, avisa que pueden no estar al día', () => {
    vi.mocked(useTurnosDia).mockReturnValue(consulta([], { isError: true }))
    render(<Planilla />)
    expect(screen.getByRole('status').textContent).toContain('No se pudo actualizar')
    expect(screen.getByText('Sin registro este día')).toBeTruthy()
  })

  it('un fallo de los métodos de pago también es un error', () => {
    vi.mocked(useTurnosDia).mockReturnValue(consulta([]))
    vi.mocked(useMetodos).mockReturnValue(consulta(undefined, { isError: true }))
    render(<Planilla />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
