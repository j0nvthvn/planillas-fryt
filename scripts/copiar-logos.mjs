// Sube al bucket `logos-proveedores` de un proyecto Supabase todos los
// archivos de una carpeta local (descargados antes del bucket público de
// prod con curl). Se autentica con una cuenta dueña del proyecto destino:
// la política del bucket permite subir a cualquier autenticado.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... \
//   SMOKE_EMAIL=duena@test.local SMOKE_PASSWORD=... \
//   node scripts/copiar-logos.mjs <carpeta>
//
// Nunca contra producción (kfmwhtbvgqurnpotypii): sobreescribe objetos.
import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
const email = process.env.SMOKE_EMAIL
const password = process.env.SMOKE_PASSWORD
const dir = process.argv[2]

if (!url || !key || !email || !password || !dir) {
  console.error('Uso: SUPABASE_URL SUPABASE_ANON_KEY SMOKE_EMAIL SMOKE_PASSWORD node scripts/copiar-logos.mjs <carpeta>')
  process.exit(2)
}
if (/kfmwhtbvgqurnpotypii/.test(url)) {
  console.error('Este script sobreescribe objetos: no correrlo contra producción.')
  process.exit(2)
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { error: authErr } = await sb.auth.signInWithPassword({ email, password })
if (authErr) { console.error('login:', authErr.message); process.exit(1) }

let ok = 0, fail = 0
for (const name of (await readdir(dir)).sort()) {
  const body = await readFile(join(dir, name))
  const contentType = MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'
  const { error } = await sb.storage.from('logos-proveedores').upload(name, body, { contentType, upsert: true })
  if (error) { fail++; console.error('✘', name, error.message) } else { ok++; console.log('✔', name) }
}
console.log(`subidos=${ok} fallidos=${fail}`)
process.exit(fail ? 1 : 0)
