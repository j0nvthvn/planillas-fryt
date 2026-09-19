import Icon from '@/components/Icon'
import { BottomSheet } from '@/components/BottomSheet'
import { hoy, sumarDias } from '@/lib/format'

/** Cambiar el día que se está cerrando. Nunca a futuro. */
export function FechaSheet({ fecha, onFecha, onClose }: { fecha: string; onFecha: (f: string) => void; onClose: () => void }) {
  return (
    <BottomSheet title="Cambiar fecha" onClose={onClose}>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => onFecha(sumarDias(fecha, -1))} aria-label="Día anterior"><Icon name="chevL" /></button>
        <input type="date" aria-label="Fecha del turno" className="input flex-1 text-center" value={fecha} max={hoy()}
          onChange={(e) => { if (e.target.value) onFecha(e.target.value) }} />
        <button type="button" className="btn-secondary" disabled={fecha >= hoy()} onClick={() => onFecha(sumarDias(fecha, 1))} aria-label="Día siguiente"><Icon name="chevR" /></button>
      </div>
      <button type="button" className="btn-primary btn-lg w-full" onClick={onClose}>Listo</button>
    </BottomSheet>
  )
}
