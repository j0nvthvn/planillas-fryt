// Genera los correos con datos reales para revisarlos en el navegador.
//   node scripts/correos/vista-previa.ts <datos.json> <carpeta>
// datos.json sale de scripts/correos/datos-vista-previa.sql.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { correoCierre, type Metodo } from '../../supabase/functions/_shared/correo/cierre.ts'
import { correoPeriodo, type DatosPeriodo } from '../../supabase/functions/_shared/correo/periodo.ts'
import type { TipoResumen } from '../../supabase/functions/_shared/correo/periodos.ts'

const [entrada, salida] = process.argv.slice(2)
if (!entrada || !salida) throw new Error('uso: vista-previa.ts <datos.json> <carpeta>')
const datos = JSON.parse(readFileSync(entrada, 'utf8'))
mkdirSync(salida, { recursive: true })

const metodos: Metodo[] = datos.metodos.filter((m: { activo: boolean }) => m.activo)
const catalogo: Record<string, string> = datos.catalogo ?? {}
const c = datos.cierre

const hora = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(c.cerrado_en))
const correos = {
  cierre: correoCierre({
    fecha: c.fecha,
    etiqueta: c.es_turno_unico ? 'Día completo' : `Turno ${c.tipo}`,
    hora,
    metodos,
    ventas: c.ventas_snapshot ?? {},
    proveedores: (c.proveedores_snapshot ?? []).map((p: { nombre: string }) => ({ ...p, imagen_url: catalogo[p.nombre.toLowerCase()] ?? null })),
    atendio: c.atendio ?? 'Angélica',
    cerradoPor: null,
    fondo: Number(c.fondo_inicial) || 0,
    esperado: Number(c.efectivo_esperado) || 0,
    contado: c.efectivo_contado,
    diferencia: c.diferencia_efectivo,
  }),
  ...Object.fromEntries((['diario', 'semanal', 'mensual'] as TipoResumen[]).map((tipo) => {
    const r = datos[tipo]
    const ant = datos[`${tipo}_ant`]
    const d: DatosPeriodo = {
      tipo, desde: r.desde, hasta: r.hasta,
      totales: r.totales,
      anterior: ant.totales.dias_con_registro ? ant.totales : null,
      dias: r.dias, top: r.top_proveedores, metodos,
    }
    return [tipo, correoPeriodo(d)]
  })),
}

for (const [nombre, correo] of Object.entries(correos)) {
  writeFileSync(join(salida, `${nombre}.html`), correo.html)
  writeFileSync(join(salida, `${nombre}.txt`), `Asunto: ${correo.asunto}\n\n${correo.texto}`)
  console.log(`${nombre}: ${correo.asunto}`)
}
