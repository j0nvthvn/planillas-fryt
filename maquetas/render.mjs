/**
 * El tubo de maquetas: renderiza las pantallas reales de la app a PNG.
 *
 *   pnpm maquetas
 *
 * Construye la app con `--mode maquetas` (un Supabase que no existe), la
 * sirve con `vite preview`, y para cada pantalla y cada tema levanta un
 * navegador con el reloj congelado que contesta cada consulta desde
 * `datos.mjs`. Sale un PNG por pantalla y tema en `maquetas/salida/`, más
 * `maquetas.json` con el commit y la huella de cada uno: eso es lo que la
 * landing guarda como `procedencia.json` para saber si alguna quedó vieja.
 *
 * Los PNG se consumen en otros repos:
 *   landings   → pnpm -F @landings/frytcontrol maquetas:traer
 *   portafolio → src/capturas/frytcontrol/
 */
import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { construirDatos, resumenPeriodo, INSTANTE, USUARIO } from './datos.mjs'
import { consultar } from './postgrest.mjs'
import { PANTALLAS, FORMAS, TEMAS } from './pantallas.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const SALIDA = join(AQUI, 'salida')
const PUERTO = 4177
const BASE = `http://localhost:${PUERTO}`
/** Tiene que coincidir con VITE_SUPABASE_URL de .env.maquetas. */
const SUPABASE = 'https://maquetas.supabase.co'
const CLAVE_SESION = 'sb-maquetas-auth-token'

const datos = construirDatos()
const problemas = []

/* ───────── la app ───────── */

function construir() {
  console.log('· construyendo la app (modo maquetas)…')
  execFileSync(join(RAIZ, 'node_modules/.bin/vite'), ['build', '--mode', 'maquetas'], { cwd: RAIZ, stdio: 'inherit' })
}

async function servir() {
  const proceso = spawn(join(RAIZ, 'node_modules/.bin/vite'), ['preview', '--mode', 'maquetas', '--port', String(PUERTO), '--strictPort'], { cwd: RAIZ, stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return proceso
    } catch { /* todavía no levanta */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  proceso.kill()
  throw new Error(`vite preview no respondió en ${BASE}`)
}

/* ───────── el navegador ───────── */

const SESION = {
  access_token: 'maqueta.sin.valor',
  refresh_token: 'maqueta',
  token_type: 'bearer',
  expires_in: 3600,
  // Lejos del reloj congelado: así nadie intenta refrescar el token.
  expires_at: Math.floor(new Date('2026-12-31T12:00:00-03:00').getTime() / 1000),
  user: {
    id: USUARIO.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: USUARIO.email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: USUARIO.creado_en,
  },
}

const json = (cuerpo, status = 200) => ({
  status,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: JSON.stringify(cuerpo),
})

async function interceptar(contexto) {
  await contexto.route(`${SUPABASE}/**`, async (ruta) => {
    const pedido = ruta.request()
    const url = new URL(pedido.url())
    const cabeceras = pedido.headers()

    if (pedido.method() === 'OPTIONS') return ruta.fulfill(json({}))

    // Auth: la sesión ya está en localStorage; esto solo cubre lo que la
    // biblioteca pregunte de más.
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return ruta.fulfill(json(SESION.user))
      if (url.pathname.endsWith('/logout')) return ruta.fulfill(json({}, 204))
      return ruta.fulfill(json(SESION))
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const nombre = url.pathname.slice('/rest/v1/rpc/'.length)
      const cuerpo = pedido.postDataJSON() ?? {}
      if (nombre === 'resumen_periodo') return ruta.fulfill(json(resumenPeriodo(datos, cuerpo.p_desde, cuerpo.p_hasta)))
      problemas.push(`rpc sin datos de ejemplo: ${nombre}`)
      return ruta.fulfill(json({ message: `rpc ${nombre} sin maqueta` }, 500))
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      // Las maquetas son de solo lectura: nada debería escribir.
      if (pedido.method() !== 'GET') {
        problemas.push(`escritura inesperada: ${pedido.method()} ${url.pathname}`)
        return ruta.fulfill(json({ message: 'las maquetas no escriben' }, 500))
      }
      const recurso = url.pathname.slice('/rest/v1/'.length)
      try {
        const { status, cuerpo } = consultar(recurso, url.searchParams, cabeceras, datos)
        return ruta.fulfill(json(cuerpo, status))
      } catch (e) {
        problemas.push(`${recurso}: ${e.message}`)
        return ruta.fulfill(json({ message: e.message }, 500))
      }
    }

    problemas.push(`llamada inesperada a Supabase: ${url.pathname}`)
    return ruta.fulfill(json({ message: 'sin maqueta' }, 500))
  })
}

async function abrir(navegador, forma, tema) {
  const contexto = await navegador.newContext({
    ...FORMAS[forma],
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
    reducedMotion: 'reduce',
    // El service worker de la PWA se saltaría la interceptación y cachearía
    // entre corridas: para las maquetas no aporta nada.
    serviceWorkers: 'block',
  })
  await contexto.addInitScript(
    ([clave, sesion, temaGuardado]) => {
      localStorage.setItem(clave, JSON.stringify(sesion))
      localStorage.setItem('tema', temaGuardado)
    },
    [CLAVE_SESION, SESION, tema],
  )
  await interceptar(contexto)
  return contexto
}

/* ───────── las capturas ───────── */

async function capturar(navegador, pantalla, tema) {
  const contexto = await abrir(navegador, pantalla.forma, tema)
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => problemas.push(`${pantalla.id}/${tema}: ${e.message}`))
  await pagina.clock.install({ time: new Date(INSTANTE) })

  await pagina.goto(`${BASE}${pantalla.ruta}`, { waitUntil: 'domcontentloaded' })
  await pantalla.listo(pagina)
  await pagina.evaluate(() => document.fonts.ready)
  // El scroll vive en <main>, no en el documento: la app ocupa la ventana.
  if (pantalla.desplazar) {
    await pagina.evaluate((y) => { document.querySelector('main').scrollTop = y }, pantalla.desplazar)
    await pagina.waitForTimeout(200)
  }
  // El reloj congelado también congela los timers y los rAF: el reposo se
  // pide a mano, y de una vez más largo que la animación más lenta (las
  // barras de Análisis, 1,5 s). Adelantar en tiempo falso, y no esperar en
  // tiempo real, es lo que hace que dos corridas den los mismos bytes.
  await pagina.clock.runFor(4000)

  const archivo = `${pantalla.id}-${pantalla.forma}-${tema}.png`
  await pagina.screenshot({ path: join(SALIDA, archivo), type: 'png', scale: 'device', animations: 'disabled', caret: 'hide' })
  await contexto.close()
  console.log(`  ${archivo}`)
  return archivo
}

async function capturarOg(navegador) {
  const plantilla = await readFile(join(AQUI, 'og.html'), 'utf8')
  const enBase64 = async (ruta, tipo) => `data:${tipo};base64,${(await readFile(ruta)).toString('base64')}`
  const html = plantilla
    .replace('__FUENTE__', await enBase64(join(RAIZ, 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'), 'font/woff2'))
    .replace('__LOGO__', await enBase64(join(RAIZ, 'public/logo.jpg'), 'image/jpeg'))
    .replace('__MAQUETA__', await enBase64(join(SALIDA, 'hoy-celular-claro.png'), 'image/png'))

  const contexto = await navegador.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const pagina = await contexto.newPage()
  await pagina.setContent(html, { waitUntil: 'load' })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.screenshot({ path: join(SALIDA, 'og.png'), type: 'png', scale: 'device' })
  await contexto.close()
  console.log('  og.png')
  return 'og.png'
}

/* ───────── el manifiesto ───────── */

async function manifiesto(archivos) {
  const git = (args) => execFileSync('git', args, { cwd: RAIZ }).toString().trim()
  const paquete = JSON.parse(await readFile(join(RAIZ, 'package.json'), 'utf8'))
  const pantallas = []
  for (const archivo of archivos) {
    const bytes = await readFile(join(SALIDA, archivo))
    const [, id, forma, tema] = archivo.match(/^(.+)-(celular|escritorio)-(claro|oscuro)\.png$/) ?? []
    pantallas.push({
      archivo,
      ...(id ? { id, forma, tema } : {}),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  }
  return {
    generado_por: 'planillas-fryt/maquetas',
    // A propósito sin fecha de generación: si no, el manifiesto cambia en
    // cada corrida y deja de servir para comparar.
    commit: git(['rev-parse', 'HEAD']),
    // Un árbol sucio significa que estas maquetas no se pueden reconstruir
    // desde ese commit: queda escrito. Solo cuenta lo que las afecta — un
    // archivo de configuración local tocado no las vuelve irreproducibles.
    sucio: git(['status', '--porcelain', '--', 'src', 'public', 'maquetas', 'package.json', '.env.maquetas', 'vite.config.ts']).length > 0,
    app: paquete.version ?? null,
    instante: INSTANTE,
    pantallas,
  }
}

/* ───────── correr ───────── */

construir()
await rm(SALIDA, { recursive: true, force: true })
await mkdir(SALIDA, { recursive: true })

const preview = await servir()
const navegador = await chromium.launch()
const archivos = []
try {
  for (const tema of TEMAS) {
    for (const pantalla of PANTALLAS) archivos.push(await capturar(navegador, pantalla, tema))
  }
  archivos.push(await capturarOg(navegador))
} finally {
  await navegador.close()
  preview.kill()
}

// Un fixture que nadie pidió es una pantalla que dejó de consultarlo: o la
// maqueta está mostrando un estado vacío, o sobra un dato de ejemplo.
if (problemas.length) {
  console.error('\n✗ la corrida tuvo problemas:')
  for (const p of [...new Set(problemas)]) console.error(`  · ${p}`)
  process.exit(1)
}

await writeFile(join(SALIDA, 'maquetas.json'), JSON.stringify(await manifiesto(archivos), null, 2) + '\n')
console.log(`\n✓ ${archivos.length} imágenes en maquetas/salida/`)
console.log('  landings:   node guiones/traer-maquetas.mjs frytcontrol ../planillas-fryt')
