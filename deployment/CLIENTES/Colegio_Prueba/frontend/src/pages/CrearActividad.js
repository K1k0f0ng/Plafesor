import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import {
  IconCheckSquare, IconCheck, IconList, IconEdit, IconLink,
  IconGrid, IconFileText, IconBarChart, IconZap, IconRefresh,
} from '../components/Icons';

const TIPOS = [
  { valor: 'opcion_multiple',    Icono: IconCheckSquare, etiqueta: 'Opción múltiple',   desc: 'Varias preguntas con 4 opciones' },
  { valor: 'verdadero_falso',    Icono: IconCheck,       etiqueta: 'Verdadero / Falso', desc: 'Lista de afirmaciones V/F' },
  { valor: 'ordenar_pasos',      Icono: IconList,        etiqueta: 'Ordenar pasos',     desc: 'Pasos mezclados a ordenar' },
  { valor: 'completar_espacios', Icono: IconEdit,        etiqueta: 'Completar espacios',desc: 'Frases con blancos' },
  { valor: 'relacionar_columnas',Icono: IconLink,        etiqueta: 'Relacionar',        desc: 'Conectar dos columnas' },
  { valor: 'ordenar_letras',     Icono: IconGrid,        etiqueta: 'Ordenar letras',    desc: 'Arma la palabra letra a letra' },
  { valor: 'ordenar_palabras',   Icono: IconFileText,    etiqueta: 'Ordenar palabras',  desc: 'Arma la oración palabra a palabra' },
  { valor: 'sopa_letras',        Icono: IconBarChart,    etiqueta: 'Sopa de letras',    desc: 'Encuentra las palabras en la cuadrícula' },
];

// ─── Componente de imagen ────────────────────────────────────────────────────

function SubirImagen({ imagen, onChange }) {
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert('La imagen no puede pesar más de 1 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }
  return (
    <div style={{ marginTop: 8 }}>
      {imagen ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <img src={imagen} alt="" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 8, border: '1px solid #e0e0e0' }} />
          <button type="button" onClick={() => onChange(null)} style={ed.btnQuitarImg}>× Quitar imagen</button>
        </div>
      ) : (
        <label style={ed.labelImagen}>
          Añadir imagen (opcional)
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );
}

// ─── Editores por tipo ───────────────────────────────────────────────────────

function EditorOpcionMultiple({ contenido, onChange }) {
  const c = contenido || { preguntas: [nuevaPreg(Date.now())] };

  function nuevaPreg(id) {
    return { id, pregunta: '', imagen: null, opciones: [
      { id: 1, texto: '', correcto: true  },
      { id: 2, texto: '', correcto: false },
      { id: 3, texto: '', correcto: false },
      { id: 4, texto: '', correcto: false },
    ]};
  }

  function agregar() { onChange({ ...c, preguntas: [...c.preguntas, nuevaPreg(Date.now())] }); }
  function eliminar(pid) { onChange({ ...c, preguntas: c.preguntas.filter(p => p.id !== pid) }); }
  function upd(pid, cambios) { onChange({ ...c, preguntas: c.preguntas.map(p => p.id === pid ? { ...p, ...cambios } : p) }); }
  function updOpcion(pid, oidx, campo, valor) {
    const preg = c.preguntas.find(p => p.id === pid);
    const ops = preg.opciones.map((o, i) =>
      campo === 'correcto' ? { ...o, correcto: i === oidx } : (i === oidx ? { ...o, [campo]: valor } : o)
    );
    upd(pid, { opciones: ops });
  }

  return (
    <div style={ed.bloque}>
      {c.preguntas.map((p, pi) => (
        <div key={p.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Pregunta {pi + 1}</span>
            {c.preguntas.length > 1 && <button type="button" onClick={() => eliminar(p.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <textarea value={p.pregunta} onChange={e => upd(p.id, { pregunta: e.target.value })}
            placeholder="Escribe la pregunta..." style={ed.textarea} rows={2} required />
          <SubirImagen imagen={p.imagen} onChange={img => upd(p.id, { imagen: img })} />
          <div style={{ marginTop: 10 }}>
            {p.opciones.map((op, i) => (
              <div key={op.id} style={ed.opcionFila}>
                <input type="radio" name={`corr_${p.id}`} checked={op.correcto} onChange={() => updOpcion(p.id, i, 'correcto', true)} />
                <span style={ed.letraOpcion}>{String.fromCharCode(65 + i)}</span>
                <input type="text" value={op.texto} onChange={e => updOpcion(p.id, i, 'texto', e.target.value)}
                  placeholder={`Opción ${String.fromCharCode(65 + i)}`} style={{ ...ed.input, flex: 1 }} required />
              </div>
            ))}
          </div>
          <p style={ed.ayuda}>El círculo marcado = respuesta correcta</p>
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar pregunta</button>
    </div>
  );
}

function EditorVerdaderoFalso({ contenido, onChange }) {
  const c = contenido || { afirmaciones: [{ id: Date.now(), texto: '', correcto: true, imagen: null }] };
  function agregar() { onChange({ ...c, afirmaciones: [...c.afirmaciones, { id: Date.now(), texto: '', correcto: true, imagen: null }] }); }
  function eliminar(id) { onChange({ ...c, afirmaciones: c.afirmaciones.filter(a => a.id !== id) }); }
  function upd(id, campo, valor) { onChange({ ...c, afirmaciones: c.afirmaciones.map(a => a.id === id ? { ...a, [campo]: valor } : a) }); }
  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>Escribe cada afirmación y marca si es Verdadera o Falsa.</p>
      {c.afirmaciones.map((af, i) => (
        <div key={af.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Afirmación {i + 1}</span>
            {c.afirmaciones.length > 1 && <button type="button" onClick={() => eliminar(af.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <div style={ed.opcionFila}>
            <input type="text" value={af.texto} onChange={e => upd(af.id, 'texto', e.target.value)}
              placeholder="Escribe la afirmación..." style={{ ...ed.input, flex: 1 }} required />
            <select value={af.correcto ? 'true' : 'false'} onChange={e => upd(af.id, 'correcto', e.target.value === 'true')} style={ed.selectPequeno}>
              <option value="true">Verdadero</option>
              <option value="false">Falso</option>
            </select>
          </div>
          <SubirImagen imagen={af.imagen} onChange={img => upd(af.id, 'imagen', img)} />
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar afirmación</button>
    </div>
  );
}

function EditorOrdenarPasos({ contenido, onChange }) {
  const c = contenido || { instruccion: '', pasos: [{ id: Date.now(), texto: '', orden: 1 }] };
  function agregar() { onChange({ ...c, pasos: [...c.pasos, { id: Date.now(), texto: '', orden: c.pasos.length + 1 }] }); }
  function eliminar(id) { const pasos = c.pasos.filter(p => p.id !== id).map((p, i) => ({ ...p, orden: i + 1 })); onChange({ ...c, pasos }); }
  function upd(id, texto) { onChange({ ...c, pasos: c.pasos.map(p => p.id === id ? { ...p, texto } : p) }); }
  return (
    <div style={ed.bloque}>
      <label style={ed.label}>Instrucción general</label>
      <input type="text" value={c.instruccion} onChange={e => onChange({ ...c, instruccion: e.target.value })}
        placeholder="Ej: Ordena los pasos para preparar un experimento" style={ed.input} />
      <label style={{ ...ed.label, marginTop: 14 }}>Pasos en orden correcto</label>
      <p style={ed.ayuda}>Escríbelos en el orden correcto — el sistema los mezclará para el estudiante.</p>
      {c.pasos.map((p, i) => (
        <div key={p.id} style={ed.opcionFila}>
          <span style={ed.numero}>{i + 1}</span>
          <input type="text" value={p.texto} onChange={e => upd(p.id, e.target.value)}
            placeholder={`Paso ${i + 1}`} style={{ ...ed.input, flex: 1 }} required />
          {c.pasos.length > 1 && <button type="button" onClick={() => eliminar(p.id)} style={ed.btnEliminar}>×</button>}
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar paso</button>
    </div>
  );
}

function EditorCompletarEspacios({ contenido, onChange }) {
  const c = contenido || { preguntas: [nuevaPreg(Date.now())] };

  function nuevaPreg(id) { return { id, texto_con_blancos: '', imagen: null, respuestas: [] }; }
  function agregar() { onChange({ ...c, preguntas: [...c.preguntas, nuevaPreg(Date.now())] }); }
  function eliminar(pid) { onChange({ ...c, preguntas: c.preguntas.filter(p => p.id !== pid) }); }
  function upd(pid, cambios) { onChange({ ...c, preguntas: c.preguntas.map(p => p.id === pid ? { ...p, ...cambios } : p) }); }

  function generarBlancos(pid, texto) {
    const matches = texto.match(/\[BLANK\]/g) || [];
    const preg = c.preguntas.find(p => p.id === pid);
    const respuestas = matches.map((_, i) => preg.respuestas[i] || { id: i + 1, respuesta: '' });
    upd(pid, { texto_con_blancos: texto, respuestas });
  }

  function updRespuesta(pid, rid, valor) {
    upd(pid, { respuestas: c.preguntas.find(p => p.id === pid).respuestas.map(r => r.id === rid ? { ...r, respuesta: valor } : r) });
  }

  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>Usa <strong>[BLANK]</strong> donde el estudiante debe completar. Ej: "La fotosíntesis ocurre en el [BLANK]"</p>
      {c.preguntas.map((p, pi) => (
        <div key={p.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Ejercicio {pi + 1}</span>
            {c.preguntas.length > 1 && <button type="button" onClick={() => eliminar(p.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <textarea value={p.texto_con_blancos}
            onChange={e => generarBlancos(p.id, e.target.value)}
            placeholder='Ej: El agua es H[BLANK]O y hierve a [BLANK] grados' style={ed.textarea} rows={3} />
          <SubirImagen imagen={p.imagen} onChange={img => upd(p.id, { imagen: img })} />
          {p.respuestas.map((r, i) => (
            <div key={r.id} style={ed.opcionFila}>
              <span style={ed.etiquetaEspacio}>Blanco {i + 1}:</span>
              <input type="text" value={r.respuesta} onChange={e => updRespuesta(p.id, r.id, e.target.value)}
                placeholder="Respuesta correcta" style={{ ...ed.input, flex: 1 }} required />
            </div>
          ))}
          {p.respuestas.length === 0 && p.texto_con_blancos.includes('[BLANK]') && (
            <p style={{ color: '#f57f17', fontSize: 12 }}>Los campos de respuesta aparecen al escribir [BLANK] en el texto.</p>
          )}
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar ejercicio</button>
    </div>
  );
}

function EditorRelacionarColumnas({ contenido, onChange }) {
  const c = contenido || { columna_a: [{ id: 1, texto: '' }], columna_b: [{ id: 101, texto: '', par_id: 1 }] };
  function agregarPar() {
    const idA = Date.now(); const idB = Date.now() + 1;
    onChange({ columna_a: [...c.columna_a, { id: idA, texto: '' }], columna_b: [...c.columna_b, { id: idB, texto: '', par_id: idA }] });
  }
  function eliminarPar(idA) { onChange({ columna_a: c.columna_a.filter(a => a.id !== idA), columna_b: c.columna_b.filter(b => b.par_id !== idA) }); }
  function updA(id, texto) { onChange({ ...c, columna_a: c.columna_a.map(a => a.id === id ? { ...a, texto } : a) }); }
  function updB(par_id, texto) { onChange({ ...c, columna_b: c.columna_b.map(b => b.par_id === par_id ? { ...b, texto } : b) }); }
  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>Cada fila es un par. El sistema mezclará la columna B para el estudiante.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 13, color: '#555' }}>Columna A</strong>
        <strong style={{ fontSize: 13, color: '#555' }}>Columna B (par)</strong>
        <span />
      </div>
      {c.columna_a.map((a, i) => {
        const b = c.columna_b.find(b => b.par_id === a.id) || {};
        return (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <input type="text" value={a.texto} onChange={e => updA(a.id, e.target.value)} placeholder={`A${i + 1}`} style={ed.input} required />
            <input type="text" value={b.texto || ''} onChange={e => updB(a.id, e.target.value)} placeholder={`B${i + 1}`} style={ed.input} required />
            {c.columna_a.length > 1 && <button type="button" onClick={() => eliminarPar(a.id)} style={ed.btnEliminar}>×</button>}
          </div>
        );
      })}
      <button type="button" onClick={agregarPar} style={ed.btnAgregar}>+ Agregar par</button>
    </div>
  );
}

function EditorOrdenarLetras({ contenido, onChange }) {
  const c = contenido || { palabras: [{ id: Date.now(), palabra: '', pista: '' }] };
  function agregar() { onChange({ ...c, palabras: [...c.palabras, { id: Date.now(), palabra: '', pista: '' }] }); }
  function eliminar(id) { onChange({ ...c, palabras: c.palabras.filter(p => p.id !== id) }); }
  function upd(id, campo, valor) { onChange({ ...c, palabras: c.palabras.map(p => p.id === id ? { ...p, [campo]: valor } : p) }); }
  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>El estudiante verá las letras mezcladas y deberá ordenarlas para formar la palabra correcta.</p>
      {c.palabras.map((p, i) => (
        <div key={p.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Palabra {i + 1}</span>
            {c.palabras.length > 1 && <button type="button" onClick={() => eliminar(p.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={ed.label}>Palabra *</label>
              <input type="text" value={p.palabra} onChange={e => upd(p.id, 'palabra', e.target.value)}
                placeholder="Ej: FOTOSÍNTESIS" style={ed.input} required />
            </div>
            <div>
              <label style={ed.label}>Pista (opcional)</label>
              <input type="text" value={p.pista} onChange={e => upd(p.id, 'pista', e.target.value)}
                placeholder="Ej: Proceso de las plantas" style={ed.input} />
            </div>
          </div>
          {p.palabra && (
            <p style={ed.ayuda}>Letras a mezclar: {p.palabra.toUpperCase().split('').join(' — ')}</p>
          )}
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar palabra</button>
    </div>
  );
}

function EditorOrdenarPalabras({ contenido, onChange }) {
  const c = contenido || { oraciones: [{ id: Date.now(), oracion: '', pista: '' }] };
  function agregar() { onChange({ ...c, oraciones: [...c.oraciones, { id: Date.now(), oracion: '', pista: '' }] }); }
  function eliminar(id) { onChange({ ...c, oraciones: c.oraciones.filter(o => o.id !== id) }); }
  function upd(id, campo, valor) { onChange({ ...c, oraciones: c.oraciones.map(o => o.id === id ? { ...o, [campo]: valor } : o) }); }
  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>El estudiante verá las palabras mezcladas y deberá ordenarlas para formar la oración correcta.</p>
      {c.oraciones.map((o, i) => (
        <div key={o.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Oración {i + 1}</span>
            {c.oraciones.length > 1 && <button type="button" onClick={() => eliminar(o.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <label style={ed.label}>Oración en orden correcto *</label>
          <textarea value={o.oracion} onChange={e => upd(o.id, 'oracion', e.target.value)}
            placeholder="Ej: La célula es la unidad básica de la vida" style={ed.textarea} rows={2} required />
          <label style={{ ...ed.label, marginTop: 8 }}>Pista (opcional)</label>
          <input type="text" value={o.pista} onChange={e => upd(o.id, 'pista', e.target.value)}
            placeholder="Pista para el estudiante" style={ed.input} />
          {o.oracion && (
            <p style={ed.ayuda}>Palabras a mezclar: {o.oracion.trim().split(/\s+/).map((p, i) => <span key={i} style={{ display: 'inline-block', background: '#f0f0ff', color: 'var(--color-primario)', borderRadius: 4, padding: '1px 6px', margin: '2px' }}>{p}</span>)}</p>
          )}
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar oración</button>
    </div>
  );
}

function generarGridSopa(palabras, tamano) {
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const grid = Array(tamano).fill(null).map(() => Array(tamano).fill(''));
  const ubicaciones = [];
  const sorted = [...palabras].sort((a, b) => b.palabra.length - a.palabra.length);
  for (const p of sorted) {
    const pal = p.palabra.toUpperCase().replace(/\s/g, '');
    if (pal.length > tamano) return null;
    let ok = false;
    for (let intento = 0; intento < 300 && !ok; intento++) {
      const dir = Math.random() < 0.5 ? 'h' : 'v';
      const fila = dir === 'h' ? Math.floor(Math.random() * tamano) : Math.floor(Math.random() * (tamano - pal.length + 1));
      const col  = dir === 'h' ? Math.floor(Math.random() * (tamano - pal.length + 1)) : Math.floor(Math.random() * tamano);
      let valido = true;
      for (let i = 0; i < pal.length; i++) {
        const r = dir === 'h' ? fila : fila + i;
        const c = dir === 'h' ? col + i : col;
        if (grid[r][c] !== '' && grid[r][c] !== pal[i]) { valido = false; break; }
      }
      if (valido) {
        for (let i = 0; i < pal.length; i++) {
          const r = dir === 'h' ? fila : fila + i;
          const c = dir === 'h' ? col + i : col;
          grid[r][c] = pal[i];
        }
        ubicaciones.push({ id: p.id, fila, col, direccion: dir, longitud: pal.length });
        ok = true;
      }
    }
    if (!ok) return null;
  }
  for (let r = 0; r < tamano; r++)
    for (let c = 0; c < tamano; c++)
      if (grid[r][c] === '') grid[r][c] = LETRAS[Math.floor(Math.random() * 26)];
  return { grid, ubicaciones };
}

function EditorSopaLetras({ contenido, onChange }) {
  const c = contenido || { palabras: [{ id: Date.now(), palabra: '', pista: '' }] };
  const [previa, setPrevia] = useState(null);
  const [errGrid, setErrGrid] = useState('');

  function agregar() { onChange({ ...c, palabras: [...c.palabras, { id: Date.now(), palabra: '', pista: '' }] }); }
  function eliminar(id) { onChange({ ...c, palabras: c.palabras.filter(p => p.id !== id) }); setPrevia(null); }
  function upd(id, campo, valor) { onChange({ ...c, palabras: c.palabras.map(p => p.id === id ? { ...p, [campo]: valor } : p) }); setPrevia(null); }

  function generar() {
    setErrGrid('');
    const validas = c.palabras.filter(p => p.palabra.trim().length >= 2);
    if (validas.length === 0) { setErrGrid('Añade al menos una palabra de 2+ letras.'); return; }
    const maxLen = Math.max(...validas.map(p => p.palabra.length));
    const tamano = Math.max(10, Math.min(15, maxLen + 3));
    const resultado = generarGridSopa(validas, tamano);
    if (!resultado) { setErrGrid('No se pudo ubicar todas las palabras. Prueba con menos palabras o más cortas.'); return; }
    const nuevo = { palabras: validas, grid: resultado.grid, ubicaciones: resultado.ubicaciones, tamano };
    onChange(nuevo);
    setPrevia(nuevo);
  }

  return (
    <div style={ed.bloque}>
      <p style={ed.ayuda}>El estudiante encontrará estas palabras ocultas en la cuadrícula.</p>
      {c.palabras.map((p, i) => (
        <div key={p.id} style={ed.pregBloque}>
          <div style={ed.pregHeader}>
            <span style={ed.pregNum}>Palabra {i + 1}</span>
            {c.palabras.length > 1 && <button type="button" onClick={() => eliminar(p.id)} style={ed.btnElimPreg}>Eliminar</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={ed.label}>Palabra *</label>
              <input type="text" value={p.palabra} onChange={e => upd(p.id, 'palabra', e.target.value.toUpperCase())}
                placeholder="Ej: COLOMBIA" style={ed.input} required />
            </div>
            <div>
              <label style={ed.label}>Pista (opcional)</label>
              <input type="text" value={p.pista} onChange={e => upd(p.id, 'pista', e.target.value)}
                placeholder="Ej: País de América del Sur" style={ed.input} />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={agregar} style={ed.btnAgregar}>+ Agregar palabra</button>
      <button type="button" onClick={generar} style={{ ...ed.btnAgregar, borderColor: 'var(--color-primario)', color: 'var(--color-primario)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <IconRefresh size={14} />Generar / Actualizar sopa
      </button>
      {errGrid && <p style={{ color: '#c62828', fontSize: 12, marginTop: 4 }}>{errGrid}</p>}
      {previa?.grid && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Vista previa ({previa.tamano}×{previa.tamano}):</p>
          <div style={{ overflowX: 'auto' }}>
            {previa.grid.map((fila, r) => (
              <div key={r} style={{ display: 'flex' }}>
                {fila.map((letra, c) => (
                  <span key={c} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: '#444', border: '1px solid #f0f0f0' }}>
                    {letra}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p style={{ ...ed.ayuda, marginTop: 6 }}>Sopa generada. Puedes guardar la actividad.</p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CrearActividad() {
  const navigate = useNavigate();
  const { id: actividadId } = useParams();
  const modoEdicion = Boolean(actividadId);
  const { usuario } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [meta, setMeta] = useState({
    titulo: '', descripcion: '', tipo: 'opcion_multiple',
    materia_id: '', grupo_id: '', periodo: '',
    tiempo_limite_minutos: 30, intentos_permitidos: 3,
  });
  const [contenido, setContenido] = useState(null);
  const [mostrarIA, setMostrarIA] = useState(false);
  const [iaForm, setIAForm] = useState({ tema: '', n_preguntas: '5' });
  const [generandoIA, setGenerandoIA] = useState(false);
  const [mensajeIA, setMensajeIA] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const promesas = [
          axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`),
          axiosAuth.get(`/api/periodos/colegio/${usuario.colegio_id}`),
        ];
        if (modoEdicion) promesas.push(axiosAuth.get(`/api/actividades/${actividadId}`));
        const [rAsig, rPer, rAct] = await Promise.all(promesas);
        const asigs = rAsig.data.data;
        const gIds = new Set(); const mIds = new Set();
        const gruposU = []; const materiasU = [];
        for (const a of asigs) {
          if (!gIds.has(a.grupo_id)) { gIds.add(a.grupo_id); gruposU.push({ id: a.grupo_id, nombre: a.nombre_grupo, grado: a.grado }); }
          if (!mIds.has(a.materia_id)) { mIds.add(a.materia_id); materiasU.push({ id: a.materia_id, nombre: a.nombre_materia }); }
        }
        setGrupos(gruposU); setMaterias(materiasU);
        const pers = rPer.data.data || [];
        setPeriodos(pers);
        if (modoEdicion && rAct) {
          const act = rAct.data.data;
          setMeta({
            titulo: act.titulo || '',
            descripcion: act.descripcion || '',
            tipo: act.tipo,
            materia_id: String(act.materia_id),
            grupo_id: String(act.grupo_id),
            periodo: String(act.periodo),
            tiempo_limite_minutos: act.tiempo_limite_minutos,
            intentos_permitidos: act.intentos_permitidos,
          });
          const cont = typeof act.contenido === 'string' ? JSON.parse(act.contenido) : act.contenido;
          setContenido(cont);
        } else {
          const activo = pers.find(p => p.activo);
          if (activo) setMeta(prev => ({ ...prev, periodo: String(activo.numero) }));
        }
      } catch { /* silencioso */ }
    }
    cargar();
  }, [usuario.id, usuario.colegio_id, actividadId, modoEdicion]);

  function cambiarTipo(tipo) { setMeta(prev => ({ ...prev, tipo })); setContenido(null); setMensajeIA(''); }

  const tiposIA = ['opcion_multiple', 'verdadero_falso', 'ordenar_pasos', 'completar_espacios', 'relacionar_columnas'];

  async function generarConIA() {
    if (!iaForm.tema.trim()) return setMensajeIA('Escribe el tema de la actividad');
    if (!meta.grupo_id) return setMensajeIA('Selecciona primero el grupo');
    if (!tiposIA.includes(meta.tipo)) return setMensajeIA('El generador IA no está disponible para este tipo de actividad');
    setGenerandoIA(true); setMensajeIA('');
    try {
      const grupo = grupos.find(g => String(g.id) === String(meta.grupo_id));
      const resp = await axiosAuth.post('/api/actividades/generar-ia', {
        tema: iaForm.tema,
        tipo: meta.tipo,
        grado: grupo?.grado || '6',
        n_preguntas: parseInt(iaForm.n_preguntas) || 5,
      });
      const { contenido: c, titulo } = resp.data.data;
      setContenido(c);
      if (!meta.titulo) setMeta(prev => ({ ...prev, titulo }));
      setMensajeIA('Actividad generada. Revisa el contenido y ajusta si es necesario.');
      setMostrarIA(false);
    } catch (err) {
      setMensajeIA(err.response?.data?.error || 'Error al generar. Intenta de nuevo.');
    } finally {
      setGenerandoIA(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!contenido) return setError('Debes completar el contenido de la actividad');
    if (!meta.grupo_id || !meta.materia_id) return setError('Selecciona grupo y materia');
    if (!meta.periodo) return setError('Debes seleccionar el período académico');
    if (meta.tipo === 'sopa_letras' && !contenido.grid) return setError('Debes generar la sopa de letras antes de guardar');
    setGuardando(true);
    try {
      if (modoEdicion) {
        await axiosAuth.put(`/api/actividades/${actividadId}`, { ...meta, contenido });
        setExito('¡Actividad actualizada! Redirigiendo...');
      } else {
        await axiosAuth.post('/api/actividades', { ...meta, contenido });
        setExito('¡Actividad creada! Redirigiendo...');
      }
      setTimeout(() => navigate('/mis-actividades'), 1400);
    } catch (err) {
      setError(err.response?.data?.error || (modoEdicion ? 'Error al actualizar la actividad' : 'Error al crear la actividad'));
    } finally {
      setGuardando(false);
    }
  }

  const tipoActual = TIPOS.find(t => t.valor === meta.tipo);

  return (
    <div style={es.pagina}>
      <Navbar titulo={modoEdicion ? 'Editar actividad' : 'Crear actividad'} />
      <div style={es.contenido}>
        <button onClick={() => navigate(modoEdicion ? '/mis-actividades' : '/dashboard-docente')} style={es.btnVolver}>
          ← {modoEdicion ? 'Volver a mis actividades' : 'Volver al panel'}
        </button>
        <form onSubmit={handleSubmit}>

          {/* Info básica */}
          <div style={es.card}>
            <h3 style={es.cardTitulo}>Información de la actividad</h3>
            <div style={es.camposGrid}>
              <div style={es.grupo}>
                <label style={es.label}>Título *</label>
                <input type="text" value={meta.titulo} onChange={e => setMeta({ ...meta, titulo: e.target.value })}
                  placeholder="Ej: Quiz de Matemáticas - Fracciones" style={es.input} required />
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Descripción</label>
                <input type="text" value={meta.descripcion} onChange={e => setMeta({ ...meta, descripcion: e.target.value })}
                  placeholder="Descripción opcional" style={es.input} />
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Grupo *</label>
                <select value={meta.grupo_id} onChange={e => setMeta({ ...meta, grupo_id: e.target.value })} style={es.select} required>
                  <option value="">— Selecciona grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
                </select>
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Materia *</label>
                <select value={meta.materia_id} onChange={e => setMeta({ ...meta, materia_id: e.target.value })} style={es.select} required>
                  <option value="">— Selecciona materia —</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Período académico *</label>
                {periodos.length === 0 ? (
                  <div style={es.sinPeriodos}>
                    Sin períodos configurados — pide al administrador que los cree en "Períodos"
                  </div>
                ) : (
                  <select value={meta.periodo} onChange={e => setMeta({ ...meta, periodo: e.target.value })} style={{ ...es.select, borderColor: !meta.periodo ? '#f44336' : '#e8e8e8' }} required>
                    <option value="">— Selecciona período —</option>
                    {periodos.map(p => (
                      <option key={p.id} value={String(p.numero)}>
                        {p.nombre}{p.activo ? ' ✓ activo' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Tiempo límite (min)</label>
                <input type="number" min={5} max={120} value={meta.tiempo_limite_minutos}
                  onChange={e => setMeta({ ...meta, tiempo_limite_minutos: parseInt(e.target.value) })} style={es.input} />
              </div>
              <div style={es.grupo}>
                <label style={es.label}>Intentos permitidos</label>
                <input type="number" min={1} max={5} value={meta.intentos_permitidos}
                  onChange={e => setMeta({ ...meta, intentos_permitidos: parseInt(e.target.value) })} style={es.input} />
              </div>
            </div>
          </div>

          {/* Tipo */}
          <div style={es.card}>
            <h3 style={es.cardTitulo}>
              Tipo de Pregunta
              {modoEdicion && <span style={{ fontSize: 12, color: '#888', fontWeight: 400, marginLeft: 8 }}>(no se puede cambiar al editar)</span>}
            </h3>
            <div style={es.tiposGrid}>
              {TIPOS.map(t => (
                <button key={t.valor} type="button"
                  onClick={() => !modoEdicion && cambiarTipo(t.valor)}
                  style={{
                    ...es.tipoBtn,
                    ...(meta.tipo === t.valor ? es.tipoBtnActivo : {}),
                    ...(modoEdicion && meta.tipo !== t.valor ? { opacity: 0.35, cursor: 'default' } : {}),
                  }}>
                  <t.Icono size={20} style={{ color: meta.tipo === t.valor ? 'var(--color-primario)' : '#999' }} />
                  <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{t.etiqueta}</span>
                  <span style={{ fontSize: 11, color: meta.tipo === t.valor ? 'var(--color-primario)' : '#aaa' }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generador IA */}
          {tiposIA.includes(meta.tipo) && (
            <div style={es.cardIA}>
              <div style={es.cardIAEncabezado}>
                <span style={{ ...es.cardIATitulo, display: 'flex', alignItems: 'center', gap: 6 }}><IconZap size={14} />Generar contenido con Inteligencia Artificial</span>
                <button type="button" onClick={() => setMostrarIA(v => !v)} style={es.btnIAToggle}>
                  {mostrarIA ? 'Cerrar ↑' : 'Usar IA ↓'}
                </button>
              </div>
              {mostrarIA && (
                <div style={es.cardIAForm}>
                  <div style={es.grupo}>
                    <label style={es.label}>Describe el tema de la actividad *</label>
                    <input
                      type="text"
                      value={iaForm.tema}
                      onChange={e => setIAForm(f => ({ ...f, tema: e.target.value }))}
                      placeholder="Ej: Fracciones equivalentes · La célula animal · Verbos en pasado"
                      style={es.input}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={es.grupo}>
                      <label style={es.label}>
                        {{'ordenar_pasos':'Número de pasos','completar_espacios':'Número de frases','relacionar_columnas':'Número de pares'}[meta.tipo] || 'Número de preguntas'}
                      </label>
                      <select value={iaForm.n_preguntas} onChange={e => setIAForm(f => ({ ...f, n_preguntas: e.target.value }))} style={es.select}>
                        {[3,4,5,6,7,8,10].map(n => (
                          <option key={n} value={n}>{n} {{'ordenar_pasos':'pasos','completar_espacios':'frases','relacionar_columnas':'pares'}[meta.tipo] || 'preguntas'}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={generarConIA} disabled={generandoIA} style={es.btnGenerarIA}>
                      {generandoIA ? 'Generando...' : 'Generar actividad'}
                    </button>
                  </div>
                  {mensajeIA && (
                    <div style={{ ...es.mensajeIA, color: mensajeIA.startsWith('Actividad') ? '#2e7d32' : '#c62828', background: mensajeIA.startsWith('Actividad') ? '#e8f5e9' : '#fff0f0' }}>
                      {mensajeIA}
                    </div>
                  )}
                </div>
              )}
              {!mostrarIA && mensajeIA && (
                <div style={{ ...es.mensajeIA, color: mensajeIA.startsWith('Actividad') ? '#2e7d32' : '#c62828', background: mensajeIA.startsWith('Actividad') ? '#e8f5e9' : '#fff0f0' }}>
                  {mensajeIA}
                </div>
              )}
            </div>
          )}

          {/* Editor */}
          <div style={es.card}>
            <h3 style={{ ...es.cardTitulo, display: 'flex', alignItems: 'center', gap: 8 }}>
              {tipoActual && <tipoActual.Icono size={18} style={{ color: 'var(--color-primario)' }} />}
              {tipoActual?.etiqueta}
            </h3>
            {meta.tipo === 'opcion_multiple'    && <EditorOpcionMultiple    contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'verdadero_falso'    && <EditorVerdaderoFalso    contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'ordenar_pasos'      && <EditorOrdenarPasos      contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'completar_espacios' && <EditorCompletarEspacios contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'relacionar_columnas'&& <EditorRelacionarColumnas contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'ordenar_letras'     && <EditorOrdenarLetras     contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'ordenar_palabras'   && <EditorOrdenarPalabras   contenido={contenido} onChange={setContenido} />}
            {meta.tipo === 'sopa_letras'        && <EditorSopaLetras        contenido={contenido} onChange={setContenido} />}
          </div>

          {error && <div style={es.errorBox}>{error}</div>}
          {exito && <div style={es.exitoBox}>{exito}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => navigate(modoEdicion ? '/mis-actividades' : '/dashboard-docente')} style={es.btnCancelar}>Cancelar</button>
            <button type="submit" disabled={guardando} style={es.btnGuardar}>
              {guardando ? 'Guardando...' : (modoEdicion ? '✓ Guardar cambios' : '✓ Crear actividad')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '920px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 20 },
  camposGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  grupo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  input: { padding: '10px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  select: { padding: '10px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' },
  tiposGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 },
  tipoBtn: { background: '#fff', border: '2px solid #e8e8e8', borderRadius: 12, padding: '12px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', fontFamily: 'inherit' },
  tipoBtnActivo: { borderColor: 'var(--color-primario)', background: '#f0f0ff' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  exitoBox: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  btnGuardar: { flex: 1, background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnCancelar: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 10, padding: '14px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', color: '#555' },
  sinPeriodos: { padding: '10px 14px', borderRadius: 8, background: '#fff8e1', border: '1px solid #ffe082', color: '#e65100', fontSize: 13, lineHeight: 1.5 },

  // Generador IA
  cardIA: { background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1.5px solid #c5b8f7', borderRadius: 16, padding: 20, marginBottom: 20 },
  cardIAEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardIATitulo: { fontSize: 14, fontWeight: 700, color: '#5a4fcf' },
  btnIAToggle: { background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cardIAForm: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  btnGenerarIA: { background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  mensajeIA: { padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 },
};

const ed = {
  bloque: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  input: { padding: '10px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  textarea: { padding: '12px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' },
  selectPequeno: { padding: '8px 10px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 13, fontFamily: 'inherit', background: '#fff' },
  opcionFila: { display: 'flex', gap: 8, alignItems: 'center' },
  letraOpcion: { width: 22, height: 22, background: '#f0f0ff', color: 'var(--color-primario)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  numero: { width: 24, height: 24, background: 'var(--color-primario)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  etiquetaEspacio: { fontSize: 13, color: '#666', whiteSpace: 'nowrap', minWidth: 72 },
  pregBloque: { background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  pregHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pregNum: { fontSize: 13, fontWeight: 700, color: 'var(--color-primario)' },
  btnElimPreg: { background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '2px 6px' },
  btnAgregar: { background: 'none', border: '2px dashed #ccc', borderRadius: 8, padding: '8px 16px', color: '#888', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  btnEliminar: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', lineHeight: 1, flexShrink: 0 },
  ayuda: { fontSize: 12, color: '#999', margin: 0 },
  labelImagen: { display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#f9f9f9', border: '1px dashed #ccc', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#888' },
  btnQuitarImg: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
};
