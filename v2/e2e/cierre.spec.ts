import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * El recorrido que importa: la dueña entra, registra el día en el celular,
 * cuenta la caja por billetes, revisa y cierra; después la planilla muestra
 * lo mismo. Contra staging, con una fecha de 2028 que se borra al final.
 */
// URL y anon key salen de .env.staging.local (las carga playwright.config).
const URL = process.env.VITE_SUPABASE_URL ?? ''
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const EMAIL = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const PASSWORD = process.env.STAGING_PASSWORD ?? process.env.SMOKE_PASSWORD ?? ''
const FECHA = `2028-0${1 + Math.floor(Math.random() * 9)}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`

test.skip(!PASSWORD, 'necesita STAGING_PASSWORD (v2/.env.staging.local)')

test.afterAll(async () => {
  if (!ANON || !URL || /kfmwhtbvgqurnpotypii|aecopggpahxjaglakqwd/.test(URL)) return
  const sb = createClient(URL, ANON)
  await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  await sb.from('jornadas').delete().eq('fecha', FECHA)
  await sb.auth.signOut()
})

async function entrar(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/hoy/)
}

/** Teclado de la hoja: escribe un monto dígito a dígito. */
async function teclear(page: Page, monto: number) {
  for (const d of String(monto)) await page.getByRole('button', { name: d, exact: true }).click()
}

test('cerrar un día completo con conteo por billetes', async ({ page }) => {
  await entrar(page)
  await page.goto(`/turno?fecha=${FECHA}&modo=completo`)
  await expect(page.getByRole('heading', { name: 'Cerrar el día' })).toBeVisible()

  // Efectivo por el teclado encadenado; el resto se omite.
  await page.getByRole('button', { name: /^Efectivo/ }).click()
  await teclear(page, 120000)
  await page.getByRole('button', { name: /Guardar y volver/ }).click()

  // Conteo de caja por denominaciones: 5 de $20.000 + 4 de $5.000 = $120.000.
  await page.getByRole('radio', { name: 'Sí' }).click()
  await expect(page.getByRole('dialog')).toContainText('Conteo de caja')
  await page.getByLabel('Cuántos de $20.000').fill('5')
  await page.getByLabel('Cuántos de $5.000').fill('4')
  await expect(page.getByRole('dialog')).toContainText('$120.000')
  await page.getByRole('button', { name: 'Registrar conteo' }).click()

  // Revisión antes de cerrar: avisa que falta el trabajador y muestra el neto.
  await page.getByRole('button', { name: 'Cerrar el día' }).last().click()
  const revision = page.getByRole('dialog')
  await expect(revision).toContainText('Revisar antes de cerrar')
  await expect(revision).toContainText('No elegiste quién atendió')
  await revision.getByRole('button', { name: 'Cerrar el día' }).click()

  await expect(page).toHaveURL(/\/hoy/)

  // La planilla del día muestra lo cerrado.
  await page.goto(`/dia?fecha=${FECHA}`)
  await expect(page.getByText('$120.000').first()).toBeVisible()
})

test('salir lleva al login y ya no deja volver sin sesión', async ({ page }) => {
  await entrar(page)
  await page.goto('/ajustes')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByRole('button', { name: 'Sí, cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/hoy')
  await expect(page).toHaveURL(/\/login/)
})
