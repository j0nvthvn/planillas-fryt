import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Revisión automática de accesibilidad (axe) en las pantallas principales,
 * en claro y oscuro, contra staging. Falla con violaciones serias o
 * críticas; las demás se imprimen para mirarlas. Solo lee: no crea datos.
 */
const EMAIL = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const PASSWORD = process.env.STAGING_PASSWORD ?? process.env.SMOKE_PASSWORD ?? ''

test.skip(!PASSWORD, 'necesita STAGING_PASSWORD (v2/.env.staging.local)')

const PANTALLAS = ['/hoy', '/turno', '/historial', '/analisis', '/proveedores', '/ajustes', '/ajustes?seccion=correos', '/ajustes?seccion=metodos', '/ajustes?seccion=apariencia']

async function entrar(page: Page, tema: 'claro' | 'oscuro') {
  await page.addInitScript((t) => localStorage.setItem('tema', t), tema)
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/hoy/)
}

async function revisar(page: Page, donde: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  for (const v of r.violations) console.log(`[${donde}] ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(graves.map((v) => `${v.id} (${v.nodes.length})`), donde).toEqual([])
}

for (const tema of ['claro', 'oscuro'] as const) {
  test(`pantallas sin violaciones graves (${tema})`, async ({ page }) => {
    test.setTimeout(180_000)
    await entrar(page, tema)
    for (const ruta of PANTALLAS) {
      await page.goto(ruta)
      await expect(page.locator('main h1:visible').first()).toBeVisible()
      // Que terminen de llegar los datos (sin spinner) antes de revisar.
      await expect(page.locator('main [aria-label="Cargando"]')).toHaveCount(0)
      await revisar(page, `${tema} ${ruta}`)
    }
  })
}

test('hoja del teclado de montos sin violaciones graves', async ({ page }) => {
  await entrar(page, 'claro')
  await page.goto('/turno')
  await page.getByRole('button', { name: /^Efectivo/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page, 'hoja de monto')
})
