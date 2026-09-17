// Piezas HTML de los correos con la piel Fintech de la v2 (tema claro).
// Todo con tablas y estilos en línea: Gmail y Outlook ignoran casi todo
// el CSS de <style>, que acá solo se usa para el celular.

import { escapeHtml } from './formato.ts'

export const APP_URL = 'https://app.frytspa.cl'

export const T = {
  brand: '#4F46E5',
  brandTint: '#EEF0FE',
  canvas: '#F6F7F9',
  card: '#FFFFFF',
  hairline: '#EBEDF1',
  soft: '#F1F3F6',
  ink: '#0F1115',
  ink2: '#3C424E',
  muted: '#626B7F',
  pos: '#047857',
  posTint: '#E7F4EF',
  neg: '#C81E1E',
  negTint: '#FDECEC',
  warn: '#B45309',
  warnTint: '#FDF2E3',
  font: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: "'Inter Tight', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const

const NUM = 'font-variant-numeric:tabular-nums;'

export type Tono = 'pos' | 'neg' | 'warn' | 'brand' | 'neutro'
const TONOS: Record<Tono, [string, string]> = {
  pos: [T.pos, T.posTint],
  neg: [T.neg, T.negTint],
  warn: [T.warn, T.warnTint],
  brand: [T.brand, T.brandTint],
  neutro: [T.ink2, T.soft],
}

export function pildora(texto: string, tono: Tono): string {
  const [fg, bg] = TONOS[tono]
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:600;line-height:16px;white-space:nowrap;${NUM}">${escapeHtml(texto)}</span>`
}

export function eyebrow(texto: string): string {
  return `<p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};">${escapeHtml(texto)}</p>`
}

/** Tarjeta blanca con borde fino; `sinPadding` para listas que llegan al borde. */
export function tarjeta(contenido: string, { sinPadding = false } = {}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${T.card};border:1px solid ${T.hairline};border-radius:16px;margin:0 0 12px;">
<tr><td class="${sinPadding ? '' : 'pad'}" style="padding:${sinPadding ? '6px 0' : '20px 22px'};">${contenido}</td></tr></table>`
}

export function seccion(titulo: string, contenido: string, opciones: { sinPadding?: boolean } = {}): string {
  const cab = opciones.sinPadding ? `<div class="pad" style="padding:14px 22px 4px;">${eyebrow(titulo)}</div>` : eyebrow(titulo)
  return tarjeta(cab + contenido, opciones)
}

export type Kpi = { etiqueta: string; valor: string; nota?: string; color?: string }

/** Fila de 2–3 cifras. En el celular se apilan (clase `kpi`). */
export function filaKpis(kpis: Kpi[]): string {
  const ancho = Math.floor(100 / kpis.length)
  const celdas = kpis.map((k, i) => `<td class="kpi" width="${ancho}%" valign="top" style="padding:12px 0 0 ${i ? '14px' : '0'};border-top:1px solid ${T.hairline};">
<p style="margin:0;font-size:12px;color:${T.muted};">${escapeHtml(k.etiqueta)}</p>
<p style="margin:3px 0 0;font-family:${T.display};font-size:18px;font-weight:600;letter-spacing:-.01em;color:${k.color ?? T.ink};${NUM}white-space:nowrap;">${escapeHtml(k.valor)}</p>
${k.nota ? `<p style="margin:2px 0 0;font-size:12px;color:${T.muted};${NUM}">${escapeHtml(k.nota)}</p>` : ''}
</td>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>${celdas}</tr></table>`
}

/** Cifra principal de la tarjeta de arriba. */
export function heroe({ etiqueta, valor, color = T.ink, detalle = '' }: { etiqueta: string; valor: string; color?: string; detalle?: string }): string {
  return `<p style="margin:0;font-size:13px;font-weight:500;color:${T.muted};">${escapeHtml(etiqueta)}</p>
<p style="margin:2px 0 0;font-family:${T.display};font-size:36px;line-height:42px;font-weight:700;letter-spacing:-.025em;color:${color};${NUM}">${escapeHtml(valor)}</p>
${detalle ? `<p style="margin:8px 0 0;">${detalle}</p>` : ''}`
}

/** Fila de lista: ícono opcional, título/subtítulo y monto a la derecha. */
export function fila({ icono = '', titulo, sub = '', monto, montoColor = T.ink, extra = '', debajo = '', ultima = false }: {
  icono?: string; titulo: string; sub?: string; monto: string; montoColor?: string
  /** HTML junto al título (píldoras). */
  extra?: string
  /** HTML bajo el subtítulo (barra de proporción). */
  debajo?: string
  ultima?: boolean
}): string {
  const borde = ultima ? '' : `border-bottom:1px solid ${T.hairline};`
  return `<tr>
${icono ? `<td width="40" valign="middle" class="pl" style="padding:10px 0 10px 22px;${borde}">${icono}</td>` : ''}
<td valign="middle" class="${icono ? '' : 'pl'}" style="padding:10px 8px 10px ${icono ? '10px' : '22px'};${borde}">
<p style="margin:0;font-size:15px;font-weight:500;color:${T.ink};">${escapeHtml(titulo)}${extra ? ` ${extra}` : ''}</p>
${sub ? `<p style="margin:2px 0 0;font-size:12px;color:${T.muted};${NUM}">${escapeHtml(sub)}</p>` : ''}${debajo}
</td>
<td valign="middle" align="right" class="pr" style="padding:10px 22px 10px 8px;${borde}font-family:${T.display};font-size:15px;font-weight:600;color:${montoColor};${NUM}white-space:nowrap;">${escapeHtml(monto)}</td>
</tr>`
}

export function lista(filas: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.join('')}</table>`
}

/** Logo de un método o proveedor (imagen) o una inicial sobre su color. */
export function icono({ src, texto, color = T.soft }: { src?: string | null; texto: string; color?: string }): string {
  if (src) {
    const url = src.startsWith('http') ? src : `${APP_URL}${src}`
    return `<img src="${escapeHtml(url)}" width="30" height="30" alt="" style="display:block;width:30px;height:30px;border-radius:8px;border:1px solid ${T.hairline};object-fit:contain;background:#fff;">`
  }
  const inicial = escapeHtml(texto.trim().charAt(0).toLocaleUpperCase('es-CL') || '?')
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" valign="middle" style="width:30px;height:30px;border-radius:8px;background:${color};color:#fff;font-size:13px;font-weight:700;">${inicial}</td></tr></table>`
}

/** Barra de proporción (0–100) bajo un título de fila. */
export function barra(pct: number, color: string): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  if (p === 0) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
<td width="${p}%" height="4" style="height:4px;line-height:4px;font-size:0;background:${color};border-radius:2px;">&nbsp;</td>
${p < 100 ? `<td height="4" style="height:4px;line-height:4px;font-size:0;background:${T.soft};">&nbsp;</td>` : ''}
</tr></table>`
}

export function aviso(html: string, tono: Tono = 'warn'): string {
  const [fg, bg] = TONOS[tono]
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr>
<td class="pad" style="padding:12px 16px;background:${bg};border-radius:12px;color:${fg};font-size:14px;line-height:20px;">${html}</td></tr></table>`
}

export function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;"><tr>
<td align="center" bgcolor="${T.brand}" style="border-radius:12px;">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(texto)}</a>
</td></tr></table>`
}

export type Documento = {
  asunto: string
  /** Texto de vista previa en la bandeja (oculto en el cuerpo). */
  preencabezado: string
  /** Etiqueta chica arriba a la derecha: "Cierre", "Resumen semanal"… */
  tipo: string
  cuerpo: string
}

export function documento({ asunto, preencabezado, tipo, cuerpo }: Documento): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(asunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; }
  a { color:${T.brand}; }
  @media (max-width: 480px) {
    .wrap { padding:12px 10px 28px !important; }
    .pad { padding-left:16px !important; padding-right:16px !important; }
    .pl { padding-left:16px !important; }
    .pr { padding-right:16px !important; }
    .kpi { display:block !important; width:100% !important; padding-left:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${T.canvas};font-family:${T.font};color:${T.ink};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preencabezado)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.canvas};">
<tr><td align="center" class="wrap" style="padding:24px 16px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" width="40"><img src="${APP_URL}/icon-192.png" width="32" height="32" alt="Fryt" style="display:block;width:32px;height:32px;border-radius:9px;"></td>
    <td valign="middle" style="padding-left:10px;font-size:15px;font-weight:700;color:${T.ink};letter-spacing:-.01em;">FrytControl</td>
    <td valign="middle" align="right" style="font-size:12px;font-weight:600;color:${T.muted};">${escapeHtml(tipo)}</td>
  </tr></table>
</td></tr>
<tr><td>${cuerpo}</td></tr>
<tr><td class="pad" style="padding:14px 6px 0;font-size:12px;line-height:18px;color:${T.muted};">
  Minimarket Fryt · enviado por FrytControl.<br>
  <a href="${APP_URL}/ajustes?seccion=correos" style="color:${T.muted};text-decoration:underline;">Elegir qué correos recibo</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
