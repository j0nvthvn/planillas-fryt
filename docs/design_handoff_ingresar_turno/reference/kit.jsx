/* kit.jsx — sistema visual + componentes compartidos
   Exporta a window: T, fmt, clp, parseNum, FRECUENTES, VENTAS_DEF, HOY,
   Keypad, AmountField, PayToggle, FreqChips, Seg, Icon, Success, TotalsBar */

const { useState, useRef, useEffect } = React;

/* ── Tokens ─────────────────────────────────────────────
   Cada token apunta a una variable CSS con fallback al valor
   original, así el panel de Tweaks puede re-temar todo en vivo
   y los archivos sin variables siguen viéndose igual.        */
const T = {
  bg: 'var(--bg, #F1F1EC)',
  surface: 'var(--surface, #FFFFFF)',
  surfaceAlt: 'var(--surface-alt, #FAFAF7)',
  ink: 'var(--ink, #191B1F)',
  inkSoft: 'var(--ink-soft, #4A4D54)',
  muted: 'var(--muted, #8C8E88)',
  faint: 'var(--faint, #B7B9B2)',
  line: 'var(--line, rgba(22,24,28,0.09))',
  lineSoft: 'var(--line-soft, rgba(22,24,28,0.05))',
  green: 'var(--accent, #1E7A4F)', // acción / efectivo
  greenTint: 'var(--accent-tint, #E6F1EA)',
  navy: 'var(--navy, #33518C)', // transferencia
  navyTint: 'var(--navy-tint, #E8EDF6)',
  amber: 'var(--amber, #B07B1E)',
  amberTint: 'var(--amber-tint, #F6EEDC)',
  terra: 'var(--terra, #BC4A30)', // descuadre / borrar
  terraTint: 'var(--terra-tint, #F7E7E1)',
  seg: 'var(--seg, #ECECE6)', // fondo segmented / botones neutros
  handle: 'var(--handle, #D6D7D0)', // tirador hoja / deshabilitado
  dash: 'var(--dash, rgba(22,24,28,0.18))', // borde punteado vacío
  ui: "var(--ui-font, 'Schibsted Grotesk', -apple-system, system-ui, sans-serif)"
};

/* ── Helpers ────────────────────────────────────────── */
function fmt(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('es-CL');
}
function clp(n) {return '$' + fmt(n);}
function parseNum(s) {
  if (typeof s === 'number') return s;
  return Number(String(s ?? '').replace(/\D/g, '')) || 0;
}
const HOY = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

/* ── Datos mock ─────────────────────────────────────── */
const FRECUENTES = ['Coca-Cola', 'CCU', 'Soprole', 'Carozzi', 'Watt\u2019s', 'Nestlé', 'PF', 'Ideal', 'Lucchetti', 'Agrosuper', 'Bilz y Pap', 'Colún'];
const VENTAS_DEF = [
{ key: 'efectivo', label: 'Efectivo', sub: 'Caja' },
{ key: 'getnet', label: 'Getnet', sub: 'Débito / Crédito' },
{ key: 'mercadopago', label: 'Mercado Pago', sub: 'Débito / Crédito' },
{ key: 'edenred', label: 'Edenred', sub: 'Amipass / Sodexo' },
{ key: 'transferencia', label: 'Transferencia', sub: 'Banco' }];


/* ── Iconos (sobrios, stroke) ───────────────────────── */
function Icon({ name, size = 22, color = T.ink, sw = 1.7, style }) {
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    plus: <g {...p}><path d="M12 5v14M5 12h14" /></g>,
    check: <g {...p}><path d="M4 12.5l5 5L20 6.5" /></g>,
    checkCircle: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></g>,
    back: <g {...p}><path d="M15 5l-7 7 7 7" /></g>,
    close: <g {...p}><path d="M6 6l12 12M18 6L6 18" /></g>,
    trash: <g {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></g>,
    edit: <g {...p}><path d="M5 19h4l9-9-4-4-9 9v4zM13 6l4 4" /></g>,
    sun: <g {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5" /></g>,
    moon: <g {...p}><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" /></g>,
    cash: <g {...p}><rect x="3" y="7" width="18" height="10" rx="2" /><circle cx="12" cy="12" r="2.3" /></g>,
    bank: <g {...p}><path d="M4 10l8-5 8 5M5 10v7M19 10v7M9 10v7M15 10v7M3 19h18" /></g>,
    chevR: <g {...p}><path d="M9 5l7 7-7 7" /></g>,
    arrow: <g {...p}><path d="M5 12h14M13 6l6 6-6 6" /></g>,
    user: <g {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0113 0" /></g>,
    store: <g {...p}><path d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16" /></g>,
    list: <g {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></g>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={style}>{paths[name]}</svg>;
}

/* ── Segmented control ──────────────────────────────── */
function Seg({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: T.seg, borderRadius: 13, ...style }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 10,
            padding: '9px 6px', fontFamily: T.ui, fontSize: 14.5, fontWeight: on ? 600 : 500,
            background: on ? T.surface : 'transparent', color: on ? T.ink : T.muted,
            boxShadow: on ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .15s'
          }}>{o.icon}{o.label}</button>);

      })}
    </div>);

}

/* ── Toggle efectivo / transferencia ────────────────── */
function PayToggle({ value, onChange, size = 'md' }) {
  const opts = [
  { v: 'efectivo', label: 'Efectivo', icon: 'cash', c: T.green, tint: T.greenTint },
  { v: 'transferencia', label: 'Transferencia', icon: 'bank', c: T.navy, tint: T.navyTint }];

  const pad = size === 'sm' ? '8px 8px' : '11px 10px';
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            flex: 1, cursor: 'pointer', borderRadius: 12, padding: pad,
            border: `1.5px solid ${on ? o.c : T.line}`,
            background: on ? o.tint : T.surface, color: on ? o.c : T.muted,
            fontFamily: T.ui, fontWeight: on ? 600 : 500, fontSize: size === 'sm' ? 13 : 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'all .15s'
          }}>
            <Icon name={o.icon} size={size === 'sm' ? 16 : 18} color={on ? o.c : T.faint} sw={1.8} />
            {o.label}
          </button>);

      })}
    </div>);

}

/* ── Chips de proveedores frecuentes ────────────────── */
function FreqChips({ onPick, used = [], wrap = true, query = '' }) {
  const q = query.trim().toLowerCase();
  const list = q ? FRECUENTES.filter((n) => n.toLowerCase().includes(q)) : FRECUENTES;
  if (list.length === 0) return null;
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: wrap ? 'wrap' : 'nowrap',
      overflowX: wrap ? 'visible' : 'auto', paddingBottom: wrap ? 0 : 4
    }}>
      {list.map((n) => {
        const u = used.includes(n);
        return (
          <button key={n} onClick={() => onPick(n)} style={{
            flexShrink: 0, cursor: 'pointer', borderRadius: 999,
            padding: '8px 14px', fontFamily: T.ui, fontSize: 13.5, fontWeight: 500,
            border: `1px solid ${u ? T.green : T.line}`,
            background: u ? T.greenTint : T.surface, color: u ? T.green : T.inkSoft,
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
          }}>
            {u && <Icon name="check" size={13} color={T.green} sw={2.4} />}
            {n}
          </button>);

      })}
    </div>);

}

/* ── Display de monto grande ────────────────────────── */
function AmountField({ value, label, active, onClick, accent = T.ink }) {
  const empty = !value || value === '0';
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
      background: 'transparent', border: 'none', padding: 0
    }}>
      {label && <div style={{ fontFamily: T.ui, fontSize: 13, fontWeight: 500, color: T.muted, marginBottom: 2 }}>{label}</div>}
      <div style={{
        fontFamily: T.ui, fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em',
        color: empty ? T.faint : accent, fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'baseline', gap: 2
      }}>
        <span style={{ fontSize: 26, fontWeight: 500, color: empty ? T.faint : T.muted }}>$</span>
        {fmt(value)}
        {active && <span style={{
          width: 2, height: 34, background: accent, marginLeft: 3, borderRadius: 2,
          animation: 'blink 1.1s steps(1) infinite'
        }} />}
      </div>
    </button>);

}

/* ── Keypad tipo calculadora ────────────────────────── */
function Keypad({ onKey, onAccept, acceptLabel = 'Listo', acceptDisabled, accent = T.green, compact }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '000', '0', 'del'];
  const h = compact ? 50 : 58;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {keys.map((k) =>
        <button key={k} onClick={() => onKey(k)} style={{
          height: h, borderRadius: 14, cursor: 'pointer',
          border: '1px solid ' + T.lineSoft, background: T.surface,
          fontFamily: T.ui, fontSize: k === 'del' ? 20 : 24, fontWeight: 500, color: T.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 0 rgba(0,0,0,0.03)'
        }}>
            {k === 'del' ?
          <svg width="26" height="20" viewBox="0 0 26 20" fill="none"><path d="M9 2h13a2 2 0 012 2v12a2 2 0 01-2 2H9l-7-8 7-8z" stroke={T.inkSoft} strokeWidth="1.6" strokeLinejoin="round" /><path d="M12 7l6 6M18 7l-6 6" stroke={T.inkSoft} strokeWidth="1.7" strokeLinecap="round" /></svg> :
          k}
          </button>
        )}
      </div>
      {onAccept &&
      <button onClick={onAccept} disabled={acceptDisabled} style={{
        height: h, borderRadius: 14, border: 'none',
        cursor: acceptDisabled ? 'default' : 'pointer',
        background: acceptDisabled ? T.handle : accent, color: '#fff',
        fontFamily: T.ui, fontSize: 17, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
          <Icon name="check" size={20} color="#fff" sw={2.4} />{acceptLabel}
        </button>
      }
    </div>);

}

/* Aplica una tecla del keypad a un string numérico */
function applyKey(cur, k) {
  let v = String(cur || '');
  if (k === 'del') return v.slice(0, -1);
  if (k === '000') v = v === '' ? '' : v + '000';else
  v = v === '' || v === '0' ? k : v + k;
  return v.replace(/^0+(?=\d)/, '').slice(0, 9);
}

/* ── Barra de total pegada abajo ────────────────────── */
function TotalsBar({ label, value, accent = T.ink, children }) {
  return (
    <div style={{
      borderTop: '1px solid ' + T.line, background: T.surface,
      padding: '13px 18px 30px', display: 'flex', alignItems: 'center', gap: 14
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 500, color: T.muted }}>{label}</div>
        <div style={{ fontFamily: T.ui, fontSize: 26, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{clp(value)}</div>
      </div>
      {children}
    </div>);

}

/* ── Pantalla de éxito ──────────────────────────────── */
function Success({ data, onReset }) {
  const desc = data.cuadre;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '70px 20px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: T.greenTint, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Icon name="check" size={32} color={T.green} sw={2.6} />
          </div>
          <div style={{ fontFamily: T.ui, fontSize: 23, fontWeight: 700, color: T.ink }}>Turno guardado</div>
          <div style={{ fontFamily: T.ui, fontSize: 14, color: T.muted, marginTop: 3, textTransform: 'capitalize' }}>{data.tipo} · {HOY}</div>
        </div>
        <div style={{ background: T.surface, borderRadius: 20, padding: 18, border: '1px solid ' + T.line }}>
          {[
          ['Ventas del turno', clp(data.totalVentas), T.ink],
          ['Efectivo a proveedores', clp(data.efProv), T.green],
          ['Transferencia a proveedores', clp(data.trProv), T.navy]].
          map(([l, v, c], i) =>
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: i < 2 ? '1px solid ' + T.lineSoft : 'none' }}>
              <span style={{ fontFamily: T.ui, fontSize: 14.5, color: T.inkSoft }}>{l}</span>
              <span style={{ fontFamily: T.ui, fontSize: 16, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          )}
        </div>
        {desc !== undefined &&
        <div style={{
          marginTop: 12, borderRadius: 16, padding: '13px 16px',
          background: Math.abs(desc) < 1 ? T.greenTint : T.terraTint,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
            <Icon name={Math.abs(desc) < 1 ? 'checkCircle' : 'close'} size={20} color={Math.abs(desc) < 1 ? T.green : T.terra} />
            <div style={{ fontFamily: T.ui, fontSize: 13.5, fontWeight: 500, color: Math.abs(desc) < 1 ? T.green : T.terra }}>
              {Math.abs(desc) < 1 ? 'Caja cuadrada' : `Descuadre de ${clp(Math.abs(desc))}`}
            </div>
          </div>
        }
        {data.provs?.length > 0 &&
        <div style={{ marginTop: 18 }}>
            <div style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, paddingLeft: 2 }}>{data.provs.length} proveedores</div>
            <div style={{ background: T.surface, borderRadius: 16, border: '1px solid ' + T.line, overflow: 'hidden' }}>
              {data.provs.map((p, i) =>
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < data.provs.length - 1 ? '1px solid ' + T.lineSoft : 'none' }}>
                  <span style={{ fontFamily: T.ui, fontSize: 14.5, color: T.ink }}>{p.nombre}</span>
                  <span style={{ fontFamily: T.ui, fontSize: 14, fontWeight: 600, color: p.forma_pago === 'efectivo' ? T.green : T.navy, fontVariantNumeric: 'tabular-nums' }}>{clp(p.monto)}</span>
                </div>
            )}
            </div>
          </div>
        }
      </div>
      <div style={{ padding: '12px 18px 30px', borderTop: '1px solid ' + T.line, background: T.surface }}>
        <button onClick={onReset} style={{
          width: '100%', height: 52, borderRadius: 15, border: '1px solid ' + T.line,
          background: T.surface, cursor: 'pointer', fontFamily: T.ui, fontSize: 16, fontWeight: 600, color: T.ink
        }}>Ingresar otro turno</button>
      </div>
    </div>);

}

Object.assign(window, {
  T, fmt, clp, parseNum, HOY, FRECUENTES, VENTAS_DEF,
  Icon, Seg, PayToggle, FreqChips, AmountField, Keypad, applyKey, TotalsBar, Success
});