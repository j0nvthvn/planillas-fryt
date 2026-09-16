/* approachC.jsx — Enfoque C: Asistente por pasos + cuadre de caja */

function ApproachC() {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState(null);
  const [provs, setProvs] = useState([]);
  const [ventas, setVentas] = useState({ efectivo: '', getnet: '', edenred: '', transferencia: '' });
  const [contado, setContado] = useState('');
  // draft proveedor (paso 2)
  const [amt, setAmt] = useState(''); const [nombre, setNombre] = useState(''); const [fp, setFp] = useState('efectivo');
  // venta activa (paso 3)
  const [vkey, setVkey] = useState('efectivo');
  const [done, setDone] = useState(null);

  const efProv = provs.filter(p => p.forma_pago === 'efectivo').reduce((s, p) => s + parseNum(p.monto), 0);
  const trProv = provs.filter(p => p.forma_pago === 'transferencia').reduce((s, p) => s + parseNum(p.monto), 0);
  const totalVentas = VENTAS_DEF.reduce((s, v) => s + parseNum(ventas[v.key]), 0);
  const esperado = parseNum(ventas.efectivo) - efProv;
  const descuadre = contado === '' ? undefined : parseNum(contado) - esperado;

  function addProv() {
    if (parseNum(amt) === 0) return;
    setProvs(p => [...p, { nombre: nombre.trim() || 'Proveedor', monto: parseNum(amt), forma_pago: fp }]);
    setAmt(''); setNombre('');
  }
  function guardar() { setDone({ tipo, totalVentas, efProv, trProv, provs: [...provs], cuadre: descuadre }); }
  function reset() {
    setStep(1); setTipo(null); setProvs([]); setVentas({ efectivo: '', getnet: '', edenred: '', transferencia: '' });
    setContado(''); setAmt(''); setNombre(''); setDone(null);
  }

  if (done) return <Success data={done} onReset={reset} />;

  const STEPS = ['Turno', 'Proveedores', 'Ventas', 'Confirmar'];
  const usedNames = provs.map(p => p.nombre);
  const vMeta = VENTAS_DEF.find(v => v.key === vkey);

  return (
    <div style={{ position: 'relative', height: '100%', background: T.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header con progreso */}
      <div style={{ padding: '52px 18px 14px', background: T.surface, borderBottom: '1px solid ' + T.line }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : null} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid ' + T.line, background: T.surface, cursor: step > 1 ? 'pointer' : 'default', opacity: step > 1 ? 1 : 0.35, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="back" size={17} color={T.ink} />
          </button>
          <div>
            <div style={{ fontFamily: T.ui, fontSize: 11.5, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paso {step} de 4</div>
            <div style={{ fontFamily: T.ui, fontSize: 19, fontWeight: 700, color: T.ink }}>{STEPS[step - 1]}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < step ? T.green : '#E4E4DE', transition: 'background .3s' }} />
          ))}
        </div>
      </div>

      {/* ── PASO 1: Turno ── */}
      {step === 1 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 18px' }}>
          <div style={{ fontFamily: T.ui, fontSize: 14.5, color: T.inkSoft, marginBottom: 16, textTransform: 'capitalize' }}>{HOY}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['mañana', 'sun', 'Apertura a mediodía', T.amber, T.amberTint], ['tarde', 'moon', 'Mediodía al cierre', T.navy, T.navyTint]].map(([t, ic, sub, c, tint]) => {
              const on = tipo === t;
              return (
                <button key={t} onClick={() => setTipo(t)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '18px 18px', cursor: 'pointer',
                  borderRadius: 18, border: `1.5px solid ${on ? c : T.line}`, background: on ? tint : T.surface, textAlign: 'left',
                }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: on ? T.surface : T.surfaceAlt, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={ic} size={24} color={c} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.ui, fontSize: 17, fontWeight: 700, color: T.ink, textTransform: 'capitalize' }}>{t}</div>
                    <div style={{ fontFamily: T.ui, fontSize: 13, color: T.muted }}>{sub}</div>
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: 999, border: `2px solid ${on ? c : T.line}`, background: on ? c : 'transparent', display: 'grid', placeItems: 'center' }}>
                    {on && <Icon name="check" size={14} color="#fff" sw={2.8} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', background: T.surfaceAlt, borderRadius: 13, border: '1px solid ' + T.line }}>
            <Icon name="user" size={17} color={T.muted} />
            <span style={{ fontFamily: T.ui, fontSize: 13.5, color: T.inkSoft }}>Registra <b style={{ color: T.ink }}>Camila R.</b></span>
          </div>
        </div>
      )}

      {/* ── PASO 2: Proveedores ── */}
      {step === 2 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 6px', display: 'flex', flexDirection: 'column' }}>
          {provs.length > 0 && (
            <div style={{ background: T.surface, borderRadius: 14, border: '1px solid ' + T.line, overflow: 'hidden', marginBottom: 14 }}>
              {provs.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < provs.length - 1 ? '1px solid ' + T.lineSoft : 'none' }}>
                  <div style={{ width: 7, height: 7, borderRadius: 999, background: p.forma_pago === 'efectivo' ? T.green : T.navy }} />
                  <span style={{ flex: 1, fontFamily: T.ui, fontSize: 14, color: T.ink }}>{p.nombre}</span>
                  <span style={{ fontFamily: T.ui, fontSize: 14, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{clp(p.monto)}</span>
                  <button onClick={() => setProvs(ps => ps.filter((_, j) => j !== i))} style={{ width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={15} color={T.faint} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontFamily: T.ui, fontSize: 12, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9, paddingLeft: 2 }}>Frecuentes</div>
          <FreqChips onPick={setNombre} used={usedNames} wrap={false} />
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del proveedor" style={cTextInput} />
          <div style={{ background: T.surfaceAlt, borderRadius: 13, padding: '11px 15px', border: '1px solid ' + T.line, margin: '10px 0' }}>
            <AmountField value={amt} active accent={fp === 'efectivo' ? T.green : T.navy} />
          </div>
          <PayToggle value={fp} onChange={setFp} size="sm" />
          <div style={{ flex: 1, minHeight: 8 }} />
          <Keypad compact onKey={k => setAmt(a => applyKey(a, k))} onAccept={addProv} acceptLabel="Agregar proveedor" acceptDisabled={parseNum(amt) === 0} accent={fp === 'efectivo' ? T.green : T.navy} />
          <div style={{ height: 10 }} />
        </div>
      )}

      {/* ── PASO 3: Ventas ── */}
      {step === 3 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 6px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: T.ui, fontSize: 12.5, color: T.muted, marginBottom: 12 }}>Toca un método e ingresa el total con el teclado.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {VENTAS_DEF.map(v => {
              const on = v.key === vkey; const val = parseNum(ventas[v.key]);
              return (
                <button key={v.key} onClick={() => setVkey(v.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', cursor: 'pointer', textAlign: 'left',
                  borderRadius: 13, border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? T.surface : T.surfaceAlt,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.ui, fontSize: 14.5, fontWeight: 600, color: T.ink }}>{v.label}</div>
                    <div style={{ fontFamily: T.ui, fontSize: 12, color: T.muted }}>{v.sub}</div>
                  </div>
                  <div style={{ fontFamily: T.ui, fontSize: 17, fontWeight: 600, color: val ? T.ink : T.faint, fontVariantNumeric: 'tabular-nums' }}>{clp(val)}</div>
                  {on && <span style={{ width: 2, height: 22, background: T.ink, borderRadius: 2, animation: 'blink 1.1s steps(1) infinite' }} />}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '12px 15px', borderRadius: 13, background: T.greenTint, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: T.ui, fontSize: 13.5, fontWeight: 500, color: T.green }}>Total ventas</span>
            <span style={{ fontFamily: T.ui, fontSize: 20, fontWeight: 700, color: T.green, fontVariantNumeric: 'tabular-nums' }}>{clp(totalVentas)}</span>
          </div>
          <div style={{ flex: 1, minHeight: 8 }} />
          <Keypad compact onKey={k => setVentas(v => ({ ...v, [vkey]: applyKey(v[vkey], k) }))} accent={T.ink} />
          <div style={{ height: 10 }} />
        </div>
      )}

      {/* ── PASO 4: Confirmar ── */}
      {step === 4 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 10px' }}>
          <div style={{ background: T.surface, borderRadius: 16, border: '1px solid ' + T.line, padding: '14px 16px', marginBottom: 12 }}>
            <Row l="Turno" r={tipo} cap />
            <Row l="Ventas del turno" r={clp(totalVentas)} bold />
            <Row l={`Proveedores (${provs.length})`} r={clp(efProv + trProv)} />
            <Row l="· Efectivo" r={clp(efProv)} c={T.green} sub />
            <Row l="· Transferencia" r={clp(trProv)} c={T.navy} sub last />
          </div>

          {/* Cuadre de caja */}
          <div style={{ background: T.surface, borderRadius: 16, border: '1px solid ' + T.line, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontFamily: T.ui, fontSize: 12.5, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Cuadre de caja</div>
            <Row l="Ventas en efectivo" r={clp(parseNum(ventas.efectivo))} />
            <Row l="− Efectivo a proveedores" r={clp(efProv)} c={T.terra} />
            <Row l="Efectivo esperado en caja" r={clp(esperado)} bold last />
            <input value={contado === '' ? '' : fmt(contado)} onChange={e => setContado(parseNum(e.target.value))} inputMode="numeric" placeholder="Efectivo contado en caja (opcional)" style={{ ...cTextInput, marginTop: 12, fontVariantNumeric: 'tabular-nums' }} />
            {descuadre !== undefined && (
              <div style={{ marginTop: 10, padding: '11px 14px', borderRadius: 12, background: Math.abs(descuadre) < 1 ? T.greenTint : T.terraTint, display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name={Math.abs(descuadre) < 1 ? 'checkCircle' : 'close'} size={18} color={Math.abs(descuadre) < 1 ? T.green : T.terra} />
                <span style={{ fontFamily: T.ui, fontSize: 13.5, fontWeight: 600, color: Math.abs(descuadre) < 1 ? T.green : T.terra }}>
                  {Math.abs(descuadre) < 1 ? 'Caja cuadrada' : (descuadre > 0 ? `Sobran ${clp(descuadre)}` : `Faltan ${clp(-descuadre)}`)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer acción */}
      <div style={{ padding: '12px 18px 30px', borderTop: '1px solid ' + T.line, background: T.surface }}>
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} disabled={step === 1 && !tipo} style={{
            width: '100%', height: 52, borderRadius: 15, border: 'none',
            background: (step === 1 && !tipo) ? '#D9DAD3' : T.green, color: '#fff', cursor: (step === 1 && !tipo) ? 'default' : 'pointer',
            fontFamily: T.ui, fontSize: 16.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {step === 2 && provs.length === 0 ? 'Continuar sin proveedores' : 'Continuar'}
            <Icon name="arrow" size={19} color="#fff" sw={2.1} />
          </button>
        ) : (
          <button onClick={guardar} style={{
            width: '100%', height: 52, borderRadius: 15, border: 'none', background: T.green, color: '#fff', cursor: 'pointer',
            fontFamily: T.ui, fontSize: 16.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="check" size={20} color="#fff" sw={2.4} /> Guardar turno
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ l, r, c = T.ink, bold, sub, cap, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: sub ? '5px 0' : '8px 0', borderBottom: last ? 'none' : '1px solid ' + T.lineSoft }}>
      <span style={{ fontFamily: T.ui, fontSize: sub ? 13 : 14.5, color: sub ? T.muted : T.inkSoft, textTransform: cap ? 'capitalize' : 'none' }}>{l}</span>
      <span style={{ fontFamily: T.ui, fontSize: sub ? 13.5 : (bold ? 16 : 15), fontWeight: bold ? 700 : 600, color: c, fontVariantNumeric: 'tabular-nums', textTransform: cap ? 'capitalize' : 'none' }}>{r}</span>
    </div>
  );
}

const cTextInput = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid ' + T.line, background: T.surface, fontFamily: T.ui, fontSize: 15, color: T.ink, outline: 'none' };

window.ApproachC = ApproachC;
