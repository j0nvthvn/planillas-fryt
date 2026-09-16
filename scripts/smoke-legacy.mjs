#!/usr/bin/env node
// Checklist de humo de la APP ACTUAL contra una base con las migraciones
// nuevas: repite, con supabase-js y una sesión real, las mismas lecturas
// y escrituras que hacen las pantallas (Hoy, Turno, Resumen, Historial,
// Análisis, Proveedores, Papelera, turnoApi.js) y verifica que todo
// siga funcionando. Pensado para la base local (scripts/test-db.sh) o
// para staging; NUNCA contra producción (escribe datos).
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... \
//   SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=password123 \
//   node scripts/smoke-legacy.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
const email = process.env.SMOKE_EMAIL
const password = process.env.SMOKE_PASSWORD
if (!url || !key || !email || !password) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SMOKE_EMAIL / SMOKE_PASSWORD')
  process.exit(2)
}
if (/kfmwhtbvgqurnpotypii/.test(url)) {
  console.error('Este script escribe datos: no correrlo contra producción.')
  process.exit(2)
}

const supabase = createClient(url, key)
let fallos = 0
function check(nombre, cond, extra = '') {
  if (cond) console.log(`ok   ${nombre}`)
  else { fallos += 1; console.log(`FAIL ${nombre} ${extra}`) }
}
function sinError(nombre, { error }) {
  check(nombre, !error, error ? `→ ${error.code ?? ''} ${error.message}` : '')
  return !error
}

// Un día al azar de 2027 (nunca chocará con datos reales ni con una
// corrida anterior); al final se borra todo lo creado.
const fecha = new Date(Date.UTC(2027, 0, 1 + Math.floor(Math.random() * 300))).toISOString().slice(0, 10)
// Proveedor "nuevo" con nombre único: nunca un nombre real del catálogo
// (contra staging, los datos son copia de prod y no se deben tocar).
const NUEVO = `Smoke ${fecha}`
console.log(`fecha de prueba: ${fecha}`)
const SELECT_TURNO = 'id, updated_at, is_draft, fondo_inicial, proveedores:proveedores_turno(id, nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)'

// ---- login (useAuth.jsx) ----
{
  const r = await supabase.auth.signInWithPassword({ email, password })
  if (!sinError('login', r)) process.exit(1)
  const perfil = await supabase.from('usuarios').select('*').eq('id', r.data.user.id).maybeSingle()
  sinError('perfil de usuario', perfil)
  check('rol dueño', perfil.data?.rol === 'dueño')
}
const uid = (await supabase.auth.getUser()).data.user.id

// ---- ConfigProvider ----
{
  const r = await supabase.from('configuracion').select('clave, valor')
  sinError('configuracion', r)
  check('configuracion trae fondo_caja_inicial', r.data?.some((x) => x.clave === 'fondo_caja_inicial'))
}

// ---- Turno.jsx: detección + sugerencias ----
{
  const j = await supabase.from('jornadas').select('id').eq('fecha', fecha).maybeSingle()
  sinError('jornada de hoy (vacía)', j)
  check('sin jornada todavía', j.data === null)
  const s = await Promise.all([
    supabase.from('proveedores_frecuentes').select('nombre, imagen_url'),
    supabase.from('proveedores_turno').select('nombre'),
  ])
  sinError('sugerencias: frecuentes', s[0]); sinError('sugerencias: historial', s[1])
}

// ---- turnoApi.guardarTurno (autoguardado): jornada → turno → proveedores ----
let turnoId
{
  const j = await supabase.from('jornadas').insert({ fecha }).select('id').single()
  sinError('crear jornada', j)
  const t = await supabase.from('turnos')
    .insert({ jornada_id: j.data.id, tipo: 'mañana', usuario_id: uid, fondo_inicial: 20000 }).select('id').single()
  sinError('crear turno borrador', t)
  turnoId = t.data.id

  // Un nombre con grafía distinta ("pf") y uno nuevo (NUEVO).
  const ins = await supabase.from('proveedores_turno').insert([
    { turno_id: turnoId, nombre: 'pf', monto: 30000, forma_pago: 'efectivo' },
    { turno_id: turnoId, nombre: NUEVO, monto: 12000, forma_pago: 'transferencia' },
  ]).select('id')
  sinError('insertar proveedores', ins)
  check('devuelve los ids', ins.data?.length === 2)

  const up = await supabase.from('proveedores_frecuentes').upsert(
    [{ nombre: 'pf' }, { nombre: NUEVO }], { onConflict: 'nombre', ignoreDuplicates: true })
  sinError('upsert de frecuentes (grafía duplicada + nuevo)', up)
  const cat = await supabase.from('proveedores_frecuentes').select('nombre').in('nombre', ['pf', 'PF', NUEVO])
  check('el catálogo no duplicó "pf"', !cat.data?.some((x) => x.nombre === 'pf') && cat.data?.some((x) => x.nombre === NUEVO),
    JSON.stringify(cat.data))

  // Editar un proveedor ya guardado (actualizar monto y nombre).
  const edit = await supabase.from('proveedores_turno')
    .update({ nombre: 'PF', monto: 35000, forma_pago: 'efectivo' }).eq('id', ins.data[0].id)
  sinError('editar proveedor guardado', edit)

  // Ventas por upsert.
  const v = await supabase.from('ventas_turno').upsert(
    { turno_id: turnoId, efectivo: 200000, getnet: 50000, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 10000 },
    { onConflict: 'turno_id' })
  sinError('upsert ventas', v)

  // Fondo de caja (FondoCajaSheet).
  sinError('actualizar fondo inicial', await supabase.from('turnos').update({ fondo_inicial: 25000 }).eq('id', turnoId))

  // Recarga de la pantalla (cargar()).
  const carga = await supabase.from('turnos').select(SELECT_TURNO).eq('jornada_id', j.data.id).eq('tipo', 'mañana').is('deleted_at', null).maybeSingle()
  sinError('recargar turno', carga)
  const nombres = (carga.data?.proveedores ?? []).map((p) => p.nombre).sort()
  check('proveedores con grafía canónica', JSON.stringify(nombres) === JSON.stringify([NUEVO, 'PF'].sort()), JSON.stringify(nombres))
  check('ventas cargadas', carga.data?.ventas?.efectivo === 200000 || carga.data?.ventas?.[0]?.efectivo === 200000)
}

// ---- cerrar (ConteoCajaSheet → cerrar_turno) ----
{
  const r = await supabase.rpc('cerrar_turno', { p_turno_id: turnoId, p_efectivo_contado: 190000 })
  sinError('cerrar_turno con conteo', r)
  const t = await supabase.from('turnos').select('is_draft').eq('id', turnoId).single()
  check('turno cerrado', t.data?.is_draft === false)
}

// ---- Hoy.jsx / Resumen.jsx / Historial.jsx / Analisis.jsx (lecturas) ----
{
  const hoy = await supabase.from('turnos').select(`
        id, tipo, is_draft, fondo_inicial, updated_at,
        usuario:usuarios(nombre),
        ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
        proveedores:proveedores_turno(monto, forma_pago)
      `).is('deleted_at', null).order('tipo')
  sinError('Hoy: turnos', hoy)
  const res = await supabase.from('turnos').select(`
        id, tipo, is_draft, creado_en,
        usuario:usuarios(nombre),
        proveedores:proveedores_turno(nombre, monto, forma_pago),
        ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
        cierres:turno_cierres(
          es_correccion, cerrado_en, efectivo_esperado, efectivo_contado, diferencia_efectivo,
          ventas_snapshot, proveedores_snapshot, total_ventas, total_proveedores,
          cerrado_por_usuario:usuarios!cerrado_por(nombre)
        )
      `).eq('id', turnoId).single()
  sinError('Resumen: turno con cierres', res)
  const c = res.data?.cierres?.[0]
  check('cuadre de caja: esperado 25000+200000−35000 = 190000', Number(c?.efectivo_esperado) === 190000, String(c?.efectivo_esperado))
  check('cuadre de caja: diferencia 0', Number(c?.diferencia_efectivo) === 0)
  const hist = await supabase.from('jornadas').select(`
        id, fecha, es_turno_unico,
        turnos(id, tipo, is_draft, ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
               proveedores:proveedores_turno(monto, forma_pago), cierres:turno_cierres(es_correccion))
      `).is('turnos.deleted_at', null).order('fecha', { ascending: false }).limit(90)
  sinError('Historial: jornadas', hist)
  const ana = await supabase.from('jornadas').select(`
          id, fecha,
          turnos(id, tipo, ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
                 proveedores:proveedores_turno(nombre, monto, forma_pago))
        `).is('turnos.deleted_at', null).gte('fecha', '2026-09-01').lte('fecha', '2026-09-30').order('fecha')
  sinError('Análisis: jornadas del período', ana)
  const csv = await supabase.from('jornadas').select(`
          fecha,
          turnos(tipo, is_draft, fondo_inicial, usuario:usuarios(nombre),
                 ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia),
                 proveedores:proveedores_turno(monto, forma_pago),
                 cierres:turno_cierres(es_correccion, cerrado_en, efectivo_esperado, efectivo_contado, diferencia_efectivo))
        `).is('turnos.deleted_at', null).gte('fecha', '2026-09-01').lte('fecha', '2026-09-30')
  sinError('Análisis: export CSV', csv)
  // Fusionar en turno único (Resumen.jsx)
  const jid = (await supabase.from('jornadas').select('id').eq('fecha', fecha).single()).data.id
  sinError('fusionar en turno único', await supabase.from('jornadas').update({ es_turno_unico: true }).eq('id', jid))
  sinError('desmarcar turno único', await supabase.from('jornadas').update({ es_turno_unico: false }).eq('id', jid))
}

// ---- EditarTurno.jsx: corrección de un turno cerrado ----
{
  const ver = await supabase.from('turnos').select('updated_at').eq('id', turnoId).maybeSingle()
  sinError('versionTurno', ver)
  const v = await supabase.from('ventas_turno').upsert(
    { turno_id: turnoId, efectivo: 210000, getnet: 50000, mercadopago: 0, edenred: 0, amipass: 0, transferencia: 10000 },
    { onConflict: 'turno_id' })
  sinError('corregir ventas de turno cerrado (dueño)', v)
  // Se borra la fila "PF" (determinista); la fila NUEVO se usa más abajo.
  const actuales = await supabase.from('proveedores_turno').select('id, nombre').eq('turno_id', turnoId)
  const del = await supabase.from('proveedores_turno').delete().in('id', [actuales.data.find((p) => p.nombre === 'PF').id])
  sinError('borrar un proveedor del turno cerrado (dueño)', del)
  const r = await supabase.rpc('corregir_turno', { p_turno_id: turnoId, p_efectivo_contado: null })
  sinError('corregir_turno', r)
  const cierres = await supabase.from('turno_cierres').select('es_correccion').eq('turno_id', turnoId)
  check('quedan 2 cierres (original + corrección)', cierres.data?.length === 2 && cierres.data.some((x) => x.es_correccion))
}

// ---- Proveedores.jsx: renombrar, eliminar ----
{
  const ideal = await supabase.from('proveedores_frecuentes').select('id, nombre').eq('nombre', NUEVO).single()
  sinError('leer proveedor nuevo', ideal)
  // La app actual renombra primero en los turnos y después en el catálogo.
  const renombrado = `${NUEVO} Panadería`
  sinError('renombrar en turnos', await supabase.from('proveedores_turno').update({ nombre: renombrado }).eq('nombre', NUEVO))
  const upd = await supabase.from('proveedores_frecuentes').update({ nombre: renombrado, imagen_url: null }).eq('id', ideal.data.id).select()
  sinError('renombrar en catálogo', upd)
  check('renombrar devuelve la fila (política UPDATE dueño)', upd.data?.length === 1)
  const filas = await supabase.from('proveedores_turno').select('nombre, proveedor_id').eq('proveedor_id', ideal.data.id)
  check('las filas de turnos siguen vinculadas al mismo proveedor', filas.data?.length >= 1 && filas.data.every((f) => f.nombre === renombrado), JSON.stringify(filas.data))
  // Eliminar del catálogo un proveedor en uso: las filas conservan el nombre.
  sinError('eliminar del catálogo un proveedor en uso', await supabase.from('proveedores_frecuentes').delete().eq('id', ideal.data.id))
  const huerfanas = await supabase.from('proveedores_turno').select('nombre, proveedor_id').eq('turno_id', turnoId).eq('nombre', renombrado)
  check('las filas del turno conservan el nombre sin catálogo', huerfanas.data?.length === 1 && huerfanas.data[0].proveedor_id === null, JSON.stringify(huerfanas.data))
  const nuevo = await supabase.from('proveedores_frecuentes').insert({ nombre: 'Temporal Smoke', imagen_url: null }).select().single()
  sinError('crear proveedor nuevo', nuevo)
  const dup = await supabase.from('proveedores_frecuentes').insert({ nombre: 'temporal smoke' }).select().single()
  check('crear un duplicado por grafía falla de forma controlada (sin fila)', !!dup.error && !dup.data, dup.error?.message)
  const delp = await supabase.from('proveedores_frecuentes').delete().eq('id', nuevo.data.id)
  sinError('eliminar proveedor del catálogo (dueño)', delp)
  const lista = await supabase.from('proveedores_frecuentes').select('id, nombre, imagen_url').order('nombre')
  check('el eliminado ya no aparece', !lista.data?.some((p) => p.nombre === 'Temporal Smoke'))
}

// ---- Papelera.jsx: eliminar, listar, restaurar, purgar ----
{
  sinError('eliminar turno (soft)', await supabase.from('turnos').update({ deleted_at: new Date().toISOString() }).eq('id', turnoId))
  const lista = await supabase.from('turnos').select('id, tipo, deleted_at, fondo_inicial, usuario:usuarios(nombre), jornada:jornadas(fecha), ventas:ventas_turno(efectivo), proveedores:proveedores_turno(monto, forma_pago)')
    .not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  sinError('listar papelera', lista)
  check('el turno está en la papelera', lista.data?.some((t) => t.id === turnoId))
  // Mientras está en la papelera se puede registrar otro del mismo día/tipo (índice parcial).
  const jid = (await supabase.from('jornadas').select('id').eq('fecha', fecha).single()).data.id
  const otro = await supabase.from('turnos').insert({ jornada_id: jid, tipo: 'mañana', usuario_id: uid }).select('id').single()
  sinError('registrar otro turno del mismo día/tipo con el anterior en la papelera', otro)
  sinError('purgar el nuevo (hard delete)', await supabase.from('turnos').delete().eq('id', otro.data.id))
  sinError('restaurar turno', await supabase.from('turnos').update({ deleted_at: null }).eq('id', turnoId))
}

// ---- vistas nuevas (para la v2) también responden con esta sesión ----
{
  const vt = await supabase.from('v_turnos').select('*').eq('id', turnoId).single()
  sinError('v_turnos', vt)
  check('v_turnos: corregido, 2 cierres, conteo conservado', vt.data?.corregido === true && vt.data?.cantidad_cierres === 2 && Number(vt.data?.efectivo_contado) === 190000, JSON.stringify(vt.data))
  const rd = await supabase.from('v_resumen_dia').select('estado, total_ventas').eq('fecha', fecha).single()
  sinError('v_resumen_dia', rd)
  const rp = await supabase.rpc('resumen_periodo', { p_desde: '2026-09-01', p_hasta: '2026-09-30' })
  sinError('resumen_periodo', rp)
}

// ---- limpieza: la jornada (cascada a turnos/ventas/proveedores/cierres) y el catálogo de prueba ----
{
  sinError('limpieza: borrar jornada de prueba', await supabase.from('jornadas').delete().eq('fecha', fecha))
  sinError('limpieza: borrar proveedores de prueba', await supabase.from('proveedores_frecuentes').delete().in('nombre', [NUEVO, `${NUEVO} Panadería`, 'Temporal Smoke']))
}

await supabase.auth.signOut()
console.log(fallos === 0 ? '\n✔ checklist de humo en verde' : `\n✘ ${fallos} fallo(s)`)
process.exit(fallos === 0 ? 0 : 1)
