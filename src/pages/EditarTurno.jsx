import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks/useConfig'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { useErrorToast } from '../hooks/useErrorToast'
import { useConflictoRemoto } from '../hooks/useConflictoRemoto'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { fechaLegible } from '../utils/format'
import IconButton from '../components/IconButton'
import Icon from '../components/Icon'
import ConfirmDialog from '../components/ConfirmDialog'
import { ACCENT, ACCENT_TINT, VENTAS_VACIAS } from '../components/TurnoInput'
import { useTurnoForm } from '../components/turno/useTurnoForm'
import { useIsDesktop } from '../components/turno/useIsDesktop'
import { ProveedoresSection, VentasSection } from '../components/turno/TurnoSections'
import { TurnoSheets } from '../components/turno/TurnoSheets'
import { TurnoBottomBar } from '../components/turno/TurnoBottomBar'
import { guardarTurno, finalizarTurno, corregirTurno, versionTurno, borrarTurno, eliminarTurno as eliminarTurnoApi } from '../components/turno/turnoApi'

export default function EditarTurno() {
  const { usuario } = useAuth()
  const { config } = useConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const isDesktop = useIsDesktop()
  const [params] = useSearchParams()
  const fecha = params.get('fecha') || ''
  const tipo = params.get('tipo') || 'mañana'
  const from = location.state?.from

  const [cargando, setCargando] = useState(true)
  const [turnoId, setTurnoId] = useState(null)
  const [turnoEsDraft, setTurnoEsDraft] = useState(true)
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
        .select('id, updated_at, is_draft, proveedores:proveedores_turno(id, nombre, monto, forma_pago), ventas:ventas_turno(efectivo, getnet, mercadopago, edenred, amipass, transferencia)')
        .eq('jornada_id', jornada.id)
        .eq('tipo', tipo)
        .is('deleted_at', null)
        .maybeSingle()

      if (!activo) return
      if (errTurno) {
        setError('No se pudieron cargar los datos del turno. Revisa tu conexión e inténtalo de nuevo.')
        setCargando(false); return
      }
      if (turno) {
        setTurnoId(turno.id)
        setTurnoVersion(turno.updated_at)
        setTurnoEsDraft(!!turno.is_draft)
        setCambioRemotoPendiente(false)
        const v = Array.isArray(turno.ventas) ? turno.ventas[0] : turno.ventas
        const ventasCargadas = v
          ? { efectivo: +v.efectivo || 0, getnet: +v.getnet || 0, mercadopago: +v.mercadopago || 0, edenred: +v.edenred || 0, amipass: +v.amipass || 0, transferencia: +v.transferencia || 0 }
          : VENTAS_VACIAS
        const provsCargados = (turno.proveedores || []).map((p) => ({
          id: p.id, nombre: p.nombre, monto: +p.monto, forma_pago: p.forma_pago, imagen_url: '',
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

  useErrorToast(error)
  useConflictoRemoto(cambioRemotoPendiente, recargarDesdeRemoto)

  async function guardar(forzar = false) {
    if (cambioRemotoPendiente) {
      return
    }
    const proveedoresValidos = provs.filter((p) => p.nombre.trim() && p.monto > 0)
    if (proveedoresValidos.length === 0 && totalVentas === 0 && !forzar) {
      setShowGuardarVacioConfirm(true)
      return
    }
    if (totalVentas === 0 && !forzar) {
      setError('Ingresa las ventas del turno antes de guardar.')
      return
    }
    setGuardando(true); setError('')
    try {
      if (turnoId) {
        if (turnoVersion && (await versionTurno(turnoId)) !== turnoVersion) {
          setCambioRemotoPendiente(true)
          return
        }
        const original = originalRef.current
        await guardarTurno({ fecha, tipo, usuarioId: usuario.id, proveedores: provs, ventas })
        // El turno ya tenía un cierre (no era borrador): esta edición es
        // una corrección sobre un Z-report ya emitido, y queda su propio
        // registro encadenado en turno_cierres en vez de una
        // sobreescritura silenciosa.
        if (!turnoEsDraft) await corregirTurno(turnoId)
        toast.show({
          message: turnoEsDraft ? 'Cambios guardados' : 'Corrección registrada',
          actionLabel: 'Deshacer',
          onAction: async () => {
            await guardarTurno({ fecha, tipo, usuarioId: usuario.id, proveedores: original.provs, ventas: original.ventas })
            if (!turnoEsDraft) await corregirTurno(turnoId)
            toast.show({ message: 'Cambios deshechos', duration: 3000 })
          },
        })
      } else {
        const { turnoId: nuevoId } = await guardarTurno({ fecha, tipo, usuarioId: usuario.id, proveedores: provs, ventas, fondoInicial: config.fondoCajaInicial ?? 0 })
        // Un turno histórico se ingresa completo desde el principio, así
        // que queda cerrado de inmediato — mismo camino (cerrar_turno)
        // que usa el botón "Listo" del turno de hoy.
        await finalizarTurno(nuevoId)
        toast.show({
          message: `Turno de ${tipo} creado`,
          actionLabel: 'Deshacer',
          onAction: async () => {
            await borrarTurno(nuevoId)
            toast.show({ message: 'Registro deshecho', duration: 3000 })
          },
        })
      }
      navigate(from === 'historial' ? `/historial?fecha=${fecha}` : '/hoy')
    } catch (err) {
      console.error(err)
      setError(err?.code === '23505'
        ? `Ya existe el turno de ${tipo} para esa fecha.`
        : 'Error al guardar. Inténtalo de nuevo.')
    } finally { setGuardando(false) }
  }

  async function confirmarEliminar() {
    if (!turnoId) return
    try {
      await eliminarTurnoApi(turnoId)
    } catch (err) {
      console.error(err)
      setError('Error al eliminar el turno.')
      return
    }
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

  function volver() {
    navigate(from === 'historial' ? `/historial?fecha=${fecha}` : '/hoy')
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-4xl mx-auto space-y-4">
        <button
          type="button"
          onClick={volver}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink2 hover:text-ink -ml-1"
        >
          <Icon name="arrowLeft" className="w-4 h-4" stroke={2} />
          Volver
        </button>

        <PageHeader
          title={titulo}
          date={fechaLegible(fecha)}
          action={modoEditar && (
            <IconButton
              icon="trash"
              iconClassName="w-4 h-4"
              variant="danger"
              label="Eliminar turno"
              onClick={() => setShowEliminarConfirm(true)}
            />
          )}
        />

        {modoEditar && (
          <div className={`rounded-2xl border px-4 py-2.5 flex items-center gap-2.5 ${
            turnoEsDraft ? 'bg-info-tint border-info/30 text-info' : 'bg-warn-tint border-warn/30 text-warn'
          }`}>
            <Icon name={turnoEsDraft ? 'pencil' : 'warning'} className="w-4 h-4 shrink-0" stroke={1.8} />
            <p className="text-[12.5px] font-semibold">
              {turnoEsDraft
                ? 'Estás editando un borrador existente'
                : 'Este turno ya fue cerrado — guardar quedará registrado como una corrección'}
            </p>
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

      <ConfirmDialog
        open={showGuardarVacioConfirm}
        title="¿Guardar turno vacío?"
        description="No hay proveedores ni ventas ingresados."
        confirmLabel="Guardar igual"
        onCancel={() => setShowGuardarVacioConfirm(false)}
        onConfirm={() => { setShowGuardarVacioConfirm(false); guardar(true) }}
      />

      <ConfirmDialog
        open={showEliminarConfirm}
        title={<>¿Eliminar turno de <span className="capitalize">{tipo}</span>?</>}
        description="El turno se moverá a la papelera. El dueño podrá restaurarlo si fue un error."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setShowEliminarConfirm(false)}
        onConfirm={() => { setShowEliminarConfirm(false); confirmarEliminar() }}
      />
    </Layout>
  )
}
