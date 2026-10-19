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
const fechaAlAzar = () => `2028-0${1 + Math.floor(Math.random() * 9)}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`
const FECHA = fechaAlAzar()
let FECHA_LENTA = fechaAlAzar()
while (FECHA_LENTA === FECHA) FECHA_LENTA = fechaAlAzar()

test.skip(!PASSWORD, 'necesita STAGING_PASSWORD (v2/.env.staging.local)')

test.afterAll(async () => {
  if (!ANON || !URL || /kfmwhtbvgqurnpotypii|aecopggpahxjaglakqwd/.test(URL)) return
  const sb = createClient(URL, ANON)
  await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  await sb.from('jornadas').delete().in('fecha', [FECHA, FECHA_LENTA])
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

  // Conteo de caja por denominaciones: 6 de $20.000 + 3 de $5.000 = $135.000,
  // distinto de la venta en efectivo para que la planilla no lo confunda.
  await page.getByRole('radio', { name: 'Sí' }).click()
  await expect(page.getByRole('dialog')).toContainText('Conteo de caja')
  await page.getByLabel('Cuántos de $20.000').fill('6')
  await page.getByLabel('Cuántos de $5.000').fill('3')
  await expect(page.getByRole('dialog')).toContainText('$135.000')
  // El conteo dispara un autoguardado (1,5 s) y el refetch del día que lo
  // sigue; antes, ese refetch recargaba desde el servidor y borraba el conteo.
  // `proveedores_turno` es la última consulta de `cargarTurnosDia`.
  const guardado = page.waitForResponse((r) => r.url().includes('/rpc/guardar_turno') && r.ok())
  await page.getByRole('button', { name: 'Registrar conteo' }).click()
  await guardado
  await page.waitForResponse((r) => r.url().includes('/rest/v1/proveedores_turno') && r.request().method() === 'GET')
  await expect(page.getByText('Contado $135.000')).toBeVisible()

  // Revisión antes de cerrar: avisa que falta el trabajador y muestra el neto.
  await page.getByRole('button', { name: 'Cerrar el día' }).last().click()
  const revision = page.getByRole('dialog')
  await expect(revision).toContainText('Revisar antes de cerrar')
  await expect(revision).toContainText('No elegiste quién atendió')
  await revision.getByRole('button', { name: 'Cerrar el día' }).click()

  await expect(page).toHaveURL(/\/hoy/)

  // La planilla del día muestra lo cerrado, con el conteo registrado.
  await page.goto(`/dia?fecha=${FECHA}`)
  await expect(page.getByText('$120.000').first()).toBeVisible()
  await expect(page.getByText('$135.000').first()).toBeVisible()
  await expect(page.getByText('sin conteo')).toHaveCount(0)
})

// Antes, Cerrar salía con la misma versión base que el autoguardado en curso
// y la RPC, que cambia updated_at en cada guardado, respondía conflicto.
test('cerrar con la red lenta espera al autoguardado en curso, sin conflicto', async ({ page }) => {
  await entrar(page)
  await page.goto(`/turno?fecha=${FECHA_LENTA}&modo=completo`)
  await expect(page.getByRole('heading', { name: 'Cerrar el día' })).toBeVisible()

  // Primer guardado con la red normal: el borrador ya existe en el servidor.
  const primero = page.waitForResponse((r) => r.url().includes('/rpc/guardar_turno') && r.ok())
  await page.getByRole('button', { name: /^Efectivo/ }).click()
  await teclear(page, 50000)
  await page.getByRole('button', { name: /Guardar y volver/ }).click()
  await primero

  // Desde acá, cada guardado tarda 2,5 s.
  await page.route('**/rpc/guardar_turno', async (route) => {
    await new Promise((r) => setTimeout(r, 2500))
    await route.continue()
  })
  const enCurso = page.waitForRequest((r) => r.url().includes('/rpc/guardar_turno'))
  await page.getByRole('button', { name: /^Getnet/ }).click()
  await teclear(page, 30000)
  await page.getByRole('button', { name: /Guardar y volver/ }).click()
  await enCurso

  await page.getByRole('button', { name: 'Cerrar el día' }).last().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar el día' }).click()

  await expect(page).toHaveURL(/\/hoy/, { timeout: 15_000 })
  await expect(page.getByText('Este turno cambió en otro dispositivo')).toHaveCount(0)
  await page.goto(`/dia?fecha=${FECHA_LENTA}`)
  await expect(page.getByText('$80.000').first()).toBeVisible()
  await expect(page.getByText('Cerrado', { exact: true })).toBeVisible()
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
