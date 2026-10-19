import { describe, it, expect } from 'vitest'
import { mensajeGuardado } from './errores'

describe('mensajeGuardado', () => {
  it('conserva los mensajes propios de la base, con la fecha en palabras', () => {
    expect(mensajeGuardado({ code: '23514', message: 'El 2026-10-13 está marcado como día sin abrir; quita la marca para registrar un turno' }))
      .toBe('El 13 de octubre de 2026 está marcado como día sin abrir; quita la marca para registrar un turno')
    expect(mensajeGuardado({ code: '42501', message: 'No tienes permiso para modificar este turno (ya está cerrado)' }))
      .toBe('No tienes permiso para modificar este turno (ya está cerrado)')
  })

  it('traduce por código los mensajes crudos de Postgres', () => {
    expect(mensajeGuardado({ code: '23514', message: 'new row for relation "turnos" violates check constraint "turnos_fondo_inicial_check"' }))
      .toBe('Hay un monto que no es válido: revisa que ninguno sea negativo.')
    expect(mensajeGuardado({ code: '42501', message: 'new row violates row-level security policy for table "turnos"' }))
      .toMatch(/^No tienes permiso/)
    expect(mensajeGuardado({ code: '23505', message: 'duplicate key value violates unique constraint "turnos_jornada_tipo_key"' }))
      .toMatch(/otro dispositivo/)
  })

  it('sesión vencida y sin red', () => {
    expect(mensajeGuardado({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/^Tu sesión expiró/)
    expect(mensajeGuardado({ code: '42501', message: 'Sin sesión' })).toMatch(/^Tu sesión expiró/)
    expect(mensajeGuardado({ code: '', message: 'TypeError: Failed to fetch' })).toMatch(/^Sin conexión/)
  })

  it('un error desconocido no muestra inglés, pero sí el código', () => {
    expect(mensajeGuardado({ code: 'XX000', message: 'internal error: could not serialize access' }))
      .toBe('No se pudo guardar (código XX000). Tus datos quedaron guardados en este dispositivo.')
    expect(mensajeGuardado({})).toBe('No se pudo guardar. Tus datos quedaron guardados en este dispositivo.')
  })
})
