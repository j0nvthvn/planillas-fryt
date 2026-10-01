import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Los días en que el local no abrió: marcar, verlo por todas partes y
 * quitar la marca. Contra staging, con una fecha de 2028 que se borra al
 * final (misma convención que cierre.spec.ts).
 */
const URL = process.env.VITE_SUPABASE_URL ?? ''
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const EMAIL = process.env.SMOKE_EMAIL ?? 'duena@test.local'
const PASSWORD = process.env.STAGING_PASSWORD ?? process.env.SMOKE_PASSWORD ?? ''
// Pasada, porque un día futuro no se puede marcar, y lejos de los datos
// reales de staging (la app empezó a usarse en 2026).
const FECHA = `2019-0${1 + Math.floor(Math.random() * 9)}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`

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

test('marcar un día sin abrir, verlo en la planilla y quitar la marca', async ({ page }) => {
  await entrar(page)

  // 1. Un día en blanco ofrece las dos salidas: registrar o decir que no abrió.
  await page.goto(`/dia?fecha=${FECHA}`)
  await expect(page.getByText('Sin registro este día')).toBeVisible()
  await page.getByRole('button', { name: 'El local no abrió' }).click()

  // 2. La hoja, con el motivo opcional.
  await expect(page.getByRole('heading', { name: '¿El local no abrió?' })).toBeVisible()
  await page.getByRole('radio', { name: 'Feriado' }).click()
  await page.getByRole('button', { name: 'Marcar el día' }).click()

  // 3. La planilla lo dice, con su motivo y el chip.
  await expect(page.getByRole('button', { name: 'Quitar marca' })).toBeVisible()
  await expect(page.getByText('Feriado', { exact: true })).toBeVisible()
  await expect(page.getByText('No abrió', { exact: true })).toBeVisible()

  // 4. Cerrar turno avisa antes de que la dueña llene la planilla entera.
  await page.goto(`/turno?fecha=${FECHA}&modo=completo`)
  await expect(page.getByText('Este día está marcado como')).toBeVisible()
  await page.getByRole('button', { name: 'Quitar la marca y registrar' }).click()
  await expect(page.getByText('Este día está marcado como')).toBeHidden()

  // 5. Sin la marca, el día vuelve a estar en blanco.
  await page.goto(`/dia?fecha=${FECHA}`)
  await expect(page.getByText('Sin registro este día')).toBeVisible()
})

test('el filtro "No abrió" del Historial lista los días marcados', async ({ page }) => {
  await entrar(page)
  await page.goto(`/dia?fecha=${FECHA}`)
  await page.getByRole('button', { name: 'El local no abrió' }).click()
  await page.getByRole('button', { name: 'Marcar el día' }).click()
  await expect(page.getByRole('button', { name: 'Quitar marca' })).toBeVisible()

  await page.goto('/historial?filtro=sin_abrir')
  const fila = page.getByRole('link', { name: /No abrió/ }).first()
  await expect(fila).toBeVisible()
})
