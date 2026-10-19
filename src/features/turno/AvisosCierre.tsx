import { Link } from '@tanstack/react-router'

/** Los avisos sobre el formulario de cierre, en orden de importancia. */
export function AvisosCierre({ noAbrio, esDueno, quitarMarca, soloLectura, correccion, conflictoOculto, onElegirConflicto, localOk, errorGuardado }: {
  noAbrio: boolean
  esDueno: boolean
  quitarMarca: { ocupado: boolean; quitar: () => Promise<unknown> }
  soloLectura: boolean
  /** Turno ya cerrado que la dueña está corrigiendo. */
  correccion: boolean
  /** Hay un conflicto y su hoja está cerrada: se avisa para poder elegir. */
  conflictoOculto: boolean
  onElegirConflicto: () => void
  localOk: boolean
  errorGuardado: string | null
}) {
  return (
    <>
      {noAbrio && (
        <div role="status" className="mb-4 aviso bg-warn-tint text-warn flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Este día está marcado como <b>sin abrir</b>.</span>
          {esDueno && (
            <button type="button" disabled={quitarMarca.ocupado}
              onClick={() => void quitarMarca.quitar()}
              className="hit font-bold underline">
              {quitarMarca.ocupado ? 'Un momento…' : 'Quitar la marca y registrar'}
            </button>
          )}
        </div>
      )}
      {soloLectura && (
        <div role="status" className="mb-4 aviso bg-info-tint text-info">
          Este turno ya está cerrado. Solo la dueña puede corregirlo. <Link to="/hoy" className="font-bold underline">Volver a Hoy</Link>
        </div>
      )}
      {correccion && (
        <div className="mb-4 aviso bg-info-tint text-info">
          Turno cerrado: al guardar se registra una <b>corrección</b> con la fotografía anterior y la nueva.
        </div>
      )}
      {conflictoOculto && (
        <div role="alert" className="mb-4 aviso bg-warn-tint text-warn">
          <span>
            Este turno cambió en otro dispositivo. Lo tuyo sigue en este dispositivo, pero no se guarda hasta que elijas.{' '}
            <button type="button" className="underline font-semibold" onClick={onElegirConflicto}>Elegir</button>
          </span>
        </div>
      )}
      {!localOk && !soloLectura && (
        <div role="alert" className="mb-4 aviso bg-neg-tint text-neg">
          Este dispositivo no está guardando el borrador (¿navegación privada o sin espacio?). No cierres la app hasta cerrar el turno.
        </div>
      )}
      {errorGuardado && (
        <div role="alert" className="mb-4 aviso bg-neg-tint text-neg">
          {errorGuardado}
        </div>
      )}
    </>
  )
}
