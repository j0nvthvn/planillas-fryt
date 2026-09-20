/**
 * Las pantallas que salen en la landing y en el portafolio.
 *
 * Los `id` y las `forma` tienen que coincidir con `maquetas.items[]` del
 * contenido del sitio (`landings/sitios/frytcontrol/src/contenido/sitio.ts`):
 * de ahí salen los nombres de archivo que el build de Astro espera.
 * Agregar una maqueta es agregar una entrada acá, y su `alt` allá.
 */
import { HOY, sumarDias } from './datos.mjs'

export const PANTALLAS = [
  {
    id: 'hoy',
    forma: 'celular',
    ruta: '/hoy',
    async listo(page) {
      await page.getByRole('heading', { name: 'Neto del día' }).waitFor()
      await page.getByRole('heading', { name: 'Ventas por método' }).waitFor()
    },
  },
  {
    id: 'turno',
    forma: 'celular',
    ruta: `/turno?fecha=${HOY}&modo=tarde`,
    async listo(page) {
      // La hoja de monto es la pantalla: el teclado es lo que la distingue.
      await page.locator('section[aria-label="Ventas"] button').first().click()
      await page.getByRole('dialog').waitFor()
      await page.getByRole('button', { name: '000', exact: true }).waitFor()
    },
  },
  {
    id: 'planilla',
    forma: 'celular',
    ruta: `/dia?fecha=${sumarDias(HOY, -1)}`,
    // La planilla no cabe en una pantalla de teléfono: la maqueta muestra el
    // turno completo —ventas, proveedores, caja y neto— en vez de su encabezado.
    desplazar: 1020,
    async listo(page) {
      await page.getByText('Planilla del día').first().waitFor()
      await page.getByText('Neto del día').first().waitFor()
    },
  },
  {
    id: 'historial',
    forma: 'escritorio',
    ruta: '/historial',
    async listo(page) {
      await page.getByRole('heading', { name: 'Historial' }).waitFor()
      await page.getByRole('group', { name: 'Filtro' }).waitFor()
    },
  },
  {
    id: 'analisis',
    forma: 'escritorio',
    ruta: `/analisis?desde=${sumarDias(HOY, -29)}&hasta=${HOY}`,
    async listo(page) {
      await page.getByRole('heading', { name: 'Análisis' }).waitFor()
      // Las barras entran animadas (recharts, 1,5 s). No se espera en tiempo
      // real: el reloj del navegador está congelado y render.mjs lo adelanta
      // lo suficiente antes de disparar, que es lo que hace la captura
      // reproducible al byte.
      await page.locator('.recharts-bar-rectangle').first().waitFor()
    },
  },
]

/**
 * Las medidas del contrato de la landing (paquetes/base/CONTRATO.md):
 * celular 780×1688 y escritorio 1920×1200, que es lo que tiene que medir el
 * PNG. El escritorio se renderiza a 1280 CSS con densidad 1,5 —y no a 1920
 * con densidad 1— porque la app centra su contenido: a 1920 la maqueta sale
 * con un tercio de la imagen vacío.
 */
export const FORMAS = {
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  escritorio: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 },
}

export const TEMAS = ['claro', 'oscuro']
