import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { fechaLegible } from '../utils/format'
import { ACCENT, ACCENT_TINT, VENTAS_VACIAS, TurnoIcon as Icon } from '../components/TurnoInput'
import { useTurnoForm } from '../components/turno/useTurnoForm'
import { useIsDesktop } from '../components/turno/useIsDesktop'
import { ProveedoresSection, VentasSection } from '../components/turno/TurnoSections'
import { TurnoSheets } from '../components/turno/TurnoSheets'
import { TurnoBottomBar } from '../components/turno/TurnoBottomBar'
import { crearTurno, escribirTurno, versionTurno, borrarTurno } from '../components/turno/turnoApi'

export default function EditarTurno() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const [params] = useSearchParams()
  const fecha = params.get('fecha') || ''
  const tipo = params.get('tipo') || 'mañana'

  const [cargando, setCargando] = useState(true)
  const [turnoId, setTurnoId] = useState(null)     // null = modo crear, uuid = modo editar
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [showGuardarVacioConfirm, setShowGuardarVacioConfirm] = useState(false)
  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false)
  const [turnoVersion, setTurnoVersion] = useState(null)
  const [cambioRemotoPendiente, setCambioRemotoPendiente] = useState(false)
  const [loadKey, setLoadKey] = useState(0)
  const originalRef = useRef({ provs: [], ventas: VENTAS_VACIAS })

  const form = useTurnoForm()
  const { provs, setProvs, ventas, setVentas } = form

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)

  const [sugerencias, setSugerencias] = useState([])
  useEffect(() => {
    Promise.all([
      supabase.from('proveedores_frecuentes').select('nombre, imagen_url'),
      supabase.from('proveedores_turno').select('nombre'),
    ]).then(([{ data: frecuentes }, { data: historial }]) => {
      if (!frecuentes) return
      const counts = {}
      for (const r of historial || []) counts[r.nombre] = (counts[r.nombre] || 0) + 1
      setSugerencias(frecuentes.sort((a, b) => {
        const diff = (counts[b.nombre] || 0) - (counts[a.nombre] || 0)
        return diff !== 0 ? diff : a.nombre.localeCompare(b.nombre)
      }))
    })
  }, [])

  /* Cargar turno existente (si hay) */
  useEffect(() => {
    if (!fechaValida) { setCargando(false); return }
    let activo = true
    async function cargar() {
      setCargando(true)
      setError('')
      const { data: jornada, error: errJornada } = await supabase
        .from('jornadas').select('id').eq('fecha', fecha).maybeSingle()

      if (!activo) return
      if (errJornada) {
        setError('No se pudo cargar la jornada. Revisa tu conexión e inténtalo de nuevo.')
        setCargando(false); return
      }
      if (!jornada) { setCargando(false); return }

      const { data: turno, error: errTurno } = await supabase
        .from('turnos')
        .select('id, updated_at, proveedores:proveedores_turno(nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .eq('jornada_id', jornada.id)
        .eq('tipo', tipo)
        .maybeSingle()

      if (!activo) return
      if (errTurno) {
        setError('No se pudieron cargar los datos del turno. Revisa tu conexión e inténtalo de nuevo.')
        setCargando(false); return
      }
      if (turno) {
        setTurnoId(turno.id)
        setTurnoVersion(turno.updated_at)
        setCambioRemotoPendiente(false)
        const v = Array.isArray(turno.ventas) ? turno.ventas[0] : turno.ventas
        const ventasCargadas = v
          ? { efectivo: +v.efectivo || 0, getnet: +v.getnet || 0, mercadopago: +v.mercadopago || 0, edenred: +v.edenred || 0, amipass: +v.amipass || 0, transferencia: +v.transferencia || 0 }
          : VENTAS_VACIAS
        const provsCargados = (turno.proveedores || []).map((p) => ({
          nombre: p.nombre, monto: +p.monto, forma_pago: p.forma_pago, imagen_url: '',
        }))
        setVentas(ventasCargadas)
        setProvs(provsCargados)
        originalRef.current = { provs: provsCargados, ventas: ventasCargadas }
      }
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [fecha, tipo, fechaValida, loadKey, setProvs, setVentas])

  const { efProv, totalVentas, totalProveedores } = form

  function recargarDesdeRemoto() {
    setError('')
    setCambioRemotoPendiente(false)
    setLoadKey((k) => k + 1)
  }

  /* Guardar — crea o actualiza */
  async function guardar(forzar = false) {
    if (cambioRemotoPendiente) {
      setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
      return
    }
    const proveedoresValidos = provs.filter((p) => p.nombre.trim() && p.monto > 0)
    if (proveedoresValidos.length === 0 && totalVentas === 0 && !forzar) {
      setShowGuardarVacioConfirm(true)
      return
    }
    setGuardando(true); setError('')
    try {
      if (turnoId) {
        if (turnoVersion && (await versionTurno(turnoId)) !== turnoVersion) {
          setCambioRemotoPendiente(true)
          setError('Este turno cambió en otro dispositivo. Recarga antes de guardar para evitar sobrescribir datos.')
          return
        }
        const original = originalRef.current
        await escribirTurno(turnoId, provs, ventas)
        mostrarToast({
          message: 'Cambios guardados',
          onUndo: async () => {
            await escribirTurno(turnoId, original.provs, original.ventas)
            toast.show({ message: 'Cambios deshechos', duration: 3000 })
          },
        })
      } else {
        const nuevoId = await crearTurno({ fecha, tipo, usuarioId: usuario.id, provs, ventas })
        mostrarToast({
          message: `Turno de ${tipo} creado`,
          onUndo: async () => {
            await borrarTurno(nuevoId)
            toast.show({ message: 'Registro deshecho', duration: 3000 })
          },
        })
      }
      navigate('/resumen', { state: { fecha } })
    } catch (err) {
      console.error(err)
      setError(err?.code === '23505'
        ? `Ya existe el turno de ${tipo} para esa fecha.`
        : 'Error al guardar. Inténtalo de nuevo.')
    } finally { setGuardando(false) }
  }

  function mostrarToast({ message, onUndo }) {
    toast.show({ message, actionLabel: 'Deshacer', onAction: onUndo })
  }

  /* Eliminar turno */
  async function eliminarTurno() {
    if (!turnoId) return
    const { error: err } = await supabase.from('turnos').delete().eq('id', turnoId)
    if (err) { setError('Error al eliminar el turno.'); return }
    navigate('/historial')
  }

  if (!fechaValida) {
    return (
      <Layout>
        <div className="card text-center text-gray-400 dark:text-zinc-500 py-12">
          Fecha inválida. Accedé desde el Historial.
        </div>
      </Layout>
    )
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  const modoEditar = !!turnoId
  const icono = tipo === 'mañana' ? 'sun' : 'moon'

  return (
    <Layout>
      <div className="max-w-lg md:max-w-4xl mx-auto space-y-5">
        {/* Encabezado */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 capitalize">{fechaLegible(fecha)}</p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <Icon name={icono} className="w-6 h-6" />
              <span className="capitalize">{tipo}</span>
            </h1>
            <div className="flex items-center gap-2">
              {modoEditar && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                  Editando
                </span>
              )}
              {modoEditar && (
                <button onClick={() => setShowEliminarConfirm(true)}
                  className="w-8 h-8 rounded-full grid place-items-center bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 hover:bg-red-100 transition"
                  title="Eliminar turno">
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <ProveedoresSection
            provs={provs}
            onAdd={form.openNew}
            onEdit={form.openEdit}
            accent={ACCENT}
            accentTint={ACCENT_TINT}
          />
          <VentasSection ventas={ventas} onEdit={form.openVenta} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">{error}</p>}
        {cambioRemotoPendiente && (
          <div className="flex items-center justify-between gap-3 text-sm text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            <span>Hay cambios de otro usuario en este turno.</span>
            <button onClick={recargarDesdeRemoto} className="shrink-0 font-semibold underline underline-offset-2">
              Recargar
            </button>
          </div>
        )}
      </div>

      <TurnoBottomBar
        totalVentas={totalVentas}
        totalProveedores={totalProveedores}
        efProv={efProv}
        guardando={guardando}
        disabled={cambioRemotoPendiente}
        label={modoEditar ? 'Guardar cambios' : 'Registrar turno'}
        onGuardar={() => guardar()}
      />
      <div className="pb-nav md:h-20" />

      <TurnoSheets
        sheet={form.sheet}
        setSheet={form.setSheet}
        isDesktop={isDesktop}
        sugerencias={sugerencias}
        usedNames={form.usedNames}
        commitProv={form.commitProv}
        commitVenta={form.commitVenta}
        delProv={form.delProv}
      />

      {/* Modal guardar turno vacío */}
      {showGuardarVacioConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowGuardarVacioConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base">¿Guardar turno vacío?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">No hay proveedores ni ventas ingresados.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowGuardarVacioConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={() => { setShowGuardarVacioConfirm(false); guardar(true) }} className="flex-1 btn-primary">Guardar igual</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal eliminar turno */}
      {showEliminarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowEliminarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-gray-900 dark:text-zinc-100 text-base capitalize">¿Eliminar turno de {tipo}?</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  Se eliminarán todos los datos de este turno. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEliminarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowEliminarConfirm(false); eliminarTurno() }}
                  className="flex-1 h-10 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
