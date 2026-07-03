import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
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
  const [turnoId, setTurnoId] = useState(null)
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

  const { totalVentas } = form

  function recargarDesdeRemoto() {
    setError('')
    setCambioRemotoPendiente(false)
    setLoadKey((k) => k + 1)
  }

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
        toast.show({
          message: 'Cambios guardados',
          actionLabel: 'Deshacer',
          onAction: async () => {
            await escribirTurno(turnoId, original.provs, original.ventas)
            toast.show({ message: 'Cambios deshechos', duration: 3000 })
          },
        })
      } else {
        const nuevoId = await crearTurno({ fecha, tipo, usuarioId: usuario.id, provs, ventas })
        toast.show({
          message: `Turno de ${tipo} creado`,
          actionLabel: 'Deshacer',
          onAction: async () => {
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

  async function eliminarTurno() {
    if (!turnoId) return
    const { error: err } = await supabase.from('turnos').delete().eq('id', turnoId)
    if (err) { setError('Error al eliminar el turno.'); return }
    navigate('/historial')
  }

  if (!fechaValida) {
    return (
      <Layout>
        <div className="card text-center text-muted py-12">
          Fecha inválida. Accede desde el Historial.
        </div>
      </Layout>
    )
  }

  if (cargando) return <Layout><Spinner className="py-16" /></Layout>

  const modoEditar = !!turnoId
  const titulo = modoEditar ? 'Editar turno' : 'Registrar turno'

  return (
    <Layout>
      <div className="max-w-lg md:max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <PageHeader
            title={titulo}
            date={fechaLegible(fecha)}
          />
          {modoEditar && (
            <button
              onClick={() => setShowEliminarConfirm(true)}
              aria-label="Eliminar turno"
              className="shrink-0 w-10 h-10 rounded-[13px] border border-hairline text-neg grid place-items-center hover:bg-neg-tint transition-colors mt-1"
            >
              <Icon name="trash" className="w-4 h-4" />
            </button>
          )}
        </div>

        {modoEditar && (
          <div className="rounded-2xl bg-warn-tint border border-warn/30 px-3.5 py-2 text-[13px] text-warn flex items-center gap-2">
            <Icon name="edit" className="w-3.5 h-3.5" stroke={2} />
            Estás editando un turno existente
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <ProveedoresSection
            provs={provs}
            onAdd={form.openNew}
            onEdit={form.openEdit}
            accent={ACCENT}
            accentTint={ACCENT_TINT}
          />
          <VentasSection ventas={ventas} onEdit={form.openVenta} />
        </div>

        {error && (
          <p className="text-sm text-neg bg-neg-tint border border-neg/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}
        {cambioRemotoPendiente && (
          <div className="flex items-center justify-between gap-3 text-sm text-info bg-info-tint border border-info/30 rounded-lg px-3 py-2">
            <span>Hay cambios de otro usuario en este turno.</span>
            <button onClick={recargarDesdeRemoto} className="shrink-0 font-semibold underline underline-offset-2">
              Recargar
            </button>
          </div>
        )}
      </div>

      <TurnoBottomBar
        total={totalVentas}
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

      {showGuardarVacioConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowGuardarVacioConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-ink text-base">¿Guardar turno vacío?</p>
                <p className="text-sm text-ink2 mt-1">No hay proveedores ni ventas ingresados.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowGuardarVacioConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button onClick={() => { setShowGuardarVacioConfirm(false); guardar(true) }} className="flex-1 btn-primary">Guardar igual</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showEliminarConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowEliminarConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4">
              <div>
                <p className="font-bold text-ink text-base capitalize">¿Eliminar turno de {tipo}?</p>
                <p className="text-sm text-ink2 mt-1">
                  Se eliminarán todos los datos de este turno. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowEliminarConfirm(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button
                  onClick={() => { setShowEliminarConfirm(false); eliminarTurno() }}
                  className="flex-1 btn-danger"
                >
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
