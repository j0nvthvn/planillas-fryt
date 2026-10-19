import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import PageHeader from '@/components/PageHeader'
import Icon from '@/components/Icon'
import { EsqueletoContenido } from '@/components/Esqueleto'
import { BottomSheet } from '@/components/BottomSheet'
import { useToast } from '@/hooks/useToast'
import { useOnline } from '@/hooks/useOnline'
import { useUsuario } from '@/hooks/useUsuario'
import { useConfig, useMetodos, useTrabajadores } from '@/features/catalogo/api'
import { etiquetaModo, useResumenDia, type Modo } from './api'
import { modoPorDefecto, modosDisponibles, etiquetaCerrar, tituloCierre } from './modo'
import { useTurnoForm } from './useTurnoForm'
import { useQuitarMarcaDia } from './useQuitarMarcaDia'
import { textoGuardado } from './estadoTurno'
import { estadoCatalogo } from './catalogoCierre'
import { RevisionSheet } from './RevisionSheet'
import { AvisosCierre } from './AvisosCierre'
import { BarraCierre } from './BarraCierre'
import { HojasCierre, type HojaCierre } from './HojasCierre'
import { SeccionCaja, SeccionModo, SeccionProveedores, SeccionTrabajador, SeccionVentas } from './SeccionesCierre'
import { clp, fechaLegible, hoy, diaSemana, fechaDiaMes } from '@/lib/format'
import { esMetodo } from '@/lib/totales'

export default function CerrarTurno() {
  const search = useSearch({ from: '/app/turno' })
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { esDueno } = useUsuario()
  const { config, listo: configLista, error: errorConfig, reintentar: reintentarConfig } = useConfig()
  const metodos = useMetodos()
  const trabajadores = useTrabajadores()
  const catalogo = estadoCatalogo({
    config: { data: configLista ? config : undefined, isError: !!errorConfig },
    metodos, trabajadores,
  })

  const fecha = search.fecha ?? hoy()
  const diaUnicoConfig = config.diasTurnoUnico.includes(diaSemana(fecha))
  // El día puede estar marcado como "el local no abrió": se avisa antes de
  // llenar la planilla, porque al guardar la base lo rechaza (23514).
  const resumenDia = useResumenDia(fecha, { refrescarAlAbrir: true })
  const noAbrio = resumenDia.data?.cerrado === true
  const quitarMarca = useQuitarMarcaDia(fecha)

  // Primero se necesitan el día y la configuración para decidir el modo por defecto.
  const form = useTurnoForm({ fecha, modo: search.modo ?? 'completo', fondoPorDefecto: configLista ? config.fondoCajaInicial : null, online })
  const estadoDia = useMemo(() => ({
    turnos: form.dia.map((t) => ({ tipo: t.turno.tipo, modo: t.turno.modo, is_draft: t.turno.is_draft })),
    diaUnicoConfig,
  }), [form.dia, diaUnicoConfig])

  useEffect(() => {
    if (!search.modo && !form.cargandoDia && configLista) {
      void navigate({ to: '/turno', search: { fecha, modo: modoPorDefecto(estadoDia) }, replace: true })
    }
  }, [search.modo, form.cargandoDia, configLista, estadoDia, fecha, navigate])

  const modo: Modo = search.modo ?? 'completo'
  const disponibles = modosDisponibles(estadoDia)
  const { state, cambiar, totales } = form

  const [sheet, setSheet] = useState<HojaCierre | null>(null)
  const [revisar, setRevisar] = useState(false)

  // La pantalla se muestra (y con ella la barra fija) cuando están el
  // formulario, el catálogo y, con conexión, la marca «No abrió» del día.
  const mostrando = !!search.modo && form.listo && catalogo === 'listo' && (!online || resumenDia.isFetchedAfterMount)
  const soloLectura = state.cerrado && !esDueno

  const turnoManana = form.dia.find((t) => t.turno.tipo === 'mañana')?.turno

  /** El botón de la barra ya no cierra: abre la revisión. */
  function pedirCierre() {
    // Turno ya cerrado sin cambios: no se registra una corrección vacía.
    if (state.cerrado && !state.sucio) {
      toast.show({ message: 'No hay cambios que guardar' })
      void navigate({ to: '/dia', search: { fecha }, replace: true })
      return
    }
    setSheet(null)
    setRevisar(true)
  }

  function alCerrarBien() {
    toast.ok(state.cerrado ? 'Corrección guardada' : modo === 'completo' ? 'Día cerrado' : `Turno ${modo} cerrado`)
    void navigate({ to: '/hoy' })
  }

  async function onCerrar() {
    const r = await form.cerrar()
    setRevisar(false)
    if (r.estado === 'ok') alCerrarBien()
    else if (r.estado === 'error') toast.error(r.mensaje)
  }

  // La hoja de conflicto se puede cerrar sin elegir: lo local se conserva y
  // un aviso permite volver a abrirla. Antes, cerrarla descartaba lo local.
  // Un conflicto nuevo (u otro objeto, como al pasar a «al cerrar») se muestra.
  const [conflictoOculto, setConflictoOculto] = useState<typeof form.conflicto>(null)
  const verConflicto = !!form.conflicto && form.conflicto !== conflictoOculto

  async function onReemplazar() {
    const alCerrar = form.conflicto?.alCerrar ?? false
    const r = await form.sobrescribir(alCerrar)
    if (r.estado === 'ok' && alCerrar) alCerrarBien()
    else if (r.estado === 'error') toast.error(r.mensaje)
  }

  const errorAlCargar = online && resumenDia.isError ? () => void resumenDia.refetch() : form.errorDia ? form.reintentarDia : null
  const reintentarCatalogo = () => {
    if (!configLista) reintentarConfig()
    if (!metodos.data) void metodos.refetch()
    if (!trabajadores.data) void trabajadores.refetch()
  }
  if (errorAlCargar || catalogo === 'error') return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PageHeader title="Cerrar turno" back="/hoy" />
      <p role="alert">{errorAlCargar ? 'No pudimos cargar lo registrado de este día.' : 'No pudimos cargar los métodos de pago, los trabajadores o la configuración.'} Vuelve a intentarlo.</p>
      <button type="button" className="btn-primary" onClick={errorAlCargar ?? reintentarCatalogo}>Reintentar</button>
    </div>
  )
  if (!mostrando) return <EsqueletoContenido />

  const guardado = textoGuardado({ sync: form.sync, cerrado: state.cerrado, localOk: form.localOk })

  return (
    <div className="max-w-2xl mx-auto pb-28">
      <PageHeader
        title={tituloCierre(modo, state.cerrado)}
        back="/hoy"
        subtitle={esDueno ? (state.cerrado ? fechaLegible(fecha) : guardado?.texto ?? fechaLegible(fecha)) : fechaLegible(fecha)}
        action={esDueno && (
          <button type="button" onClick={() => setSheet({ t: 'fecha' })} aria-label={`Cambiar fecha, ${fechaDiaMes(fecha)}`}
            className="btn-secondary btn-bar gap-[7px]">
            <Icon name="calendar" className="w-4 h-4" />{fechaDiaMes(fecha)}
          </button>
        )}
      />

      <AvisosCierre
        noAbrio={noAbrio} esDueno={esDueno} quitarMarca={quitarMarca} soloLectura={soloLectura}
        correccion={state.cerrado && esDueno}
        conflictoOculto={!!form.conflicto && !verConflicto} onElegirConflicto={() => setConflictoOculto(null)}
        localOk={form.localOk} errorGuardado={online ? form.errorAutosave : null}
      />

      <SeccionModo modo={modo} disponibles={disponibles} soloLectura={soloLectura} fecha={fecha} diaUnico={diaUnicoConfig}
        onModo={(m) => void navigate({ to: '/turno', search: { fecha, modo: m } })} />
      <SeccionTrabajador trabajadores={trabajadores.data ?? []} trabajadorId={state.trabajadorId} soloLectura={soloLectura} esDueno={esDueno}
        onElegir={(id) => cambiar({ type: 'trabajador', id })} />
      <SeccionVentas metodos={metodos.data ?? []} ventas={state.ventas} total={totales.total_ventas} modo={modo} turnoManana={turnoManana}
        soloLectura={soloLectura} onAbrir={(key) => setSheet({ t: 'venta', key })} />
      <SeccionProveedores proveedores={state.proveedores} total={totales.total_proveedores} soloLectura={soloLectura}
        onAbrir={(linea) => setSheet({ t: 'prov', linea })} />
      <SeccionCaja fondoInicial={state.fondoInicial} esperado={totales.efectivo_esperado} contoCaja={state.contoCaja}
        efectivoContado={state.efectivoContado} diferencia={form.diferenciaCaja} soloLectura={soloLectura}
        onFondo={() => setSheet({ t: 'fondo' })} onContar={() => setSheet({ t: 'conteo' })}
        onNoConto={() => cambiar({ type: 'caja', conto: false, monto: null })} />

      {!soloLectura && (
        <BarraCierre etiquetaNeto={`Neto ${modo === 'completo' ? 'del día' : 'del turno'}`} neto={totales.neto}
          guardado={guardado}
          guardando={form.guardando} etiquetaBoton={etiquetaCerrar(modo, state.cerrado)} onCerrar={pedirCierre} />
      )}

      <HojasCierre hoja={sheet} abrir={setSheet} state={state} cambiar={cambiar} metodos={metodos.data ?? []} modo={modo}
        turnoManana={turnoManana} esperado={totales.efectivo_esperado} fecha={fecha}
        onFecha={(f) => void navigate({ to: '/turno', search: { fecha: f } })} />

      {revisar && (
        <RevisionSheet
          modo={modo}
          yaCerrado={state.cerrado}
          metodos={(metodos.data ?? []).filter((m) => esMetodo(m.key))}
          ventas={state.ventas}
          proveedores={state.proveedores}
          trabajador={trabajadores.data?.find((x) => x.id === state.trabajadorId)?.nombre ?? null}
          datos={{
            trabajadorId: state.trabajadorId,
            hayTrabajadores: (trabajadores.data?.length ?? 0) > 0,
            contoCaja: state.contoCaja,
            diferenciaCaja: form.diferenciaCaja,
            totalVentas: totales.total_ventas,
            totalProveedores: totales.total_proveedores,
          }}
          totales={totales}
          fondoInicial={state.fondoInicial}
          efectivoContado={state.efectivoContado}
          guardando={form.guardando}
          onConfirmar={() => void onCerrar()}
          onClose={() => setRevisar(false)}
        />
      )}

      {form.conflicto && verConflicto && (
        <BottomSheet title="Este turno cambió en otro dispositivo" onClose={() => setConflictoOculto(form.conflicto)}>
          <p className="text-sm text-ink2">
            Mientras escribías, alguien guardó este mismo turno ({etiquetaModo(form.conflicto.actual.modo)} · ventas {clp(form.conflicto.actual.total_ventas)}).
            ¿Qué quieres hacer?
          </p>
          <button type="button" className="btn-primary btn-lg w-full" onClick={() => void form.adoptarServidor()}>Ver lo que se guardó (descarta lo mío)</button>
          <button type="button" disabled={form.guardando} className="btn-secondary btn-lg w-full" onClick={() => void onReemplazar()}>
            {form.conflicto.alCerrar ? 'Reemplazar con lo mío y cerrar' : 'Conservar lo mío y reemplazar'}
          </button>
        </BottomSheet>
      )}
    </div>
  )
}
