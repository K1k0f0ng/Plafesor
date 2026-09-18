import React, { useEffect, useState } from 'react';
import axiosAuth from '../../../config/axios';
import { fecha, ahoraLocal, fechaCorta, RESPONSABLE_COMPROMISO, estilos as s } from '../comun';

// Pestaña de seguimientos: registrar, editar (solo el autor) y ver notas privadas.

const COMPROMISO_VACIO = { descripcion: '', responsable_tipo: 'estudiante', fecha_limite: '', visible_familia: false };

function formularioDesde(seg) {
  if (!seg) {
    return {
      fecha: ahoraLocal(), tipo_id: '', participantes: '', motivo: '', resumen: '', acuerdos: '',
      proxima_accion: '', proxima_fecha: '', nota_privada: '', compromisos: [],
    };
  }
  return {
    fecha: String(seg.fecha).replace(' ', 'T').slice(0, 16), tipo_id: seg.tipo_id || '',
    participantes: (seg.participantes || []).join(', '), motivo: seg.motivo || '', resumen: seg.resumen || '',
    acuerdos: seg.acuerdos || '', proxima_accion: seg.proxima_accion || '', proxima_fecha: fechaCorta(seg.proxima_fecha),
    nota_privada: '', compromisos: [],
  };
}

function FormularioSeguimiento({ casoId, tipos, seguimiento, onGuardado, onCancelar }) {
  const [f, setF] = useState(formularioDesde(seguimiento));
  const [notaCargada, setNotaCargada] = useState(!seguimiento?.tiene_nota_privada);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const set = (campo) => (e) => setF(x => ({ ...x, [campo]: e.target.value }));

  // Al editar, la nota privada solo se carga si el autor la pide (queda en bitácora)
  async function cargarNota() {
    try {
      const r = await axiosAuth.get(`/api/bienestar/seguimientos/${seguimiento.id}/nota-privada`);
      setF(x => ({ ...x, nota_privada: r.data.data.nota_privada || '' }));
      setNotaCargada(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar la nota privada');
    }
  }

  function cambiarCompromiso(i, campo, valor) {
    setF(x => ({ ...x, compromisos: x.compromisos.map((k, j) => j === i ? { ...k, [campo]: valor } : k) }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!f.tipo_id) return setError('Selecciona el tipo de seguimiento');
    if (!f.resumen.trim()) return setError('El resumen profesional es obligatorio');
    const cuerpo = {
      fecha: f.fecha, tipo_id: parseInt(f.tipo_id),
      participantes: f.participantes.split(',').map(p => p.trim()).filter(Boolean),
      motivo: f.motivo, resumen: f.resumen, acuerdos: f.acuerdos,
      proxima_accion: f.proxima_accion, proxima_fecha: f.proxima_fecha || null,
    };
    if (!seguimiento || notaCargada) cuerpo.nota_privada = f.nota_privada;
    if (!seguimiento) cuerpo.compromisos = f.compromisos.filter(k => k.descripcion.trim()).map(k => ({ ...k, fecha_limite: k.fecha_limite || null }));
    setOcupado(true);
    try {
      if (seguimiento) await axiosAuth.patch(`/api/bienestar/seguimientos/${seguimiento.id}`, cuerpo);
      else await axiosAuth.post(`/api/bienestar/casos/${casoId}/seguimientos`, cuerpo);
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el seguimiento');
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar} style={es.formulario}>
      <h4 style={es.formTitulo}>{seguimiento ? 'Editar seguimiento' : 'Nuevo seguimiento'}</h4>
      <div style={es.fila2}>
        <div style={s.campo}>
          <label style={s.label}>Fecha y hora *</label>
          <input type="datetime-local" style={s.input} value={f.fecha} onChange={set('fecha')} required />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Tipo *</label>
          <select style={s.input} value={f.tipo_id} onChange={set('tipo_id')}>
            <option value="">— Selecciona —</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      </div>
      <div style={s.campo}>
        <label style={s.label}>Participantes</label>
        <input style={s.input} value={f.participantes} onChange={set('participantes')} placeholder="Separados por coma. Ej: Estudiante, Madre, Docente de matemáticas" />
      </div>
      <div style={s.campo}>
        <label style={s.label}>Motivo del encuentro</label>
        <input style={s.input} value={f.motivo} onChange={set('motivo')} maxLength={4000} />
      </div>
      <div style={s.campo}>
        <label style={s.label}>Resumen profesional * <span style={es.pista}>(lo ve el equipo asignado al caso)</span></label>
        <textarea style={{ ...s.input, minHeight: '110px', resize: 'vertical' }} value={f.resumen} onChange={set('resumen')} maxLength={4000} />
      </div>
      <div style={s.campo}>
        <label style={s.label}>Acuerdos</label>
        <textarea style={{ ...s.input, minHeight: '60px', resize: 'vertical' }} value={f.acuerdos} onChange={set('acuerdos')} maxLength={4000} />
      </div>
      <div style={es.fila2}>
        <div style={s.campo}>
          <label style={s.label}>Próxima acción</label>
          <input style={s.input} value={f.proxima_accion} onChange={set('proxima_accion')} maxLength={4000} />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Próxima fecha</label>
          <input type="date" style={s.input} value={f.proxima_fecha} onChange={set('proxima_fecha')} />
        </div>
      </div>

      <div style={es.cajaPrivada}>
        <label style={s.label}>🔒 Nota privada <span style={es.pista}>(solo tú y quienes estén asignados al caso)</span></label>
        {notaCargada ? (
          <textarea style={{ ...s.input, minHeight: '70px', resize: 'vertical', background: '#fffdf5' }} value={f.nota_privada} onChange={set('nota_privada')} maxLength={8000} />
        ) : (
          <button type="button" onClick={cargarNota} style={s.btnSecundario}>Cargar nota privada para editarla</button>
        )}
      </div>

      {!seguimiento && (
        <div style={{ marginTop: '14px' }}>
          <label style={s.label}>Compromisos de este seguimiento</label>
          {f.compromisos.map((k, i) => (
            <div key={i} style={es.compromiso}>
              <input style={{ ...s.input, flex: '2 1 220px' }} placeholder="Compromiso" maxLength={500}
                value={k.descripcion} onChange={e => cambiarCompromiso(i, 'descripcion', e.target.value)} />
              <select style={{ ...s.input, flex: '1 1 130px' }} value={k.responsable_tipo} onChange={e => cambiarCompromiso(i, 'responsable_tipo', e.target.value)}>
                {Object.entries(RESPONSABLE_COMPROMISO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
              <input type="date" style={{ ...s.input, flex: '1 1 140px' }} value={k.fecha_limite} onChange={e => cambiarCompromiso(i, 'fecha_limite', e.target.value)} />
              <button type="button" onClick={() => setF(x => ({ ...x, compromisos: x.compromisos.filter((_, j) => j !== i) }))} style={es.quitar} aria-label="Quitar compromiso">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setF(x => ({ ...x, compromisos: [...x.compromisos, { ...COMPROMISO_VACIO }] }))} style={{ ...s.btnSecundario, padding: '7px 12px', fontSize: '13px' }}>
            + Agregar compromiso
          </button>
        </div>
      )}

      {error && <div style={{ ...s.errorBox, marginTop: '12px' }}>{error}</div>}
      <div style={s.botones}>
        <button type="button" onClick={onCancelar} style={s.btnSecundario}>Cancelar</button>
        <button type="submit" disabled={ocupado} style={s.btnPrimario}>{ocupado ? 'Guardando...' : 'Guardar seguimiento'}</button>
      </div>
    </form>
  );
}

function TarjetaSeguimiento({ seg, onEditar, editable }) {
  const [nota, setNota] = useState(null);
  const [error, setError] = useState('');

  async function verNota() {
    try {
      const r = await axiosAuth.get(`/api/bienestar/seguimientos/${seg.id}/nota-privada`);
      setNota(r.data.data.nota_privada || '');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir la nota privada');
    }
  }

  return (
    <div style={es.tarjeta}>
      <div style={es.tarjetaCabecera}>
        <div>
          <div style={es.tarjetaTitulo}>{seg.tipo || 'Seguimiento'}</div>
          <div style={es.meta}>{fecha(seg.fecha, true)}{seg.autor ? ` · ${seg.autor}` : ''}</div>
        </div>
        {editable && seg.puede_editar && <button onClick={() => onEditar(seg)} style={es.btnMini}>Editar</button>}
      </div>
      {seg.participantes?.length > 0 && <Linea titulo="Participantes">{seg.participantes.join(', ')}</Linea>}
      {seg.motivo && <Linea titulo="Motivo">{seg.motivo}</Linea>}
      <Linea titulo="Resumen">{seg.resumen}</Linea>
      {seg.acuerdos && <Linea titulo="Acuerdos">{seg.acuerdos}</Linea>}
      {(seg.proxima_accion || seg.proxima_fecha) && (
        <Linea titulo="Próxima acción">{seg.proxima_accion}{seg.proxima_fecha ? ` (${fecha(seg.proxima_fecha)})` : ''}</Linea>
      )}
      {seg.tiene_nota_privada && (
        <div style={es.cajaPrivada}>
          {nota !== null ? (
            <><div style={es.lineaTitulo}>🔒 Nota privada</div><div style={es.lineaTexto}>{nota}</div></>
          ) : seg.puede_ver_nota ? (
            <button onClick={verNota} style={es.btnMini}>🔒 Ver nota privada (quedará registrado)</button>
          ) : (
            <span style={es.pista}>🔒 Tiene nota privada. Solo la ven su autor y quienes están asignados al caso.</span>
          )}
          {error && <div style={{ ...s.errorBox, marginTop: '8px' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function Linea({ titulo, children }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={es.lineaTitulo}>{titulo}</div>
      <div style={es.lineaTexto}>{children}</div>
    </div>
  );
}

export default function Seguimientos({ caso, onCambio }) {
  const [tipos, setTipos] = useState([]);
  const [editando, setEditando] = useState(null);   // null | 'nuevo' | seguimiento

  useEffect(() => {
    axiosAuth.get('/api/bienestar/catalogos?tipo=tipo_seguimiento')
      .then(r => setTipos((r.data.data || []).filter(t => t.activo))).catch(() => {});
  }, []);

  const editable = caso.permisos.editable;
  return (
    <div>
      {editable && !editando && (
        <button onClick={() => setEditando('nuevo')} style={{ ...s.btnPrimario, marginBottom: '14px' }}>+ Nuevo seguimiento</button>
      )}
      {editando && (
        <FormularioSeguimiento
          casoId={caso.id} tipos={tipos} seguimiento={editando === 'nuevo' ? null : editando}
          onCancelar={() => setEditando(null)} onGuardado={() => { setEditando(null); onCambio(); }}
        />
      )}
      {caso.seguimientos.length === 0 && !editando && <div style={es.vacio}>Aún no hay seguimientos registrados.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {caso.seguimientos.map(seg => (
          <TarjetaSeguimiento key={seg.id} seg={seg} editable={editable && !editando} onEditar={setEditando} />
        ))}
      </div>
    </div>
  );
}

const es = {
  formulario: { background: '#fafbff', border: '1px solid #e6e8f5', borderRadius: '14px', padding: '16px', marginBottom: '16px' },
  formTitulo: { fontSize: '15px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 12px' },
  fila2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' },
  pista: { fontSize: '11.5px', fontWeight: 500, color: '#999' },
  cajaPrivada: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 12px', marginTop: '10px' },
  compromiso: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' },
  quitar: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '8px', width: '36px', height: '38px', cursor: 'pointer', flexShrink: 0 },
  tarjeta: { background: '#fff', border: '1px solid #eef0f5', borderRadius: '12px', padding: '14px 16px' },
  tarjetaCabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  tarjetaTitulo: { fontSize: '14.5px', fontWeight: 700, color: '#1a1a2e' },
  meta: { fontSize: '12px', color: '#999', marginTop: '2px' },
  lineaTitulo: { fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' },
  lineaTexto: { fontSize: '14px', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '2px' },
  btnMini: { background: '#fff', border: '1px solid #dde0f0', color: '#667eea', borderRadius: '8px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  vacio: { background: '#fafbff', border: '1px dashed #dde0f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#999', fontSize: '14px' },
};
