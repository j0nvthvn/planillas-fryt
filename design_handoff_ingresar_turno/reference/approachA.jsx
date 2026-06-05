/* approachA.jsx — Enfoque A: Lista limpia + hoja inferior (agregar de a uno) */

function ApproachA() {
  const [tipo, setTipo] = useState('mañana');
  const [provs, setProvs] = useState([]);
  const [ventas, setVentas] = useState({ efectivo: '', getnet: '', edenred: '', transferencia: '' });
  const [sheet, setSheet] = useState(null);
  const [done, setDone] = useState(null);

  const efProv = provs.filter(p => p.forma_pago === 'efectivo').reduce((s, p) => s + parseNum(p.monto), 0);
  const trProv = provs.filter(p => p.forma_pago === 'transferencia').reduce((s, p) => s + parseNum(p.monto), 0);
  const totalVentas = VENTAS_DEF.reduce((s, v) => s + parseNum(ventas[v.key]), 0);

  function openNew() { setSheet({ mode: 'prov', idx: -1, nombre: '', monto: '', forma_pago: 'efectivo' }); }
  function openEdit(i) { setSheet({ mode: 'prov', idx: i, ...provs[i] }); }
  function openVenta(key) { setSheet({ mode: 'venta', key, monto: ventas[key] || '' }); }

  function commitProv() {
    const row = { nombre: sheet.nombre.trim() || 'Proveedor', monto: parseNum(sheet.monto), forma_pago: sheet.forma_pago };
    if (sheet.idx === -1) setProvs(p => [...p, row]);
    else setProvs(p => p.map((x, i) => i === sheet.idx ? row : x));
    setSheet(null);
  }
  function commitVenta() {
    setVentas(v => ({ ...v, [sheet.key]: parseNum(sheet.monto) }));
    setSheet(null);
  }
  function delProv(i) { setProvs(p => p.filter((_, j) => j !== i)); setSheet(null); }

  function guardar() {
    setDone({ tipo, totalVentas, efProv, trProv, provs: [...provs] });
  }
  function reset() { setProvs([]); setVentas({ efectivo: '', getnet: '', edenred: '', transferencia: '' }); setDone(null); }

  if (done) return <Success data={done} onReset={reset} />;

  const usedNames = provs.map(p => p.nombre);

  return (
    <div style={{ position: 'relative', height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '56px 20px 14px 20px', background: T.surface, borderBottom: '1px solid ' + T.line }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <Icon name="store" size={15} color={T.muted} />
          <span style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 500, color: T.muted, textTransform: 'capitalize' }}>Fryt · {HOY}</span>
        </div>
        <div style={{ fontFamily: T.ui, fontSize: 25, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginBottom: 14 }}>Ingresar turno</div>
        <Seg options={[
          { value: 'mañana', label: 'Mañana', icon: <Icon name="sun" size={16} color={tipo === 'mañana' ? T.amber : T.muted} /> },
          { value: 'tarde', label: 'Tarde', icon: <Icon name="moon" size={15} color={tipo === 'tarde' ? T.navy : T.muted} /> },
        ]} value={tipo} onChange={setTipo} />
      </div>

      {/* Scroll */}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 16px 20px' }}>
        {/* Proveedores */}
        <SectionHead title="Proveedores" right={provs.length > 0 ? `${provs.length}` : null} />
        {provs.length === 0 ? (
          <button onClick={openNew} style={emptyBtn}>
            <Icon name="plus" size={20} color={T.muted} />
            <span>Agrega el primer proveedor</span>
          </button>
        ) : (
          <div style={{ background: T.surface, borderRadius: 16, border: '1px solid ' + T.line, overflow: 'hidden', marginBottom: 10 }}>
            {provs.map((p, i) => (
              <button key={i} onClick={() => openEdit(i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                background: 'transparent', border: 'none', borderBottom: i < provs.length - 1 ? '1px solid ' + T.lineSoft : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: p.forma_pago === 'efectivo' ? T.green : T.navy, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.ui, fontSize: 15, fontWeight: 500, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                  <div style={{ fontFamily: T.ui, fontSize: 12, color: T.muted, textTransform: 'capitalize' }}>{p.forma_pago}</div>
                </div>
                <div style={{ fontFamily: T.ui, fontSize: 16, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{clp(p.monto)}</div>
                <Icon name="chevR" size={15} color={T.faint} />
              </button>
            ))}
          </div>
        )}
        {provs.length > 0 && (
          <button onClick={openNew} style={addBtn}>
            <Icon name="plus" size={18} color={T.green} sw={2} /> Agregar proveedor
          </button>
        )}

        {/* Ventas */}
        <div style={{ height: 22 }} />
        <SectionHead title="Ventas del turno" />
        <div style={{ background: T.surface, borderRadius: 16, border: '1px solid ' + T.line, overflow: 'hidden' }}>
          {VENTAS_DEF.map((v, i) => {
            const val = parseNum(ventas[v.key]);
            return (
              <button key={v.key} onClick={() => openVenta(v.key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                background: 'transparent', border: 'none', borderBottom: i < VENTAS_DEF.length - 1 ? '1px solid ' + T.lineSoft : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.ui, fontSize: 15, fontWeight: 500, color: T.ink }}>{v.label}</div>
                  <div style={{ fontFamily: T.ui, fontSize: 12, color: T.muted }}>{v.sub}</div>
                </div>
                <div style={{ fontFamily: T.ui, fontSize: 16, fontWeight: 600, color: val ? T.ink : T.faint, fontVariantNumeric: 'tabular-nums' }}>{clp(val)}</div>
                <Icon name="chevR" size={15} color={T.faint} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <TotalsBar label="Total ventas del turno" value={totalVentas}>
        <button onClick={guardar} style={primaryBtn}>Guardar</button>
      </TotalsBar>

      {/* Sheets */}
      {sheet && <Backdrop onClose={() => setSheet(null)} />}
      {sheet?.mode === 'prov' && (
        <Sheet title={sheet.idx === -1 ? 'Agregar proveedor' : 'Editar proveedor'} onClose={() => setSheet(null)}
          extra={sheet.idx !== -1 && <button onClick={() => delProv(sheet.idx)} style={trashBtn}><Icon name="trash" size={18} color={T.terra} /></button>}>
          <div style={{ position: 'relative' }}>
            <Icon name="store" size={16} color={T.faint} style={{ position: 'absolute', left: 14, top: 14 }} />
            <input value={sheet.nombre} onChange={e => setSheet(s => ({ ...s, nombre: e.target.value }))}
              placeholder="Buscar o escribir proveedor" style={{ ...textInput, paddingLeft: 40 }} />
          </div>
          <FreqChips onPick={n => setSheet(s => ({ ...s, nombre: n }))} used={usedNames} wrap={false} query={sheet.nombre} />
          <div style={{ background: T.surfaceAlt, borderRadius: 14, padding: '12px 16px', border: '1px solid ' + T.line }}>
            <AmountField value={sheet.monto} active accent={sheet.forma_pago === 'efectivo' ? T.green : T.navy} />
          </div>
          <PayToggle value={sheet.forma_pago} onChange={fp => setSheet(s => ({ ...s, forma_pago: fp }))} />
          <Keypad compact onKey={k => setSheet(s => ({ ...s, monto: applyKey(s.monto, k) }))}
            onAccept={commitProv} acceptLabel={sheet.idx === -1 ? 'Agregar proveedor' : 'Guardar cambios'}
            acceptDisabled={parseNum(sheet.monto) === 0}
            accent={sheet.forma_pago === 'efectivo' ? T.green : T.navy} />
        </Sheet>
      )}
      {sheet?.mode === 'venta' && (
        <Sheet title={'Ventas · ' + VENTAS_DEF.find(v => v.key === sheet.key).label} onClose={() => setSheet(null)}>
          <div style={{ background: T.surfaceAlt, borderRadius: 14, padding: '14px 16px', border: '1px solid ' + T.line }}>
            <AmountField value={sheet.monto} active label={VENTAS_DEF.find(v => v.key === sheet.key).sub} />
          </div>
          <Keypad onKey={k => setSheet(s => ({ ...s, monto: applyKey(s.monto, k) }))}
            onAccept={commitVenta} acceptLabel="Listo" />
        </Sheet>
      )}
    </div>
  );
}

/* ── Subcomponentes locales ─────────────────────────── */
function SectionHead({ title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 9px' }}>
      <div style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {right && <div style={{ fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.green }}>{right}</div>}
    </div>
  );
}

function Backdrop({ onClose }) {
  return <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(18,20,24,0.32)', zIndex: 40, animation: 'fade .2s' }} />;
}

function Sheet({ title, children, onClose, extra }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
      background: T.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
      padding: '10px 18px 30px', boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
      animation: 'slideUp .26s cubic-bezier(.2,.8,.2,1)',
      maxHeight: '90%', display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <div style={{ width: 38, height: 4, borderRadius: 999, background: T.handle, margin: '0 auto 4px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: T.ui, fontSize: 17, fontWeight: 700, color: T.ink }}>{title}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {extra}
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: T.seg, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="close" size={17} color={T.inkSoft} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

const emptyBtn = { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '26px 0', borderRadius: 16, border: '1.5px dashed ' + T.dash, background: 'transparent', cursor: 'pointer', color: T.muted, fontFamily: T.ui, fontSize: 14.5, fontWeight: 500 };
const addBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', borderRadius: 13, border: '1px solid ' + T.greenTint, background: T.greenTint, color: T.green, cursor: 'pointer', fontFamily: T.ui, fontSize: 14.5, fontWeight: 600 };
const primaryBtn = { height: 50, padding: '0 26px', borderRadius: 14, border: 'none', background: T.green, color: '#fff', cursor: 'pointer', fontFamily: T.ui, fontSize: 16, fontWeight: 600 };
const trashBtn = { width: 32, height: 32, borderRadius: 999, border: 'none', background: T.terraTint, cursor: 'pointer', display: 'grid', placeItems: 'center' };
const textInput = { width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 13, border: '1px solid ' + T.line, background: T.surface, fontFamily: T.ui, fontSize: 15.5, color: T.ink, outline: 'none' };

window.ApproachA = ApproachA;
