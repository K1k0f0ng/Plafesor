import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconCheckCircle, IconCheck, IconAlertTriangle, IconRefresh } from '../components/Icons';

function mezclar(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function formatTiempo(seg) {
  return `${Math.floor(seg / 60).toString().padStart(2, '0')}:${(seg % 60).toString().padStart(2, '0')}`;
}

// ─── Pantalla de resultado ────────────────────────────────────────────────────

function PantallaResultado({ nota, intento, actividadId, onVolver }) {
  const navigate = useNavigate();
  const [generando, setGenerando] = useState(false);
  const [msgRecup,  setMsgRecup]  = useState('');

  let nivel, color, msg;
  if (nota < 3)       { nivel = 'Bajo';     color = '#c62828'; msg = '¡Sigue practicando, puedes mejorar!'; }
  else if (nota < 4)  { nivel = 'Básico';   color = '#f57f17'; msg = '¡Buen intento! Revisa los temas.'; }
  else if (nota <= 4.5){ nivel = 'Alto';    color = '#2e7d32'; msg = '¡Muy bien! Buen dominio del tema.'; }
  else                { nivel = 'Superior'; color = '#1565c0'; msg = '¡Excelente! Dominas este tema.'; }

  async function pedirRecuperacion() {
    setGenerando(true);
    setMsgRecup('');
    try {
      const resp = await axiosAuth.post(`/api/actividades/${actividadId}/generar-recuperacion`);
      const nuevaId = resp.data.data.id;
      navigate(`/actividad/${nuevaId}`);
    } catch (err) {
      setMsgRecup(err.response?.data?.error || 'Error al generar la recuperación.');
      setGenerando(false);
    }
  }

  return (
    <div style={rs.fondo}>
      <div style={rs.tarjeta}>
        <div style={{ marginBottom: 8 }}>
          {nota >= 4
            ? <IconCheckCircle size={64} style={{ color }} />
            : nota >= 3
              ? <IconCheck size={64} style={{ color }} />
              : <IconAlertTriangle size={64} style={{ color }} />}
        </div>
        <p style={rs.etiqueta}>Tu nota</p>
        <div style={{ ...rs.nota, color }}>{nota}</div>
        <div style={{ ...rs.nivel, color, background: color + '18' }}>Desempeño {nivel}</div>
        <p style={rs.mensaje}>{msg}</p>
        <p style={rs.intento}>Intento número {intento}</p>
        {nota < 3 && (
          <div style={{ marginBottom: 12, width: '100%' }}>
            <button
              onClick={pedirRecuperacion}
              disabled={generando}
              style={{ ...rs.btnRecup, opacity: generando ? 0.7 : 1 }}
            >
              <IconRefresh size={15} style={{ marginRight: 7, verticalAlign: 'middle' }} />
              {generando ? 'Generando recuperación...' : 'Actividad de recuperación con IA'}
            </button>
            {msgRecup && <p style={{ fontSize: 12, color: '#c62828', marginTop: 6, textAlign: 'center' }}>{msgRecup}</p>}
          </div>
        )}
        <button onClick={onVolver} style={rs.btn}>← Volver a mis actividades</button>
      </div>
    </div>
  );
}

// ─── Imagen de pregunta ───────────────────────────────────────────────────────

function ImgPregunta({ src }) {
  if (!src) return null;
  return <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, margin: '8px 0', border: '1px solid #e0e0e0' }} />;
}

// ─── Motor: Opción múltiple (multi + legacy) ──────────────────────────────────

function MotorOpcionMultiple({ contenido, respuestas, onChange, enviado }) {
  // Nuevo formato: contenido.preguntas
  if (contenido.preguntas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {contenido.preguntas.map((p, pi) => {
          const respVal = respuestas[p.id];
          return (
            <div key={p.id} style={me.pregBloque}>
              <p style={me.pregNumero}>Pregunta {pi + 1}</p>
              <p style={me.pregunta}>{p.pregunta}</p>
              <ImgPregunta src={p.imagen} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.opciones.map(op => {
                  const sel = respVal === op.id;
                  let est = { ...me.opcion };
                  if (enviado) {
                    if (op.correcto) est = { ...est, ...me.opcionCorrecta };
                    else if (sel) est = { ...est, ...me.opcionIncorrecta };
                  } else if (sel) est = { ...est, ...me.opcionSeleccionada };
                  return (
                    <button key={op.id} onClick={() => !enviado && onChange({ ...respuestas, [p.id]: op.id })} style={est}>
                      {!enviado && <span style={sel ? me.radioOn : me.radioOff} />}
                      {enviado && op.correcto && <span style={me.iconoOk}>✓</span>}
                      {enviado && sel && !op.correcto && <span style={me.iconoMal}>✗</span>}
                      <span>{op.texto}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // Legacy
  return (
    <div style={me.bloque}>
      <p style={me.pregunta}>{contenido.pregunta}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contenido.opciones.map(op => {
          const sel = respuestas.opcion_id === op.id;
          let est = { ...me.opcion };
          if (enviado) {
            if (op.correcto) est = { ...est, ...me.opcionCorrecta };
            else if (sel) est = { ...est, ...me.opcionIncorrecta };
          } else if (sel) est = { ...est, ...me.opcionSeleccionada };
          return (
            <button key={op.id} onClick={() => !enviado && onChange({ opcion_id: op.id })} style={est}>
              {!enviado && <span style={sel ? me.radioOn : me.radioOff} />}
              {enviado && op.correcto && <span style={me.iconoOk}>✓</span>}
              {enviado && sel && !op.correcto && <span style={me.iconoMal}>✗</span>}
              <span>{op.texto}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Motor: Verdadero / Falso ─────────────────────────────────────────────────

function MotorVerdaderoFalso({ contenido, respuestas, onChange, enviado }) {
  function toggle(id, val) { if (!enviado) onChange({ ...respuestas, [id]: val }); }
  return (
    <div style={me.bloque}>
      <p style={me.instruccion}>Indica si cada afirmación es Verdadera o Falsa:</p>
      {contenido.afirmaciones.map(af => {
        const resp = respuestas[af.id];
        const ok = resp === af.correcto;
        return (
          <div key={af.id} style={{ ...me.afFila, ...(enviado ? (ok ? me.filaOk : me.filaMal) : {}) }}>
            <div style={{ flex: 1 }}>
              <span style={me.afTexto}>{af.texto}</span>
              <ImgPregunta src={af.imagen} />
            </div>
            <div style={me.vfBtns}>
              <button onClick={() => toggle(af.id, true)}
                style={{ ...me.vfBtn, ...(resp === true ? me.vfV : {}), ...(enviado && af.correcto ? me.vfCorr : {}), ...(enviado && resp === true && !af.correcto ? me.vfErr : {}) }}>V</button>
              <button onClick={() => toggle(af.id, false)}
                style={{ ...me.vfBtn, ...(resp === false ? me.vfF : {}), ...(enviado && !af.correcto ? me.vfCorr : {}), ...(enviado && resp === false && af.correcto ? me.vfErr : {}) }}>F</button>
            </div>
            {enviado && <span style={ok ? me.iconoOk : me.iconoMal}>{ok ? '✓' : '✗'}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Motor: Ordenar pasos ─────────────────────────────────────────────────────

function MotorOrdenarPasos({ contenido, respuestas, onChange, enviado }) {
  const [orden, setOrden] = useState(() => mezclar(contenido.pasos));
  useEffect(() => { if (!enviado) onChange(orden.map(p => p.id)); }, [orden]); // eslint-disable-line
  function mover(idx, dir) {
    if (enviado) return;
    const arr = [...orden]; const dest = idx + dir;
    if (dest < 0 || dest >= arr.length) return;
    [arr[idx], arr[dest]] = [arr[dest], arr[idx]]; setOrden(arr);
  }
  return (
    <div style={me.bloque}>
      <p style={me.instruccion}>{contenido.instruccion || 'Ordena los siguientes pasos:'}</p>
      <p style={me.ayuda}>Usa ↑ ↓ para cambiar el orden.</p>
      {orden.map((paso, i) => {
        const ok = enviado && paso.orden === i + 1;
        return (
          <div key={paso.id} style={{ ...me.pasoFila, ...(enviado ? (ok ? me.filaOk : me.filaMal) : {}) }}>
            <span style={me.pasoNum}>{i + 1}</span>
            <span style={{ flex: 1 }}>{paso.texto}</span>
            {!enviado && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => mover(i, -1)} disabled={i === 0} style={me.flechaBtn}>↑</button>
                <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1} style={me.flechaBtn}>↓</button>
              </div>
            )}
            {enviado && <span style={ok ? me.iconoOk : me.iconoMal}>{ok ? '✓' : '✗'}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Motor: Completar espacios (multi + legacy) ───────────────────────────────

function MotorCompletarEspacios({ contenido, respuestas, onChange, enviado }) {
  // Nuevo formato: contenido.preguntas
  if (contenido.preguntas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {contenido.preguntas.map((p, pi) => {
          const partes = p.texto_con_blancos.split('[BLANK]');
          return (
            <div key={p.id} style={me.pregBloque}>
              <p style={me.pregNumero}>Ejercicio {pi + 1}</p>
              <ImgPregunta src={p.imagen} />
              <div style={me.textoConBlancos}>
                {partes.map((parte, i) => {
                  const esp = p.respuestas[i];
                  const key = esp ? `${p.id}_${esp.id}` : null;
                  const val = key ? (respuestas[key] || '') : '';
                  const ok = esp && val.trim().toLowerCase() === esp.respuesta.trim().toLowerCase();
                  return (
                    <React.Fragment key={i}>
                      <span>{parte}</span>
                      {esp && (
                        <>
                          <input type="text" value={val} disabled={enviado}
                            onChange={e => onChange({ ...respuestas, [key]: e.target.value })}
                            placeholder="___"
                            style={{ ...me.inputBlanco, ...(enviado ? (ok ? me.inputOk : me.inputMal) : {}) }} />
                          {enviado && !ok && <span style={me.respCorr}>({esp.respuesta})</span>}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // Legacy
  const partes = contenido.texto_con_blancos.split('[BLANK]');
  return (
    <div style={me.bloque}>
      <p style={me.instruccion}>Completa los espacios en blanco:</p>
      <div style={me.textoConBlancos}>
        {partes.map((parte, i) => {
          const esp = contenido.respuestas[i];
          const val = esp ? (respuestas[esp.id] || '') : '';
          const ok = esp && val.trim().toLowerCase() === esp.respuesta.trim().toLowerCase();
          return (
            <React.Fragment key={i}>
              <span>{parte}</span>
              {esp && (
                <>
                  <input type="text" value={val} disabled={enviado}
                    onChange={e => onChange({ ...respuestas, [esp.id]: e.target.value })}
                    placeholder="___"
                    style={{ ...me.inputBlanco, ...(enviado ? (ok ? me.inputOk : me.inputMal) : {}) }} />
                  {enviado && !ok && <span style={me.respCorr}>({esp.respuesta})</span>}
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Motor: Relacionar columnas ───────────────────────────────────────────────

function MotorRelacionarColumnas({ contenido, respuestas, onChange, enviado }) {
  const [colB] = useState(() => mezclar(contenido.columna_b));
  const [selA, setSelA] = useState(null);
  function clickA(id) { if (!enviado) setSelA(selA === id ? null : id); }
  function clickB(bId) {
    if (!enviado && selA) { onChange({ ...respuestas, [bId]: selA }); setSelA(null); }
  }
  return (
    <div style={me.bloque}>
      <p style={me.instruccion}>Relaciona cada elemento de la columna A con su par en la columna B.</p>
      {!enviado && <p style={me.ayuda}>{selA ? 'Ahora haz clic en el elemento de la columna B.' : 'Haz clic en un elemento de la columna A.'}</p>}
      <div style={me.colGrid}>
        <div>
          <p style={me.colTitulo}>Columna A</p>
          {contenido.columna_a.map(a => {
            const pareado = Object.values(respuestas).includes(a.id);
            const correcto = enviado && Object.entries(respuestas).some(([bId, aId]) => aId === a.id && colB.find(b => b.id === parseInt(bId))?.par_id === a.id);
            return (
              <button key={a.id} onClick={() => clickA(a.id)}
                style={{ ...me.colItem, ...(selA === a.id ? me.itemSelA : {}), ...(pareado && !enviado ? me.itemPareado : {}), ...(enviado ? (correcto ? me.itemOk : me.itemMal) : {}) }}>
                {a.texto}
              </button>
            );
          })}
        </div>
        <div>
          <p style={me.colTitulo}>Columna B</p>
          {colB.map(b => {
            const pId = respuestas[b.id];
            const correcto = enviado && b.par_id === respuestas[b.id];
            return (
              <button key={b.id} onClick={() => clickB(b.id)}
                style={{ ...me.colItem, ...(pId && !enviado ? me.itemPareado : {}), ...(enviado ? (correcto ? me.itemOk : me.itemMal) : {}) }}>
                {b.texto}
                {pId && !enviado && <span style={{ fontSize: 11, color: 'var(--color-secundario)' }}> ↔ {contenido.columna_a.find(a => a.id === pId)?.texto}</span>}
                {enviado && <span style={{ marginLeft: 6 }}>{correcto ? '✓' : '✗'}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Motor: Ordenar letras ────────────────────────────────────────────────────

function MotorOrdenarLetras({ contenido, respuestas, onChange, enviado }) {
  const [estados, setEstados] = useState(() => {
    const init = {};
    contenido.palabras.forEach(p => {
      const letras = p.palabra.toUpperCase().split('').map((l, i) => ({ id: i, letra: l }));
      for (let i = letras.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letras[i], letras[j]] = [letras[j], letras[i]];
      }
      init[p.id] = { disponibles: letras, seleccionadas: [] };
    });
    return init;
  });

  function moverLetra(pid, lid, hacia) {
    if (enviado) return;
    setEstados(prev => {
      const est = prev[pid];
      if (hacia === 'sel') {
        const letra = est.disponibles.find(l => l.id === lid);
        if (!letra) return prev;
        const nuevo = { disponibles: est.disponibles.filter(l => l.id !== lid), seleccionadas: [...est.seleccionadas, letra] };
        onChange({ ...respuestas, [pid]: nuevo.seleccionadas.map(l => l.letra).join('') });
        return { ...prev, [pid]: nuevo };
      } else {
        const letra = est.seleccionadas.find(l => l.id === lid);
        if (!letra) return prev;
        const nuevo = { seleccionadas: est.seleccionadas.filter(l => l.id !== lid), disponibles: [...est.disponibles, letra] };
        onChange({ ...respuestas, [pid]: nuevo.seleccionadas.map(l => l.letra).join('') });
        return { ...prev, [pid]: nuevo };
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {contenido.palabras.map((p, i) => {
        const est = estados[p.id] || { disponibles: [], seleccionadas: [] };
        const resp = respuestas[p.id] || '';
        const ok = enviado && resp.toLowerCase() === p.palabra.toLowerCase();
        return (
          <div key={p.id} style={me.pregBloque}>
            <p style={me.pregNumero}>Palabra {i + 1}{p.pista ? ` — Pista: ${p.pista}` : ''}</p>
            <div style={{ ...me.zonaRespuesta, border: `2px dashed ${enviado ? (ok ? '#43e97b' : '#ef5350') : '#ccc'}`, background: enviado ? (ok ? '#f1fff5' : '#fff0f0') : '#fff' }}>
              {est.seleccionadas.map(l => (
                <button key={l.id} type="button" onClick={() => moverLetra(p.id, l.id, 'dis')} style={me.chipLetraOn}>{l.letra}</button>
              ))}
              {est.seleccionadas.length === 0 && <span style={me.placeholder}>Haz clic en las letras de abajo para ordenarlas aquí</span>}
            </div>
            <div style={me.zonaLetras}>
              {est.disponibles.map(l => (
                <button key={l.id} type="button" onClick={() => moverLetra(p.id, l.id, 'sel')} style={me.chipLetraOff}>{l.letra}</button>
              ))}
            </div>
            {enviado && <p style={{ margin: 0, fontWeight: 700, color: ok ? '#2e7d32' : '#c62828', fontSize: 14 }}>
              {ok ? '✓ ¡Correcto!' : `✗ La palabra era: ${p.palabra.toUpperCase()}`}
            </p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Motor: Ordenar palabras ──────────────────────────────────────────────────

function MotorOrdenarPalabras({ contenido, respuestas, onChange, enviado }) {
  const [estados, setEstados] = useState(() => {
    const init = {};
    contenido.oraciones.forEach(o => {
      const palabras = o.oracion.trim().split(/\s+/).map((p, i) => ({ id: i, texto: p }));
      for (let i = palabras.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [palabras[i], palabras[j]] = [palabras[j], palabras[i]];
      }
      init[o.id] = { disponibles: palabras, seleccionadas: [] };
    });
    return init;
  });

  function moverPalabra(oid, pid, hacia) {
    if (enviado) return;
    setEstados(prev => {
      const est = prev[oid];
      if (hacia === 'sel') {
        const pal = est.disponibles.find(p => p.id === pid);
        if (!pal) return prev;
        const nuevo = { disponibles: est.disponibles.filter(p => p.id !== pid), seleccionadas: [...est.seleccionadas, pal] };
        onChange({ ...respuestas, [oid]: nuevo.seleccionadas.map(p => p.texto).join(' ') });
        return { ...prev, [oid]: nuevo };
      } else {
        const pal = est.seleccionadas.find(p => p.id === pid);
        if (!pal) return prev;
        const nuevo = { seleccionadas: est.seleccionadas.filter(p => p.id !== pid), disponibles: [...est.disponibles, pal] };
        onChange({ ...respuestas, [oid]: nuevo.seleccionadas.map(p => p.texto).join(' ') });
        return { ...prev, [oid]: nuevo };
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {contenido.oraciones.map((o, i) => {
        const est = estados[o.id] || { disponibles: [], seleccionadas: [] };
        const resp = respuestas[o.id] || '';
        const ok = enviado && resp.trim().toLowerCase() === o.oracion.trim().toLowerCase();
        return (
          <div key={o.id} style={me.pregBloque}>
            <p style={me.pregNumero}>Oración {i + 1}{o.pista ? ` — Pista: ${o.pista}` : ''}</p>
            <div style={{ ...me.zonaRespuesta, border: `2px dashed ${enviado ? (ok ? '#43e97b' : '#ef5350') : '#ccc'}`, background: enviado ? (ok ? '#f1fff5' : '#fff0f0') : '#fff', flexWrap: 'wrap', gap: 6 }}>
              {est.seleccionadas.map(p => (
                <button key={p.id} type="button" onClick={() => moverPalabra(o.id, p.id, 'dis')} style={me.chipPalabraOn}>{p.texto}</button>
              ))}
              {est.seleccionadas.length === 0 && <span style={me.placeholder}>Haz clic en las palabras de abajo para armar la oración</span>}
            </div>
            <div style={{ ...me.zonaLetras, flexWrap: 'wrap', gap: 6 }}>
              {est.disponibles.map(p => (
                <button key={p.id} type="button" onClick={() => moverPalabra(o.id, p.id, 'sel')} style={me.chipPalabraOff}>{p.texto}</button>
              ))}
            </div>
            {enviado && <p style={{ margin: 0, fontWeight: 700, color: ok ? '#2e7d32' : '#c62828', fontSize: 14 }}>
              {ok ? '✓ ¡Correcto!' : `✗ La oración correcta era: "${o.oracion}"`}
            </p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Motor: Sopa de letras ────────────────────────────────────────────────────

function MotorSopaLetras({ contenido, respuestas, onChange, enviado }) {
  const [inicio, setInicio] = useState(null);
  const [hover, setHover] = useState(null);
  const encontradas = respuestas || {};

  function celdaEnLinea(a, b) {
    if (!a || !b) return [];
    if (a.r === b.r) {
      const min = Math.min(a.c, b.c), max = Math.max(a.c, b.c);
      return Array.from({ length: max - min + 1 }, (_, i) => ({ r: a.r, c: min + i }));
    }
    if (a.c === b.c) {
      const min = Math.min(a.r, b.r), max = Math.max(a.r, b.r);
      return Array.from({ length: max - min + 1 }, (_, i) => ({ r: min + i, c: a.c }));
    }
    return [];
  }

  function handleCelda(r, c) {
    if (enviado) return;
    if (!inicio) { setInicio({ r, c }); return; }
    const celdas = celdaEnLinea(inicio, { r, c });
    if (celdas.length < 2) { setInicio({ r, c }); return; }
    const letras = celdas.map(cel => contenido.grid[cel.r][cel.c]).join('');
    const letrasRev = letras.split('').reverse().join('');
    for (const p of contenido.palabras) {
      const pal = p.palabra.toUpperCase().replace(/\s/g, '');
      if (letras === pal || letrasRev === pal) {
        onChange({ ...encontradas, [p.id]: true });
        setInicio(null); setHover(null);
        return;
      }
    }
    setInicio({ r, c });
  }

  const celdaFond = new Set();
  Object.entries(encontradas).filter(([, v]) => v).forEach(([id]) => {
    const ub = contenido.ubicaciones?.find(u => u.id === parseInt(id));
    if (ub) for (let i = 0; i < ub.longitud; i++) {
      const r = ub.direccion === 'h' ? ub.fila : ub.fila + i;
      const c = ub.direccion === 'h' ? ub.col + i : ub.col;
      celdaFond.add(`${r}_${c}`);
    }
  });

  const selSet = new Set();
  if (inicio) {
    const destino = hover || inicio;
    celdaEnLinea(inicio, destino).forEach(cel => selSet.add(`${cel.r}_${cel.c}`));
  }

  const totalEncontradas = Object.values(encontradas).filter(Boolean).length;
  const total = contenido.palabras.length;

  return (
    <div style={me.bloque}>
      <p style={me.instruccion}>Encuentra las {total} palabras en la sopa de letras</p>
      <p style={me.ayuda}>Haz clic en la primera letra, luego en la última letra de la palabra.</p>
      {totalEncontradas === total && <div style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, padding: '10px 16px', fontWeight: 700, marginBottom: 8 }}>¡Encontraste todas las palabras!</div>}
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <div style={{ display: 'inline-block', border: '2px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}
          onMouseLeave={() => setHover(null)}>
          {contenido.grid.map((fila, r) => (
            <div key={r} style={{ display: 'flex' }}>
              {fila.map((letra, c) => {
                const k = `${r}_${c}`;
                const found = celdaFond.has(k);
                const sel = selSet.has(k);
                return (
                  <button key={c} onClick={() => handleCelda(r, c)} onMouseEnter={() => inicio && setHover({ r, c })}
                    style={{ width: 32, height: 32, border: 'none', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', background: found ? '#c8e6c9' : sel ? '#e3f2fd' : '#fff', color: found ? '#2e7d32' : sel ? '#1565c0' : '#333', fontWeight: found || sel ? 800 : 500, fontSize: 14, cursor: 'pointer', fontFamily: 'monospace' }}>
                    {letra}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {contenido.palabras.map(p => (
          <span key={p.id} style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: encontradas[p.id] ? '#c8e6c9' : '#f0f0f0', color: encontradas[p.id] ? '#2e7d32' : '#888', textDecoration: encontradas[p.id] ? 'line-through' : 'none' }}>
            {encontradas[p.id] ? '✓ ' : ''}{p.pista || p.palabra}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Actividad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actividad, setActividad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [respuestas, setRespuestas] = useState({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [tiempoSeg, setTiempoSeg] = useState(null);
  const [inicio] = useState(Date.now());

  useEffect(() => {
    async function cargar() {
      try {
        const resp = await axiosAuth.get(`/api/actividades/${id}`);
        const act = resp.data.data;
        const contenido = typeof act.contenido === 'string' ? JSON.parse(act.contenido) : act.contenido;
        setActividad({ ...act, contenido });
        setTiempoSeg(act.tiempo_limite_minutos * 60);
        const rRes = await axiosAuth.get(`/api/actividades/${id}/resultado`);
        if (rRes.data.data?.length > 0) {
          const ultimo = rRes.data.data[0];
          if (ultimo.intento_numero >= act.intentos_permitidos) {
            setResultado({ nota: ultimo.nota, intento: ultimo.intento_numero });
          }
        }
      } catch { setError('No se pudo cargar la actividad.'); }
      finally { setCargando(false); }
    }
    cargar();
  }, [id]);

  const enviar = useCallback(async (respsFinal) => {
    if (enviando || enviado) return;
    setEnviando(true);
    try {
      const resp = await axiosAuth.post(`/api/actividades/${id}/responder`, {
        respuestas: respsFinal,
        tiempo_empleado_segundos: Math.round((Date.now() - inicio) / 1000),
      });
      setResultado({ nota: resp.data.data.nota, intento: resp.data.data.intento_numero });
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar las respuestas.');
    } finally { setEnviando(false); }
  }, [id, inicio, enviado, enviando]);

  useEffect(() => {
    if (tiempoSeg === null || enviado) return;
    if (tiempoSeg <= 0) { enviar(respuestas); return; }
    const t = setTimeout(() => setTiempoSeg(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [tiempoSeg, enviado, enviar, respuestas]);

  if (cargando) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}><p style={{ color: '#888' }}>Cargando actividad...</p></div>;
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', flexDirection: 'column', gap: 16 }}><p style={{ color: '#c62828' }}>{error}</p><button onClick={() => navigate(-1)} style={es.btnVolver}>← Volver</button></div>;
  if (resultado) return <PantallaResultado nota={resultado.nota} intento={resultado.intento} actividadId={id} onVolver={() => navigate(-1)} />;

  const tiempoAlerta = tiempoSeg !== null && tiempoSeg < 60;
  const tipo = actividad?.tipo;
  const contenido = actividad?.contenido;

  return (
    <div style={es.pagina}>
      <Navbar titulo={actividad?.titulo || 'Actividad'} />
      <div style={es.contenido}>
        <div style={es.header}>
          <div>
            <h2 style={es.titulo}>{actividad?.titulo}</h2>
            {actividad?.descripcion && <p style={es.desc}>{actividad.descripcion}</p>}
          </div>
          <div style={{ ...es.timer, ...(tiempoAlerta ? es.timerAlerta : {}) }}>
            ⏱ {tiempoSeg !== null ? formatTiempo(tiempoSeg) : '--:--'}
          </div>
        </div>

        <div style={es.card}>
          {tipo === 'opcion_multiple'    && <MotorOpcionMultiple    contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'verdadero_falso'    && <MotorVerdaderoFalso    contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'ordenar_pasos'      && <MotorOrdenarPasos      contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'completar_espacios' && <MotorCompletarEspacios contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'relacionar_columnas'&& <MotorRelacionarColumnas contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'ordenar_letras'     && <MotorOrdenarLetras     contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'ordenar_palabras'   && <MotorOrdenarPalabras   contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
          {tipo === 'sopa_letras'        && <MotorSopaLetras        contenido={contenido} respuestas={respuestas} onChange={setRespuestas} enviado={enviado} />}
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {!enviado && (
          <button onClick={() => enviar(respuestas)} disabled={enviando} style={es.btnEnviar}>
            {enviando ? 'Enviando...' : '✓ Verificar respuestas'}
          </button>
        )}
        {enviado && (
          <button onClick={() => navigate(-1)} style={{ ...es.btnEnviar, background: 'linear-gradient(135deg,#43a047,#2e7d32)' }}>
            ← Volver a mis materias
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Estilos motor ────────────────────────────────────────────────────────────
const me = {
  bloque: { display: 'flex', flexDirection: 'column', gap: 12 },
  pregBloque: { background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  pregNumero: { fontSize: 12, fontWeight: 700, color: 'var(--color-primario)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 },
  pregunta: { fontSize: 17, fontWeight: 700, color: '#333', lineHeight: 1.5, margin: 0 },
  instruccion: { fontSize: 16, fontWeight: 600, color: '#444', margin: 0 },
  ayuda: { fontSize: 13, color: '#999', margin: 0 },
  opcion: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: '2px solid #e8e8e8', borderRadius: 10, background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 15, fontFamily: 'inherit', color: '#333' },
  opcionSeleccionada: { borderColor: 'var(--color-primario)', background: '#f0f0ff' },
  opcionCorrecta: { borderColor: '#43e97b', background: '#e8f5e9', color: '#2e7d32', cursor: 'default' },
  opcionIncorrecta: { borderColor: '#ef5350', background: '#fff0f0', color: '#c62828', cursor: 'default' },
  radioOff: { width: 18, height: 18, border: '2px solid #ccc', borderRadius: '50%', flexShrink: 0 },
  radioOn: { width: 18, height: 18, border: '2px solid var(--color-primario)', borderRadius: '50%', background: 'var(--color-primario)', flexShrink: 0 },
  iconoOk: { color: '#2e7d32', fontWeight: 700, fontSize: 16 },
  iconoMal: { color: '#c62828', fontWeight: 700, fontSize: 16 },
  afFila: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '2px solid #e8e8e8', borderRadius: 10, flexWrap: 'wrap' },
  afTexto: { fontSize: 14, color: '#333', flex: 1 },
  filaOk: { borderColor: '#43e97b', background: '#e8f5e9' },
  filaMal: { borderColor: '#ef5350', background: '#fff0f0' },
  vfBtns: { display: 'flex', gap: 6 },
  vfBtn: { width: 40, height: 40, border: '2px solid #e0e0e0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' },
  vfV: { borderColor: '#43e97b', background: '#e8f5e9', color: '#2e7d32' },
  vfF: { borderColor: '#ef5350', background: '#fff0f0', color: '#c62828' },
  vfCorr: { borderColor: '#43e97b', background: '#c8e6c9' },
  vfErr: { borderColor: '#ef5350', background: '#ffcdd2' },
  pasoFila: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '2px solid #e8e8e8', borderRadius: 10, fontSize: 14, color: '#333' },
  pasoNum: { width: 28, height: 28, background: 'var(--color-primario)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  flechaBtn: { padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#f5f5f5', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  textoConBlancos: { fontSize: 16, lineHeight: 2.4, color: '#333' },
  inputBlanco: { border: 'none', borderBottom: '2px solid var(--color-primario)', outline: 'none', fontSize: 16, fontFamily: 'inherit', padding: '0 4px', margin: '0 4px', width: 100, textAlign: 'center', background: 'transparent', color: '#333' },
  inputOk: { borderBottomColor: '#43e97b', color: '#2e7d32' },
  inputMal: { borderBottomColor: '#ef5350', color: '#c62828' },
  respCorr: { fontSize: 13, color: '#2e7d32', fontWeight: 600 },
  colGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  colTitulo: { fontWeight: 700, color: '#555', marginBottom: 10, fontSize: 14 },
  colItem: { display: 'block', width: '100%', padding: '12px 14px', border: '2px solid #e8e8e8', borderRadius: 10, background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontFamily: 'inherit', color: '#333', marginBottom: 8 },
  itemSelA: { borderColor: 'var(--color-primario)', background: '#f0f0ff' },
  itemPareado: { borderColor: 'var(--color-secundario)', background: '#f3e8ff', color: 'var(--color-secundario)' },
  itemOk: { borderColor: '#43e97b', background: '#e8f5e9', color: '#2e7d32', cursor: 'default' },
  itemMal: { borderColor: '#ef5350', background: '#fff0f0', color: '#c62828', cursor: 'default' },
  zonaRespuesta: { display: 'flex', minHeight: 48, padding: '8px 12px', borderRadius: 10, alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  zonaLetras: { display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 0' },
  chipLetraOn: { width: 36, height: 36, border: 'none', borderRadius: 6, background: 'var(--color-primario)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'monospace' },
  chipLetraOff: { width: 36, height: 36, border: '2px solid #e0e0e0', borderRadius: 6, background: '#fff', color: '#333', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'monospace' },
  chipPalabraOn: { padding: '6px 12px', border: 'none', borderRadius: 20, background: 'var(--color-primario)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  chipPalabraOff: { padding: '6px 12px', border: '2px solid #e0e0e0', borderRadius: 20, background: '#fff', color: '#333', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  placeholder: { color: '#bbb', fontSize: 13 },
};

// ─── Estilos página ───────────────────────────────────────────────────────────
const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '820px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  titulo: { fontSize: 22, fontWeight: 800, color: '#333', margin: '0 0 6px' },
  desc: { color: '#666', fontSize: 14, margin: 0 },
  timer: { background: '#fff', borderRadius: 12, padding: '10px 20px', fontSize: 22, fontWeight: 800, color: 'var(--color-primario)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flexShrink: 0 },
  timerAlerta: { background: '#fff0f0', color: '#c62828' },
  card: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  btnEnviar: { width: '100%', background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, fontFamily: 'inherit' },
};

// ─── Estilos resultado ────────────────────────────────────────────────────────
const rs = {
  fondo: { minHeight: '100vh', background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { background: '#fff', borderRadius: 24, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  etiqueta: { color: '#888', fontSize: 14, margin: '0 0 8px' },
  nota: { fontSize: 80, fontWeight: 900, lineHeight: 1, margin: '0 0 16px' },
  nivel: { display: 'inline-block', borderRadius: 20, padding: '6px 20px', fontSize: 15, fontWeight: 700, marginBottom: 20 },
  mensaje: { color: '#555', fontSize: 15, marginBottom: 8 },
  intento: { color: '#bbb', fontSize: 13, marginBottom: 32 },
  btn: { background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnRecup: { background: 'linear-gradient(135deg,#ef5350,#c62828)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
