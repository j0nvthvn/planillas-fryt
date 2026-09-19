import Spinner from '@/components/Spinner'
import { fechaHora } from '@/lib/format'
import { useLogsError } from '../api'

export function Errores() {
  const lista = useLogsError()
  if (lista.isPending) return <Spinner />
  return (
    <div className="card p-0 divide-y divide-hairline overflow-hidden">
      {(lista.data ?? []).map((e) => (
        <div key={e.id} className="px-4 py-3">
          <p className="text-sm text-ink break-words">{e.mensaje}</p>
          <p className="text-xs text-muted mt-0.5">{fechaHora(e.created_at)}{e.contexto ? ` · ${e.contexto}` : ''}{e.ruta ? ` · ${e.ruta}` : ''}</p>
        </div>
      ))}
      {(lista.data ?? []).length === 0 && <p className="text-center text-muted py-6 text-sm">Sin errores registrados.</p>}
    </div>
  )
}
