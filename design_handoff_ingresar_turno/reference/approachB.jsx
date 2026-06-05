/* approachB.jsx — Enfoque B: Calculadora POS, keypad fijo, entrada en serie */

function ApproachB() {
  const [tipo, setTipo] = useState('mañana');
  const [mode, setMode] = useState('prov');         // 'prov' | 'venta'
  const [provs, setProvs] = useState([]);
  const [ventas, setVentas] = useState({ efectivo: '', getnet: '', edenred: '', transferencia: '' });
  // borrador proveedor
  const [amt, setAmt] = useState('');
  const [nombre, setNombre] = useState('');
  const [fp, setFp] = useState('efectivo');
  // venta activa
  const [vkey, setVkey] = useState('efectivo');
  const [list, setList] = useState(false);
  const [done, setDone] = useState(null);
  const [flash, setFlash] = useState(null);

  const efProv = provs.filter(p => p.forma_pago === 'efectivo').reduce((s, p) => s + parseNum(p.monto), 0);
  const trProv = provs.filter(p => p.forma_pago === 'transferencia').reduce((s, p) => s + parseNum(p.monto), 0);
  const totalVentas = VENTAS_DEF.reduce((s, v) => s + parseNum(ventas[v.key]), 0);

  function onKey(k) {
    if (mode === 'prov') setAmt(a => applyKey(a, k));
    else setVentas(v => ({ ...v, [vkey]: applyKey(v[vkey], k) }));
  }
  function addProv() {
    if (parseNum(amt) === 0) return;
    setProvs(p => [...p, { nombre: nombre.trim() || 'Proveedor', monto: parseNum(amt), forma_pago: fp }]);
    setFlash((nombre.trim() || 'Proveedor') + ' · ' + clp(amt));
    setTimeout(() => setFlash(null), 1300);
    setAmt(''); setNombre('');
  }
  function nextVenta() {
    const idx = VENTAS_DEF.findIndex(v => v.key === vkey);
    setVkey(VENTAS_DEF[(idx + 1) % VENTAS_DEF.length].key);
  }
  function guardar() { setDone({ tipo, totalVentas, efProv, trProv, provs: [...provs] }); }
  function reset() {
    setProvs([]); setVentas({ efectivo: '', getnet: '', edenred: '', transferencia: '' });
    setAmt(''); setNombre(''); setDone(null); setMode('prov');
  }

  if (done) return <Success data={done} onReset={reset} />;

  const accent = mode === 'prov' ? (fp === 'efectivo' ? T.green : T.navy) : T.ink;
  const dispVal = mode === 'prov' ? amt : ventas[vkey];
  const usedNames = provs.map(p => p.nombre);
  const vMeta = VENTAS_DEF.find(v => v.key === vkey);

  return (
    <div style={{ position: 'relative', height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '54px 16px 0', background: T.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: T.ui, fontSize: 11.5, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caja Fryt</div>
            <div style={{ fontFamily: T.ui, fontSize: 18, fontWeight: 700, color: T.ink }}>Ingresar turno</div>
          </div>
          <div style={{ display: 'flex', gap: 6, background: '#ECECE6', borderRadius: 11, padding: 3 }}>
            {[['mañana', 'sun', T.amber], ['tarde', 'moon', T.navy]].map(([t, ic, c]) => (
              <button key={t} onClick={() => setTipo(t)} style={{
                border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 12px',
                background: tipo === t ? T.surface : 'transparent', boxShadow: tipo === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex', alignItems: 'center', gap: 5, fontFamily: T.ui, fontSize: 13, fontWeight: tipo === t ? 600 : 500, color: tipo === t ? T.ink : T.muted, textTransform: 'capitalize',
              }}><Icon name={ic} size={14} color={tipo === t ? c : T.muted} />{t}</button>
            ))}
          </div>
        </div>
        <Seg options={[{ value: 'prov', label: 'Proveedor', icon: <Icon name="store" size={15} color={mode === 'prov' ? T.ink : T.muted} /> }, { value: 'venta', label: 'Venta', icon: <Icon name="cash" size={15} color={mode === 'venta' ? T.ink : T.muted} /> }]} value={mode} onChange={setMode} style={{ marginBottom: 14 }} />
      </div>

      {/* Zona de entrada */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 18px 0', display: 'flex', flexDirection: 'column' }}>
        {/* display monto */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 500, color: T.muted, marginBottom: 1 }}>
            {mode === 'prov' ? (nombre.trim() ? nombre : 'Monto del proveedor') : vMeta.label + ' · ' + vMeta.sub}
          </div>
          <AmountField value={dispVal} active accent={accent} />
        </div>

        {mode === 'prov' ? (
          <>
            <FreqChips onPick={setNombre} used={usedNames} wrap={false} />
            <div style={{ height: 10 }} />
            <PayToggle value={fp} onChange={setFp} size="sm" />
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {VENTAS_DEF.map(v => {
              const on = v.key === vkey;
              const val = parseNum(ventas[v.key]);
              return (
                <button key={v.key} onClick={() => setVkey(v.key)} style={{
                  textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '10px 12px',
                  border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? T.surface : T.surfaceAlt,
                }}>
                  <div style={{ fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.ink }}>{v.label}</div>
                  <div style={{ fontFamily: T.ui, fontSize: 14, fontWeight: 600, color: val ? T.ink : T.faint, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{clp(val)}</div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* resumen mini */}
        <button onClick={() => setList(true)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer',
          background: 'transparent', border: 'none', padding: '10px 2px', borderTop: '1px solid ' + T.line,
        }}>
          <Icon name="list" size={16} color={T.muted} />
          <span style={{ fontFamily: T.ui, fontSize: 13, fontWeight: 500, color: T.inkSoft }}>{provs.length} proveedores · {clp(efProv + trProv)}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: T.ui, fontSize: 13, fontWeight: 600, color: T.green }}>Ver</span>
        </button>
      </div>

      {/* Keypad fijo */}
      <div style={{ padding: '8px 14px 14px', background: T.surface, borderTop: '1px solid ' + T.line }}>
        <Keypad compact onKey={onKey}
          onAccept={mode === 'prov' ? addProv : nextVenta}
          acceptLabel={mode === 'prov' ? 'Agregar' : 'Siguiente método'}
          acceptDisabled={mode === 'prov' && parseNum(amt) === 0}
          accent={mode === 'prov' ? (fp === 'efectivo' ? T.green : T.navy) : T.ink} />
        <button onClick={guardar} style={{
          width: '100%', height: 48, marginTop: 8, borderRadius: 14, border: '1px solid ' + T.line,
          background: T.surfaceAlt, cursor: 'pointer', fontFamily: T.ui, fontSize: 15, fontWeight: 600, color: T.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14,
        }}>
          Guardar turno · <span style={{ color: T.green }}>{clp(totalVentas)} ventas</span>
        </button>
      </div>

      {/* flash toast */}
      {flash && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 320, transform: 'translateX(-50%)', zIndex: 60,
          background: T.ink, color: '#fff', padding: '10px 16px', borderRadius: 999,
          fontFamily: T.ui, fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'fade .2s', whiteSpace: 'nowrap',
        }}>
          <Icon name="check" size={15} color={T.green} sw={2.6} /> Agregado · {flash}
        </div>
      )}

      {/* lista overlay */}
      {list && (
        <>
          <div onClick={() => setList(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(18,20,24,0.32)', zIndex: 40 }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50, maxHeight: '74%',
            background: T.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: '10px 18px 30px',
            display: 'flex', flexDirection: 'column', animation: 'slideUp .26s cubic-bezier(.2,.8,.2,1)',
          }}>
            <div style={{ width: 38, height: 4, borderRadius: 999, background: '#D6D7D0', margin: '0 auto 10px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: T.ui, fontSize: 17, fontWeight: 700, color: T.ink }}>Proveedores ({provs.length})</div>
              <button onClick={() => setList(false)} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: '#EFEFEA', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={17} color={T.inkSoft} /></button>
            </div>
            <div style={{ overflow: 'auto' }}>
              {provs.length === 0 && <div style={{ fontFamily: T.ui, fontSize: 14, color: T.muted, padding: '20px 0', textAlign: 'center' }}>Aún no agregas proveedores</div>}
              {provs.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px', borderBottom: '1px solid ' + T.lineSoft }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: p.forma_pago === 'efectivo' ? T.green : T.navy }} />
                  <span style={{ flex: 1, fontFamily: T.ui, fontSize: 14.5, color: T.ink }}>{p.nombre}</span>
                  <span style={{ fontFamily: T.ui, fontSize: 14.5, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{clp(p.monto)}</span>
                  <button onClick={() => setProvs(ps => ps.filter((_, j) => j !== i))} style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={16} color={T.faint} /></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

window.ApproachB = ApproachB;
