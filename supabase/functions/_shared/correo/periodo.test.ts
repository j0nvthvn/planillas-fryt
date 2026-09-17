// node --test supabase/functions/_shared/correo/periodo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completarDias, correoPeriodo, type Dia, type DatosPeriodo } from './periodo.ts'

function dia(fecha: string, extra: Partial<Dia> = {}): Dia {
  return {
    fecha, turnos: 1, total_ventas: 100000, total_proveedores: 20000, neto: 80000,
    estado: 'completo', corregido: false, con_descuadre: false, tiene_borrador: false,
    cerrado: false, motivo_cierre: null, ...extra,
  }
}

const sinAbrir = (fecha: string, motivo: string | null = 'Feriado'): Dia =>
  dia(fecha, { turnos: 0, total_ventas: 0, total_proveedores: 0, neto: 0, estado: 'cerrado', cerrado: true, motivo_cierre: motivo })

function semanal(dias: Dia[]): DatosPeriodo {
  const con = dias.filter((d) => d.turnos > 0)
  return {
    tipo: 'semanal',
    desde: '2026-09-07',
    hasta: '2026-09-13',
    totales: {
      total_ventas: con.reduce((a, d) => a + d.total_ventas, 0),
      total_proveedores: con.reduce((a, d) => a + d.total_proveedores, 0),
      neto: con.reduce((a, d) => a + d.neto, 0),
      efectivo_neto: 0,
      dias_con_registro: con.length,
      dias_cerrados: dias.filter((d) => d.cerrado).length,
    },
    anterior: null,
    dias,
    top: [],
    metodos: [],
  }
}

test('completarDias rellena como "sin registro", nunca como día sin abrir', () => {
  const dias = completarDias('2026-09-07', '2026-09-09', [dia('2026-09-08')])
  assert.equal(dias.length, 3)
  assert.deepEqual(dias.map((d) => d.estado), ['sin_registro', 'completo', 'sin_registro'])
  // Que el local no abriera es algo que alguien marcó; el relleno no lo sabe.
  assert.equal(dias.every((d) => d.cerrado === false), true)
})

test('el día sin abrir se muestra como "No abrió", con su motivo y sin monto', () => {
  const { html } = correoPeriodo(semanal([dia('2026-09-07'), sinAbrir('2026-09-08')]))
  assert.match(html, /No abrió/)
  assert.match(html, /Feriado/)
})

test('el motivo se escapa: es texto libre que termina en el HTML del correo', () => {
  const { html } = correoPeriodo(semanal([dia('2026-09-07'), sinAbrir('2026-09-08', '<script>alert(1)</script>')]))
  assert.equal(html.includes('<script>alert(1)</script>'), false)
  assert.match(html, /&lt;script&gt;/)
})

test('los días sin abrir salen del denominador y se cuentan aparte', () => {
  const { html } = correoPeriodo(semanal([dia('2026-09-07'), dia('2026-09-08'), sinAbrir('2026-09-09')]))
  // El rango son 7 días; uno no abrió, así que quedan 6 esperables.
  assert.match(html, /2 de 6 días con registro/)
  assert.match(html, /1 sin abrir/)
})

test('avisa de los días sin registrar, que antes no aparecían en ninguna parte', () => {
  const { html, texto } = correoPeriodo(semanal([dia('2026-09-07'), sinAbrir('2026-09-08')]))
  // Del 9 al 13 nadie registró nada y nadie los marcó: 5 días.
  assert.match(html, /5 días sin registrar/)
  assert.match(texto, /Días sin registrar:/)
})

test('un período completo sin abrir no inventa mejor ni peor día', () => {
  const { html } = correoPeriodo(semanal([sinAbrir('2026-09-07'), sinAbrir('2026-09-08')]))
  assert.equal(html.includes('Mejor día'), false)
})
