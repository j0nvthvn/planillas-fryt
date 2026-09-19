import { useTema, type Tema } from '@/lib/theme'
import { fechaDiaMes } from '@/lib/format'
import { useRovingRadio } from '@/hooks/useRovingRadio'
import { useMetricasCierre } from '../api'
import { Fila } from '../Fila'

export function Apariencia() {
  const { tema, setTema } = useTema()
  const temas: Tema[] = ['sistema', 'claro', 'oscuro']
  const temaRadio = useRovingRadio(temas, tema, setTema)
  return (
    <div className="space-y-3">
      <div className="card p-0 overflow-hidden">
        <Fila label="Apariencia">
          <div className="segmented" role="radiogroup" aria-label="Apariencia">
            {temas.map((t, i) => (
              <button key={t} type="button" {...temaRadio(t, i)} onClick={() => setTema(t)} className={`hit ${tema === t ? 'segmented-item-on' : 'segmented-item'} min-h-[36px] px-[11px] capitalize`}>{t}</button>
            ))}
          </div>
        </Fila>
      </div>
      <TiempoDeCierre />
    </div>
  )
}

/** Criterio del piloto: el cierre en la v2 debe tomar menos que en la app actual. */
function TiempoDeCierre() {
  const q = useMetricasCierre()
  const lista = q.data ?? []
  if (lista.length === 0) return null
  const prom = Math.round(lista.reduce((s, m) => s + m.segundos, 0) / lista.length)
  return (
    <div className="card p-0 overflow-hidden">
      <Fila label="Tiempo de cierre en este dispositivo" hint={`${lista.length} cierre${lista.length === 1 ? '' : 's'} medidos · promedio ${Math.floor(prom / 60)} min ${prom % 60} s`}>
        <span className="text-xs text-muted tabular-nums text-right">{lista.slice(0, 3).map((m) => `${fechaDiaMes(m.fecha)} ${Math.floor(m.segundos / 60)}:${String(m.segundos % 60).padStart(2, '0')}`).join(' · ')}</span>
      </Fila>
    </div>
  )
}
