import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { useToast } from './Toast'
import { marcarDiaCerrado } from '@/features/turno/api'
import { fechaLegible } from '@/lib/format'
import { mensajeDeError } from '@/lib/errorLog'
import { PILDORA, PILDORA_ON, PILDORA_OFF } from './pildora'
import { useRovingRadio } from '@/hooks/useRovingRadio'

/** Los motivos de siempre. "Otro" abre el campo de texto. */
const MOTIVOS = ['Domingo libre', 'Feriado', 'Vacaciones', 'Otro'] as const
type Motivo = (typeof MOTIVOS)[number]

const MAX = 60

/**
 * Marca un día como "el local no abrió". El motivo es opcional: se puede
 * confirmar sin elegir ninguno, porque lo que importa es distinguir el
 * día cerrado del día que alguien olvidó registrar.
 */
export function DiaCerradoSheet({ fecha, onClose }: { fecha: string; onClose: () => void }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState<Motivo | null>(null)
  const [otro, setOtro] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const radio = useRovingRadio(MOTIVOS, motivo, setMotivo)

  const texto = motivo === 'Otro' ? otro.trim() : (motivo ?? '')

  async function confirmar() {
    setGuardando(true)
    setError(null)
    try {
      await marcarDiaCerrado(fecha, true, texto || null)
      toast.ok('Marcado como día sin abrir')
      onClose()
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo marcar el día'))
      setGuardando(false)
    }
  }

  return (
    <BottomSheet
      title="¿El local no abrió?"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1 btn-lg" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn-primary flex-1 btn-lg" onClick={() => void confirmar()} disabled={guardando}>
            <span aria-live="polite">{guardando ? 'Un momento…' : 'Marcar el día'}</span>
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink2">
        {fechaLegible(fecha)} queda registrado como un día sin ventas, en vez de quedar en blanco.
      </p>

      <div>
        <p className="eyebrow mb-2">Motivo <span className="font-normal normal-case text-muted">(opcional)</span></p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo">
          {MOTIVOS.map((m, i) => (
            <button key={m} type="button" {...radio(m, i)}
              onClick={() => setMotivo(motivo === m ? null : m)}
              className={`${PILDORA} ${motivo === m ? PILDORA_ON : PILDORA_OFF}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {motivo === 'Otro' && (
        <label className="block">
          <span className="eyebrow">¿Cuál?</span>
          <input type="text" className="input mt-1.5" value={otro} maxLength={MAX} autoFocus
            onChange={(e) => setOtro(e.target.value)} placeholder="Corte de luz, mudanza…" />
        </label>
      )}

      {error && <p role="alert" className="text-sm text-neg">{error}</p>}
    </BottomSheet>
  )
}
