/**
 * Los datos de ejemplo de las maquetas.
 *
 * No son datos del local: son inventados y deterministas. Cada monto sale de
 * un hash de la fecha, así que dos corridas del tubo producen exactamente los
 * mismos PNG, y los totales se calculan con las mismas fórmulas que
 * `turno_totales()`, `v_turnos`, `v_resumen_dia` y `resumen_periodo()` en la
 * base (ver `supabase/migrations/20260916000200_totales_vistas.sql`). Si una
 * vista cambia su forma, esto tiene que cambiar con ella: lo que se publica
 * en la landing es la pantalla de verdad leyendo estos datos.
 */

/** El instante en que queda congelado el reloj del navegador. */
export const INSTANTE = '2026-03-12T19:40:00-03:00'
/** El "hoy" de las maquetas: un jueves de marzo, con la tarde a medio cerrar. */
export const HOY = '2026-03-12'
/** Desde dónde hay jornadas: cubre los 30 días de Análisis y su período anterior. */
const PRIMER_DIA = '2026-01-05'

const USUARIO_ID = '3f1c0a10-0000-4000-8000-000000000001'
const FONDO = 50_000

/* ───────── fechas (sin dependencias, en UTC para no depender del huso) ───────── */

const aDia = (f) => new Date(`${f}T12:00:00Z`)
const iso = (d) => d.toISOString().slice(0, 10)
export const sumarDias = (f, n) => iso(new Date(aDia(f).getTime() + n * 86_400_000))
const diaSemana = (f) => aDia(f).getUTCDay()
const rango = (desde, hasta) => {
  const dias = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f)
  return dias
}

/* ───────── azar determinista ───────── */

function hash(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return h >>> 0
}
/** Un entero estable entre `min` y `max`, múltiplo de `paso`. */
function entre(semilla, min, max, paso = 10) {
  const n = min + ((hash(semilla) % 100_000) / 100_000) * (max - min)
  return Math.round(n / paso) * paso
}

/** Un UUID estable a partir de una semilla (el prefijo evita choques entre tablas). */
function uuid(prefijo, semilla) {
  const h = hash(semilla).toString(16).padStart(8, '0').slice(0, 7)
  return `${prefijo}${h}-0000-4000-8000-000000000001`
}

/* ───────── catálogos ───────── */

export const USUARIO = {
  id: USUARIO_ID,
  email: 'duena@ejemplo.cl',
  nombre: 'Claudia Rojas',
  rol: 'dueño',
  activo: true,
  creado_en: '2026-01-02T12:00:00-03:00',
}

// `color` es un hex, no un token: `colorMetodo()` lo mezcla con blanco para
// el ícono de reserva (los que tienen logo lo usan poco).
const METODOS = [
  { key: 'efectivo', label: 'Efectivo', sub: null, color: '#047857', logo: null, orden: 1 },
  { key: 'getnet', label: 'Getnet', sub: 'Débito y crédito', color: '#7C3AED', logo: '/metodos/getnet.png', orden: 2 },
  { key: 'mercadopago', label: 'Mercado Pago', sub: 'QR y tarjetas', color: '#00B1EA', logo: '/metodos/mercadopago.png', orden: 3 },
  { key: 'edenred', label: 'Edenred', sub: 'Tarjeta de alimentación', color: '#E2001A', logo: '/metodos/edenred.png', orden: 4 },
  { key: 'amipass', label: 'Amipass', sub: 'Tarjeta de alimentación', color: '#F58220', logo: '/metodos/amipass.png', orden: 5 },
  { key: 'transferencia', label: 'Transferencia', sub: 'A la cuenta del local', color: '#4F46E5', logo: null, orden: 6 },
]

const TRABAJADORES = [
  { id: 'a0000000-0000-4000-8000-000000000001', nombre: 'Camila', orden: 1 },
  { id: 'a0000000-0000-4000-8000-000000000002', nombre: 'Rodrigo', orden: 2 },
  { id: 'a0000000-0000-4000-8000-000000000003', nombre: 'Valentina', orden: 3 },
]

/** Nombres inventados: ningún proveedor real del local aparece en la landing. */
const PROVEEDORES = [
  { id: 'b0000000-0000-4000-8000-000000000001', nombre: 'Distribuidora Los Andes' },
  { id: 'b0000000-0000-4000-8000-000000000002', nombre: 'Lácteos del Valle' },
  { id: 'b0000000-0000-4000-8000-000000000003', nombre: 'Panadería San Bernardo' },
  { id: 'b0000000-0000-4000-8000-000000000004', nombre: 'Bebidas Cordillera' },
  { id: 'b0000000-0000-4000-8000-000000000005', nombre: 'Abarrotes El Pino' },
  { id: 'b0000000-0000-4000-8000-000000000006', nombre: 'Verduras La Vega' },
]

/* ───────── el guion de los días ───────── */

/**
 * Lo que no sale del hash: los días que cuentan una historia concreta en las
 * maquetas. El resto son días normales, cerrados en mañana y tarde.
 */
const GUION = {
  [HOY]: { tarde: 'borrador' },
  '2026-03-09': { noAbrio: 'Mantención eléctrica' },
  '2026-03-06': { sinTarde: true },
  '2026-02-27': { descuadre: -3_200 },
  '2026-02-16': { corregido: true },
}

function ventasDe(semilla, factor) {
  const v = {
    efectivo: entre(`${semilla}:efectivo`, 120_000, 260_000, 500),
    getnet: entre(`${semilla}:getnet`, 95_000, 240_000, 500),
    mercadopago: entre(`${semilla}:mercadopago`, 25_000, 80_000, 500),
    edenred: entre(`${semilla}:edenred`, 6_000, 26_000, 500),
    amipass: entre(`${semilla}:amipass`, 3_000, 18_000, 500),
    transferencia: entre(`${semilla}:transferencia`, 0, 14_000, 1_000),
  }
  for (const k of Object.keys(v)) v[k] = Math.round((v[k] * factor) / 500) * 500
  return v
}

function proveedoresDe(semilla, turnoId) {
  const cuantos = hash(`${semilla}:cuantos`) % 10
  const n = cuantos < 3 ? 0 : cuantos < 7 ? 1 : cuantos < 9 ? 2 : 3
  return Array.from({ length: n }, (_, i) => {
    const p = PROVEEDORES[hash(`${semilla}:prov${i}`) % PROVEEDORES.length]
    return {
      id: uuid('c', `${turnoId}:${i}`),
      turno_id: turnoId,
      proveedor_id: p.id,
      nombre: p.nombre,
      monto: entre(`${semilla}:monto${i}`, 12_000, 140_000, 500),
      forma_pago: hash(`${semilla}:forma${i}`) % 3 === 0 ? 'transferencia' : 'efectivo',
      creado_en: `${semilla.slice(0, 10)}T${11 + i}:20:00-03:00`,
      updated_at: `${semilla.slice(0, 10)}T${11 + i}:20:00-03:00`,
    }
  })
}

/** Las mismas fórmulas que `turno_totales()`. */
function totalesTurno(ventas, proveedores, fondoInicial) {
  const total_ventas = Object.values(ventas).reduce((s, n) => s + n, 0)
  const prov_efectivo = proveedores.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + p.monto, 0)
  const prov_transferencia = proveedores.filter((p) => p.forma_pago !== 'efectivo').reduce((s, p) => s + p.monto, 0)
  const total_proveedores = prov_efectivo + prov_transferencia
  const efectivo_neto = ventas.efectivo - prov_efectivo
  return {
    total_ventas,
    prov_efectivo,
    prov_transferencia,
    total_proveedores,
    neto: total_ventas - total_proveedores,
    efectivo_neto,
    efectivo_esperado: fondoInicial + efectivo_neto,
  }
}

function armarTurno({ fecha, tipo, esUnico, borrador, descuadre, corregido }) {
  const semilla = `${fecha}:${tipo}`
  const id = uuid('d', semilla)
  const jornada_id = uuid('e', fecha)
  // El domingo el local abre corrido: un solo turno con el día entero.
  const factor = esUnico ? 1.5 : tipo === 'mañana' ? 0.95 : 1.05
  const ventas = ventasDe(semilla, factor * (diaSemana(fecha) === 6 ? 1.2 : 1))
  const proveedores = proveedoresDe(semilla, id)
  const t = totalesTurno(ventas, proveedores, FONDO)
  const trabajador = TRABAJADORES[hash(semilla) % TRABAJADORES.length]
  const cerradoEn = `${fecha}T${tipo === 'mañana' ? '14:05' : '21:10'}:00-03:00`
  const contado = borrador ? null : t.efectivo_esperado + (descuadre ?? 0)

  return {
    turno: {
      id,
      jornada_id,
      fecha,
      tipo,
      modo: esUnico && tipo === 'mañana' ? 'completo' : tipo,
      es_turno_unico: !!esUnico,
      is_draft: !!borrador,
      fondo_inicial: FONDO,
      usuario_id: USUARIO_ID,
      usuario_nombre: USUARIO.nombre,
      trabajador_id: trabajador.id,
      trabajador_nombre: trabajador.nombre,
      creado_en: `${fecha}T09:15:00-03:00`,
      updated_at: borrador ? `${fecha}T19:32:00-03:00` : cerradoEn,
      ...ventas,
      ...t,
      cantidad_cierres: borrador ? 0 : corregido ? 2 : 1,
      corregido: !!corregido,
      ultimo_cierre_en: borrador ? null : cerradoEn,
      efectivo_contado: contado,
      diferencia_efectivo: contado === null ? null : contado - t.efectivo_esperado,
    },
    proveedores,
    cierre: borrador
      ? null
      : {
          id: uuid('f', `${semilla}:cierre`),
          turno_id: id,
          cerrado_en: cerradoEn,
          cerrado_por: USUARIO_ID,
          cerrado_por_usuario: { nombre: USUARIO.nombre },
          cierre_anterior_id: null,
          es_correccion: false,
          efectivo_contado: contado,
          efectivo_esperado: t.efectivo_esperado,
          diferencia_efectivo: contado - t.efectivo_esperado,
          total_ventas: t.total_ventas,
          total_proveedores: t.total_proveedores,
          ventas_snapshot: ventas,
          proveedores_snapshot: proveedores.map((p) => ({ nombre: p.nombre, monto: p.monto, forma_pago: p.forma_pago })),
        },
  }
}

/** Una fila de `v_resumen_dia` a partir de sus turnos, como el `group by` de la vista. */
function armarResumen(fecha, turnos, marcado) {
  const jornada_id = uuid('e', fecha)
  const diaUnicoConfig = diaSemana(fecha) === 0
  const esUnico = turnos.some((t) => t.es_turno_unico)
  const sumar = (k) => turnos.reduce((s, t) => s + (t[k] ?? 0), 0)
  const tieneManana = turnos.some((t) => t.tipo === 'mañana')
  const tieneTarde = turnos.some((t) => t.tipo === 'tarde')
  const borrador = turnos.some((t) => t.is_draft)

  const estado =
    turnos.length === 0 ? (marcado ? 'cerrado' : 'sin_registro')
    : borrador ? 'borrador'
    : esUnico || diaUnicoConfig || (tieneManana && tieneTarde) ? 'completo'
    : 'parcial'

  return {
    jornada_id,
    fecha,
    es_turno_unico: esUnico,
    dia_unico_config: diaUnicoConfig,
    es_dia_unico: esUnico || diaUnicoConfig,
    turnos: turnos.length,
    tiene_borrador: borrador,
    tiene_manana: tieneManana,
    tiene_tarde: tieneTarde,
    corregido: turnos.some((t) => t.corregido),
    con_conteo: turnos.some((t) => t.efectivo_contado != null),
    con_descuadre: turnos.some((t) => t.diferencia_efectivo != null && t.diferencia_efectivo !== 0),
    estado,
    efectivo: sumar('efectivo'),
    getnet: sumar('getnet'),
    mercadopago: sumar('mercadopago'),
    edenred: sumar('edenred'),
    amipass: sumar('amipass'),
    transferencia: sumar('transferencia'),
    total_ventas: sumar('total_ventas'),
    prov_efectivo: sumar('prov_efectivo'),
    prov_transferencia: sumar('prov_transferencia'),
    total_proveedores: sumar('total_proveedores'),
    neto: sumar('neto'),
    efectivo_neto: sumar('efectivo_neto'),
    efectivo_esperado: sumar('efectivo_esperado'),
    updated_at: turnos.map((t) => t.updated_at).sort().pop() ?? null,
    cerrado: !!marcado,
    motivo_cierre: marcado ?? null,
    cerrado_en: marcado ? `${fecha}T08:30:00-03:00` : null,
    cerrado_por: marcado ? USUARIO_ID : null,
  }
}

/* ───────── el conjunto completo ───────── */

export function construirDatos() {
  const v_turnos = []
  const proveedores_turno = []
  const turno_cierres = []
  const v_resumen_dia = []

  for (const fecha of rango(PRIMER_DIA, HOY)) {
    const guion = GUION[fecha] ?? {}
    if (guion.noAbrio) {
      v_resumen_dia.push(armarResumen(fecha, [], guion.noAbrio))
      continue
    }

    const esUnico = diaSemana(fecha) === 0
    const tipos = esUnico || guion.sinTarde ? ['mañana'] : ['mañana', 'tarde']
    const delDia = []
    for (const tipo of tipos) {
      const { turno, proveedores, cierre } = armarTurno({
        fecha,
        tipo,
        esUnico,
        borrador: guion[tipo] === 'borrador',
        descuadre: guion.descuadre,
        corregido: guion.corregido && tipo === 'tarde',
      })
      delDia.push(turno)
      v_turnos.push(turno)
      proveedores_turno.push(...proveedores)
      if (cierre) turno_cierres.push(cierre)
    }
    v_resumen_dia.push(armarResumen(fecha, delDia, null))
  }

  const usos = new Map()
  for (const p of proveedores_turno) usos.set(p.proveedor_id, (usos.get(p.proveedor_id) ?? 0) + 1)

  return {
    usuarios: [USUARIO],
    configuracion: [
      { clave: 'dias_turno_unico', valor: [0] },
      { clave: 'hora_corte_manana', valor: 14 },
      { clave: 'nombre_local', valor: 'Fryt' },
      { clave: 'fondo_caja_inicial', valor: FONDO },
    ],
    metodos_pago: METODOS.map((m) => ({ ...m, activo: true, acumulado_diario: m.key === 'getnet' })),
    trabajadores: TRABAJADORES.map((t) => ({ ...t, activo: true, creado_en: '2026-01-02T12:00:00-03:00' })),
    proveedores_frecuentes: PROVEEDORES.map((p) => ({
      ...p,
      activo: true,
      imagen_url: null,
      nombre_norm: p.nombre.toLowerCase(),
      creado_en: '2026-01-02T12:00:00-03:00',
      usos: usos.get(p.id) ?? 0,
    })),
    proveedores_turno,
    turno_cierres,
    v_turnos,
    v_resumen_dia,
    logs_error: [],
    correo_destinatarios: [],
  }
}

/** `resumen_periodo(p_desde, p_hasta)`, calculado igual que en la base. */
export function resumenPeriodo(datos, desde, hasta) {
  const dias = datos.v_resumen_dia.filter((d) => d.fecha >= desde && d.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const largo = rango(desde, hasta).length
  const antDesde = sumarDias(desde, -largo)
  const anteriores = datos.v_resumen_dia.filter((d) => d.fecha >= antDesde && d.fecha <= sumarDias(desde, -1))
  const sumar = (filas, k) => filas.reduce((s, d) => s + (d[k] ?? 0), 0)

  const totales = (filas, completo) => ({
    total_ventas: sumar(filas, 'total_ventas'),
    total_proveedores: sumar(filas, 'total_proveedores'),
    ...(completo
      ? { prov_efectivo: sumar(filas, 'prov_efectivo'), prov_transferencia: sumar(filas, 'prov_transferencia') }
      : {}),
    neto: sumar(filas, 'neto'),
    efectivo_neto: sumar(filas, 'efectivo_neto'),
    ...(completo
      ? {
          efectivo: sumar(filas, 'efectivo'),
          getnet: sumar(filas, 'getnet'),
          mercadopago: sumar(filas, 'mercadopago'),
          edenred: sumar(filas, 'edenred'),
          amipass: sumar(filas, 'amipass'),
          transferencia: sumar(filas, 'transferencia'),
        }
      : {}),
    dias_con_registro: filas.filter((d) => d.turnos > 0).length,
    ...(completo ? { dias_con_borrador: filas.filter((d) => d.tiene_borrador).length } : {}),
    dias_cerrados: filas.filter((d) => d.cerrado).length,
  })

  const idsDelRango = new Set(datos.v_turnos.filter((t) => t.fecha >= desde && t.fecha <= hasta).map((t) => t.id))
  const porProveedor = new Map()
  for (const p of datos.proveedores_turno) {
    if (!idsDelRango.has(p.turno_id)) continue
    const acum = porProveedor.get(p.nombre) ?? { proveedor_id: p.proveedor_id, nombre: p.nombre, imagen_url: null, monto: 0, compras: 0 }
    acum.monto += p.monto
    acum.compras += 1
    porProveedor.set(p.nombre, acum)
  }

  return {
    desde,
    hasta,
    dias_periodo: largo,
    dias,
    totales: totales(dias, true),
    anterior: totales(anteriores, false),
    top_proveedores: [...porProveedor.values()].sort((a, b) => b.monto - a.monto).slice(0, 5),
  }
}
