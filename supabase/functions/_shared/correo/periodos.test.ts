// node --test supabase/functions/_shared/correo/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechaChile, horaChile, periodoAnteriorA, periodoPrevio, periodoQueContiene } from './periodos.ts'
import { clp, clpSigno, variacion, fechaDia, rango } from './formato.ts'

test('hora y fecha de Chile con y sin horario de verano', () => {
  // Invierno (UTC−4, abril a septiembre): 12:00 UTC = 08:00.
  assert.equal(horaChile(new Date('2026-07-15T12:00:00Z')), 8)
  // Verano (UTC−3): 11:00 UTC = 08:00.
  assert.equal(horaChile(new Date('2026-12-15T11:00:00Z')), 8)
  // 02:30 UTC del 17 todavía es el 16 en Chile.
  assert.equal(fechaChile(new Date('2026-09-17T02:30:00Z')), '2026-09-16')
})

test('diario: el día anterior', () => {
  assert.deepEqual(periodoAnteriorA('diario', '2026-10-01'), { desde: '2026-09-30', hasta: '2026-09-30' })
})

test('semanal: lunes a domingo de la semana anterior', () => {
  // 2026-09-21 es lunes.
  assert.deepEqual(periodoAnteriorA('semanal', '2026-09-21'), { desde: '2026-09-14', hasta: '2026-09-20' })
  // Un jueves apunta a la misma semana anterior completa.
  assert.deepEqual(periodoAnteriorA('semanal', '2026-09-24'), { desde: '2026-09-14', hasta: '2026-09-20' })
  assert.deepEqual(periodoPrevio('semanal', { desde: '2026-09-14', hasta: '2026-09-20' }), { desde: '2026-09-07', hasta: '2026-09-13' })
})

test('mensual: el mes calendario anterior, con su largo real', () => {
  assert.deepEqual(periodoAnteriorA('mensual', '2026-10-01'), { desde: '2026-09-01', hasta: '2026-09-30' })
  assert.deepEqual(periodoAnteriorA('mensual', '2026-03-01'), { desde: '2026-02-01', hasta: '2026-02-28' })
  assert.deepEqual(periodoAnteriorA('mensual', '2027-01-01'), { desde: '2026-12-01', hasta: '2026-12-31' })
  assert.deepEqual(periodoPrevio('mensual', { desde: '2026-09-01', hasta: '2026-09-30' }), { desde: '2026-08-01', hasta: '2026-08-31' })
})

test('período que contiene una fecha', () => {
  assert.deepEqual(periodoQueContiene('semanal', '2026-09-16'), { desde: '2026-09-14', hasta: '2026-09-20' })
  assert.deepEqual(periodoQueContiene('mensual', '2026-08-31'), { desde: '2026-08-01', hasta: '2026-08-31' })
  assert.deepEqual(periodoQueContiene('mensual', '2026-01-31'), { desde: '2026-01-01', hasta: '2026-01-31' })
})

test('formato', () => {
  assert.equal(clp(-404199), '−$404.199')
  assert.equal(clpSigno(1200), '+$1.200')
  assert.equal(variacion(110, 100), 10)
  assert.equal(variacion(5, 0), null)
  assert.equal(fechaDia('2026-09-16'), 'Mié 16')
  assert.equal(rango('2026-09-08', '2026-09-14'), '8 – 14 sept')
  assert.equal(rango('2026-09-29', '2026-10-05'), '29 sept – 5 oct')
})
