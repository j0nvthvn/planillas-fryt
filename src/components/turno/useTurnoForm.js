import { useState, useMemo } from 'react'
import { parseNum } from '../../utils/format'
import { METODOS_VENTA, VENTAS_VACIAS } from '../TurnoInput'

/**
 * Estado y acciones compartidas del editor de turno (proveedores + ventas + sheet).
 * Lo usan tanto Turno (registro de hoy) como EditarTurno (histórico).
 *
 * @param {object}   opts
 * @param {Function} [opts.onDirty] - se llama cuando el usuario modifica datos
 *                                     (sirve para marcar cambios locales / borrador).
 */
export function useTurnoForm({ onDirty } = {}) {
  const [provs, setProvs] = useState([])
  const [ventas, setVentas] = useState(VENTAS_VACIAS)
  const [sheet, setSheet] = useState(null)

  const efProv = useMemo(
    () => provs.filter((p) => p.forma_pago === 'efectivo').reduce((s, p) => s + p.monto, 0),
    [provs]
  )
  const trProv = useMemo(
    () => provs.filter((p) => p.forma_pago === 'transferencia').reduce((s, p) => s + p.monto, 0),
    [provs]
  )
  const totalVentas = useMemo(
    () => METODOS_VENTA.reduce((s, m) => s + (ventas[m.key] || 0), 0),
    [ventas]
  )
  const totalProveedores = efProv + trProv
  const usedNames = useMemo(() => provs.map((p) => p.nombre), [provs])

  function openNew() {
    setSheet({ mode: 'prov', idx: -1, nombre: '', monto: '', forma_pago: 'efectivo', imagen_url: '' })
  }
  function openEdit(i) {
    const p = provs[i]
    setSheet({ mode: 'prov', idx: i, nombre: p.nombre, monto: String(p.monto), forma_pago: p.forma_pago, imagen_url: p.imagen_url || '' })
  }
  function openVenta(key) {
    setSheet({ mode: 'venta', key, monto: ventas[key] ? String(ventas[key]) : '' })
  }

  function commitProv() {
    const row = { nombre: sheet.nombre.trim() || 'Proveedor', monto: parseNum(sheet.monto), forma_pago: sheet.forma_pago, imagen_url: sheet.imagen_url }
    if (sheet.idx === -1) setProvs((p) => [...p, row])
    else setProvs((p) => p.map((x, i) => (i === sheet.idx ? row : x)))
    onDirty?.()
    setSheet(null)
  }
  function commitVenta() {
    setVentas((v) => ({ ...v, [sheet.key]: parseNum(sheet.monto) }))
    onDirty?.()
    setSheet(null)
  }
  function delProv(i) {
    setProvs((p) => p.filter((_, j) => j !== i))
    onDirty?.()
    setSheet(null)
  }

  return {
    provs, setProvs, ventas, setVentas, sheet, setSheet,
    efProv, trProv, totalVentas, totalProveedores, usedNames,
    openNew, openEdit, openVenta, commitProv, commitVenta, delProv,
  }
}
