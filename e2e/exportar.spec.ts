import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * Exportar desde Análisis contra staging (solo lectura): el CSV por turno
 * cuadra con el KPI de neto, el Excel se descarga y el reporte se abre.
 * Staging es una copia de prod del 2026-09-16: agosto tiene datos.
 */
const EMAIL = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const PASSWORD = process.env.STAGING_PASSWORD ?? process.env.SMOKE_PASSWORD ?? ''
const DESDE = '2026-08-01'
const HASTA = '2026-08-31'

test.skip(!PASSWORD, 'necesita STAGING_PASSWORD (v2/.env.staging.local)')

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 })
const clp = (n: number) => (n < 0 ? `−${CLP.format(-n)}` : CLP.format(n))

async function entrar(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/hoy/)
}

async function abrirExportar(page: Page) {
  await page.goto(`/analisis?desde=${DESDE}&hasta=${HASTA}`)
  await page.getByRole('button', { name: 'Exportar' }).click()
  const hoja = page.getByRole('dialog', { name: 'Exportar' })
  await expect(hoja).toBeVisible()
  // En el navegador de pruebas no hay menú de compartir; si lo hubiera, se desmarca.
  const compartir = hoja.getByLabel(/Compartir al terminar/)
  if (await compartir.isVisible()) await compartir.uncheck()
  return hoja
}

test('el CSV por turno cuadra con el neto del período', async ({ page }) => {
  await entrar(page)
  const hoja = await abrirExportar(page)
  const [descarga] = await Promise.all([page.waitForEvent('download'), hoja.getByRole('button', { name: /CSV por turno/ }).click()])
  expect(descarga.suggestedFilename()).toBe(`frytcontrol_${DESDE}_${HASTA}_turnos.csv`)

  const texto = await readFile(await descarga.path(), 'utf8')
  expect(texto.charCodeAt(0)).toBe(0xfeff)
  const lineas = texto.slice(1).split('\r\n')
  const columnas = (lineas[0] ?? '').split(';')
  const total = lineas.at(-1)!.split(';')
  expect(total[0]).toBe('TOTAL')
  expect(lineas.length).toBeGreaterThan(2)
  const neto = Number(total[columnas.indexOf('Neto')])
  await expect(page.locator('.card', { hasText: /^Neto/ }).first()).toContainText(clp(neto))
})

test('el Excel se descarga y el reporte se abre', async ({ page }) => {
  await entrar(page)
  let hoja = await abrirExportar(page)
  const [descarga] = await Promise.all([page.waitForEvent('download'), hoja.getByRole('button', { name: /Excel completo/ }).click()])
  expect(descarga.suggestedFilename()).toBe(`frytcontrol_${DESDE}_${HASTA}.xlsx`)
  const xlsx = await readFile(await descarga.path())
  expect(xlsx.subarray(0, 2).toString()).toBe('PK') // un .xlsx es un zip
  expect(xlsx.length).toBeGreaterThan(5000)

  hoja = await abrirExportar(page)
  await hoja.getByRole('link', { name: /Reporte para imprimir/ }).click()
  await expect(page).toHaveURL(/\/analisis\/reporte/)
  await expect(page.getByRole('heading', { name: /Reporte del 01-08-2026 al 31-08-2026/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Por día' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cuadre de caja' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})
