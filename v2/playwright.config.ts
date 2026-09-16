import { defineConfig, devices } from '@playwright/test'
import { config as cargarEnv } from 'dotenv'

// La contraseña de staging vive en .env.staging.local (nunca se versiona).
cargarEnv({ path: '.env.staging.local', quiet: true })

/**
 * E2E contra STAGING, nunca contra producción: `pnpm dev --mode staging`
 * levanta la app apuntando a psdhhwcxjcobwxjiemrr y la prueba limpia lo que
 * crea. Se corre a mano: `pnpm e2e` (requiere STAGING_PASSWORD).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // El celular del local es lo que importa; el escritorio va de yapa.
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm dev --mode staging --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
