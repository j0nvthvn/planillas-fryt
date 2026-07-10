import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import { clp, fechaLegible } from '../utils/format'
import { totalesVentas, totalesProveedores } from '../utils/totales'
import { listarPapelera, restaurarTurno, eliminarTurnoDefinitivo } from '../components/turno/turnoApi'

function fechaHoraEliminado(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Papelera() {
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [restaurandoId, setRestaurandoId] = useState(null)
  const [objetivoPurgar, setObjetivoPurgar] = useState(null)
  const [purgando, setPurgando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setItems(await listarPapelera())
    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la papelera.')
    } finally {
      setCargando(false)
    }
  }

  async function handleRestaurar(id) {
    setRestaurandoId(id)
    try {
      await restaurarTurno(id)
      setItems((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error(err)
      setError('No se pudo restaurar el turno.')
    } finally {
      setRestaurandoId(null)
    }
  }

  async function handlePurgar() {
    if (!objetivoPurgar) return
    setPurgando(true)
    try {
      await eliminarTurnoDefinitivo(objetivoPurgar.id)
      setItems((prev) => prev.filter((t) => t.id !== objetivoPurgar.id))
      setObjetivoPurgar(null)
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar definitivamente.')
    } finally {
      setPurgando(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-2xl mx-auto space-y-4">
        <PageHeader
          title="Papelera"
          date="Turnos eliminados, listos para restaurar"
        />

        {error && (
          <div className="rounded-2xl bg-neg-tint border border-neg/30 px-4 py-3 text-sm text-neg">
            {error}
          </div>
        )}

        {cargando && <Spinner className="py-16" />}

        {!cargando && items.length === 0 && (
          <div className="card text-center py-12">
            <div className="w-14 h-14 rounded-full bg-soft grid place-items-center mx-auto mb-3">
              <Icon name="trash" className="w-6 h-6 text-muted2" stroke={1.6} />
            </div>
            <p className="text-sm text-muted">La papelera está vacía.</p>
          </div>
        )}

        {!cargando && items.map((t) => {
          const vt = totalesVentas(t.ventas)
          const pt = totalesProveedores(t.proveedores)
          return (
            <div key={t.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink capitalize text-[14px] truncate">
                    Turno de {t.tipo} · {fechaLegible(t.jornada?.fecha)}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Registrado por {t.usuario?.nombre || 'desconocido'} · eliminado el {fechaHoraEliminado(t.deleted_at)}
                  </p>
                </div>
                <p className="font-display tabular-nums text-[17px] text-ink shrink-0">
                  {clp(vt.total)}
                </p>
              </div>

              {(vt.total > 0 || pt.total > 0) && (
                <p className="text-xs text-muted2">
                  Ventas {clp(vt.total)} · Proveedores {clp(pt.total)}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleRestaurar(t.id)}
                  disabled={restaurandoId === t.id}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold bg-brand-tint text-brand border border-brand/30 disabled:opacity-50"
                >
                  {restaurandoId === t.id ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                  ) : (
                    <Icon name="history" className="w-4 h-4" stroke={1.8} />
                  )}
                  Restaurar
                </button>
                <button
                  onClick={() => setObjetivoPurgar(t)}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-[13px] font-semibold border border-hairline text-neg hover:bg-neg-tint transition-colors"
                >
                  <Icon name="trash" className="w-4 h-4" stroke={1.8} />
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!objetivoPurgar}
        title="¿Eliminar definitivamente?"
        description="Esta acción no se puede deshacer. El turno y sus datos se borrarán para siempre."
        confirmLabel="Eliminar definitivamente"
        danger
        onCancel={() => setObjetivoPurgar(null)}
        onConfirm={handlePurgar}
        confirmDisabled={purgando}
      />
    </Layout>
  )
}
