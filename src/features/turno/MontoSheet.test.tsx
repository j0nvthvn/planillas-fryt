// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MontoSheet } from './MontoSheet'

beforeAll(() => {
  // jsdom no trae matchMedia ni <dialog>.showModal: el teclado móvil basta.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }))
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) { this.open = true },
    close(this: HTMLDialogElement) { this.open = false },
  })
})
afterEach(cleanup)

const teclear = (...teclas: string[]) => teclas.forEach((k) => fireEvent.click(screen.getByRole('button', { name: k })))

describe('MontoSheet con total del día', () => {
  // `acumulado` llega como un objeto nuevo en cada render de Cerrar turno.
  // Antes, cualquier render de fondo (el autoguardado del método anterior,
  // un cambio de conexión) recargaba el monto y borraba lo escrito.
  it('conserva lo escrito aunque la pantalla se vuelva a renderizar', () => {
    const onAccept = vi.fn()
    const props = { title: 'Getnet', valor: null, onAccept, onClose: () => {} }
    const { rerender } = render(<MontoSheet {...props} acumulado={{ manana: 10000 }} />)
    teclear('5', '000', '0')
    rerender(<MontoSheet {...props} acumulado={{ manana: 10000 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onAccept).toHaveBeenCalledWith(40000, false)
  })

  it('recarga el monto al pasar al siguiente método', () => {
    const onAccept = vi.fn()
    const { rerender } = render(<MontoSheet title="Getnet" valor={null} acumulado={{ manana: 10000 }} onAccept={onAccept} onClose={() => {}} />)
    teclear('5', '000', '0')
    rerender(<MontoSheet title="Transferencia" valor={7000} onAccept={onAccept} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onAccept).toHaveBeenCalledWith(7000, false)
  })
})
