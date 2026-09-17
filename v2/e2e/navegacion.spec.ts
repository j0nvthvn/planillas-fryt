import { test, expect, type Page } from '@playwright/test'

/**
 * Ir y volver de la Planilla del día en el celular, contra staging. La flecha
 * vuelve a la pantalla de origen con su filtro y su scroll; las flechas de
 * día no se acumulan en el historial. Solo lee: no crea datos.
 */
const EMAIL = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const PASSWORD = process.env.STAGING_PASSWORD ?? process.env.SMOKE_PASSWORD ?? ''

test.skip(!PASSWORD, 'necesita STAGING_PASSWORD (v2/.env.staging.local)')

async function entrar(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/hoy/)
}

const main = (page: Page) => page.locator('main#contenido')
// Los e2e se tipan sin la librería DOM: basta con lo que se usa del elemento.
type ConScroll = { scrollTop: number }
const scrollDeMain = (page: Page) => main(page).evaluate((el) => (el as unknown as ConScroll).scrollTop)
const barra = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' }).last()
const filasDia = (page: Page) => main(page).locator('a[href*="/dia?"]')

test('la Planilla deja la barra, marca Historial y vuelve con el scroll', async ({ page }) => {
  await entrar(page)
  await barra(page).getByRole('link', { name: 'Historial' }).click()
  await expect(page).toHaveURL(/\/historial/)
  await expect(filasDia(page).nth(8)).toBeVisible()

  await main(page).evaluate((el) => { (el as unknown as ConScroll).scrollTop = 500 })
  await expect.poll(() => scrollDeMain(page)).toBeGreaterThan(400)
  const antes = await scrollDeMain(page)

  // Una fila que esté a la vista después del scroll.
  const filas = filasDia(page)
  let fila = filas.first()
  for (let i = 0; i < await filas.count(); i++) {
    const caja = await filas.nth(i).boundingBox()
    if (caja && caja.y > 150) { fila = filas.nth(i); break }
  }
  await fila.click()
  await expect(page).toHaveURL(/\/dia\?fecha=/)
  await expect(page.locator('main h1')).toBeVisible()

  // Barra visible, con Historial como sección actual; la pantalla parte arriba.
  await expect(barra(page)).toBeVisible()
  await expect(barra(page).getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'true')
  expect(await scrollDeMain(page)).toBe(0)

  // Dos días hacia atrás no agregan entradas: la flecha sale de una vez.
  const url = page.url()
  await page.getByRole('link', { name: 'Día anterior' }).click()
  await expect(page).not.toHaveURL(url)
  await page.getByRole('link', { name: 'Día anterior' }).click()
  await page.getByRole('link', { name: 'Volver' }).click()
  await expect(page).toHaveURL(/\/historial/)
  await expect.poll(() => scrollDeMain(page)).toBeGreaterThan(antes - 5)
  expect(await scrollDeMain(page)).toBeLessThan(antes + 5)
})

test('la flecha vuelve al origen con su filtro, o al Historial si no hay origen', async ({ page }) => {
  await entrar(page)

  await page.goto('/historial?filtro=corregidos')
  await filasDia(page).first().click()
  await expect(page).toHaveURL(/\/dia\?fecha=/)
  await page.getByRole('link', { name: 'Volver' }).click()
  await expect(page).toHaveURL(/\/historial\?filtro=corregidos/)

  // Desde Hoy: vuelve a Hoy, no al Historial.
  await barra(page).getByRole('link', { name: 'Hoy' }).click()
  await expect(page).toHaveURL(/\/hoy/)
  const aPlanilla = filasDia(page).first()
  if (await aPlanilla.count()) {
    await aPlanilla.click()
    await expect(page).toHaveURL(/\/dia\?fecha=/)
    await page.getByRole('link', { name: 'Volver' }).click()
    await expect(page).toHaveURL(/\/hoy/)
  }

  // Enlace directo en una pestaña nueva: no hay de dónde volver.
  const nueva = await page.context().newPage()
  await nueva.goto('/dia?fecha=2026-09-01')
  await expect(nueva.locator('main h1')).toBeVisible()
  await nueva.getByRole('link', { name: 'Volver' }).click()
  await expect(nueva).toHaveURL(/\/historial$/)
})

/**
 * La barra de estado del celular: la tapa `franja-barra` y el `theme-color` la
 * sigue, para que el sistema elija íconos que se distingan. Va del color de la
 * banda mientras esta cubre el tope, y si no, del fondo de la página.
 */
test('la barra de estado sigue la banda y el tema', async ({ page }) => {
  // Ventana baja: así Hoy tiene de sobra para bajar y perder la banda de vista.
  await page.setViewportSize({ width: 412, height: 480 })
  await entrar(page)
  const colorBarra = page.locator('meta[name="theme-color"]')
  await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible()
  await expect(colorBarra).toHaveAttribute('content', '#3730A3')

  await barra(page).getByRole('link', { name: 'Historial' }).click()
  await expect(colorBarra).toHaveAttribute('content', '#F6F7F9')
  await barra(page).getByRole('link', { name: 'Ajustes' }).click()
  await expect(colorBarra).toHaveAttribute('content', '#3730A3')

  // Al bajar, la banda sale de la pantalla y la barra vuelve al fondo.
  await main(page).evaluate((el) => { (el as unknown as ConScroll).scrollTop = 600 })
  await expect.poll(() => scrollDeMain(page)).toBeGreaterThan(220)
  await expect(colorBarra).toHaveAttribute('content', '#F6F7F9')
  await main(page).evaluate((el) => { (el as unknown as ConScroll).scrollTop = 0 })
  await expect(colorBarra).toHaveAttribute('content', '#3730A3')

  await page.getByRole('link', { name: /Apariencia/ }).click()
  await expect(colorBarra).toHaveAttribute('content', '#F6F7F9')
  await page.getByRole('radio', { name: 'oscuro' }).click()
  await expect(colorBarra).toHaveAttribute('content', '#0B0D10')
  await barra(page).getByRole('link', { name: 'Hoy' }).click()
  await expect(colorBarra).toHaveAttribute('content', '#1E2240')
})
