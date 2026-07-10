import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import Icon from '../components/Icon'
import { supabase } from '../lib/supabase'

function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function RegistroErrores() {
  const [logs, setLogs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    setError('')
    const { data, error: err } = await supabase
      .from('logs_error')
      .select('id, created_at, mensaje, contexto, ruta, detalle, usuario:usuarios(nombre)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (err) {
      console.error(err)
      setError('No se pudo cargar el registro de errores.')
    } else {
      setLogs(data || [])
    }
    setCargando(false)
  }

  return (
    <Layout>
      <div className="max-w-lg md:max-w-2xl mx-auto space-y-4">
        <PageHeader
          title="Registro de errores"
          date="Últimos 100 registrados, más reciente primero"
        />

        {error && (
          <div className="rounded-2xl bg-neg-tint border border-neg/30 px-4 py-3 text-sm text-neg">
            {error}
          </div>
        )}

        {cargando && <Spinner className="py-16" />}

        {!cargando && logs.length === 0 && !error && (
          <div className="card text-center py-12">
            <div className="w-14 h-14 rounded-full bg-pos-tint grid place-items-center mx-auto mb-3">
              <Icon name="check" className="w-6 h-6 text-pos" stroke={2.2} />
            </div>
            <p className="text-sm text-muted">Sin errores registrados.</p>
          </div>
        )}

        <div className="space-y-2">
          {logs.map((l) => {
            const abierto = expandido === l.id
            return (
              <div key={l.id} className="card">
                <button
                  type="button"
                  onClick={() => setExpandido(abierto ? null : l.id)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <span className="w-8 h-8 rounded-full bg-neg-tint grid place-items-center shrink-0 mt-0.5">
                    <Icon name="warning" className="w-4 h-4 text-neg" stroke={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">{l.mensaje}</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {fechaHora(l.created_at)} · {l.usuario?.nombre || 'sistema'}
                      {l.ruta && <> · {l.ruta}</>}
                    </p>
                  </div>
                  <Icon name={abierto ? 'chevL' : 'chevR'} className="w-4 h-4 text-muted2 shrink-0 mt-1" />
                </button>
                {abierto && (
                  <div className="mt-3 pt-3 border-t border-hairline space-y-1.5">
                    {l.contexto && (
                      <p className="text-[11px] text-muted2"><span className="font-semibold text-ink2">Contexto:</span> {l.contexto}</p>
                    )}
                    {l.detalle && (
                      <pre className="text-[10.5px] text-muted2 bg-canvas rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(l.detalle, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
