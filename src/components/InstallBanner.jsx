import { useState } from 'react'
import Icon from './Icon'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const CLAVE_DESCARTE = 'instalarAppDescartadoHasta'
const DIAS_ANTES_DE_REPETIR = 21

function fueDescartadoRecientemente() {
  const hasta = localStorage.getItem(CLAVE_DESCARTE)
  return hasta && Date.now() < +hasta
}

function descartar() {
  const hasta = Date.now() + DIAS_ANTES_DE_REPETIR * 24 * 3_600_000
  localStorage.setItem(CLAVE_DESCARTE, String(hasta))
}

/**
 * Ofrece instalar la app dentro de la propia interfaz, en vez de depender
 * de que el usuario note el ícono del navegador (Android/Chrome) o sepa el
 * camino manual de iOS (Compartir → Agregar a inicio, no hay evento nativo
 * para eso). Se descarta por un tiempo si el usuario lo cierra.
 */
export default function InstallBanner() {
  const { instalada, puedeInstalarNativo, esIOS, instalar } = useInstallPrompt()
  const [cerrado, setCerrado] = useState(() => fueDescartadoRecientemente())
  const [mostrarPasosIOS, setMostrarPasosIOS] = useState(false)

  if (instalada || cerrado) return null
  if (!puedeInstalarNativo && !esIOS) return null

  function cerrar() {
    descartar()
    setCerrado(true)
  }

  async function handleInstalar() {
    if (esIOS) {
      setMostrarPasosIOS(true)
      return
    }
    await instalar()
  }

  return (
    <div className="mb-3.5 rounded-2xl bg-brand-tint border border-brand/25 px-4 py-3 flex items-start gap-3">
      <span className="w-8 h-8 rounded-full bg-brand/15 grid place-items-center shrink-0 mt-0.5">
        <Icon name="download" className="w-4 h-4 text-brand" stroke={2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-ink">Instala FrytControl en tu celular</p>
        {!mostrarPasosIOS ? (
          <>
            <p className="text-[12px] text-muted mt-0.5">
              Acceso directo desde la pantalla de inicio, sin pasar por el navegador.
            </p>
            <button
              onClick={handleInstalar}
              className="mt-2 text-[12.5px] font-bold text-brand hover:underline underline-offset-2"
            >
              {esIOS ? 'Ver cómo instalar →' : 'Instalar app →'}
            </button>
          </>
        ) : (
          <ol className="text-[12px] text-ink2 mt-1.5 space-y-1 list-decimal list-inside">
            <li>Toca el ícono <Icon name="share" className="w-3.5 h-3.5 inline text-brand -mt-0.5" stroke={2} /> Compartir en Safari</li>
            <li>Elige "Agregar a pantalla de inicio"</li>
            <li>Confirma con "Agregar"</li>
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="shrink-0 text-muted2 hover:text-ink2 -mt-1 -mr-1 p-1"
      >
        <Icon name="close" className="w-4 h-4" stroke={2} />
      </button>
    </div>
  )
}
