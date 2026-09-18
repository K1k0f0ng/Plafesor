import React, { useEffect, useMemo, useState } from 'react';
import axiosAuth from '../../config/axios';
import { estilos as s, PRIORIDAD } from './comun';

// Ventana para abrir un caso. Con `inicial` (desde una remisión) el estudiante
// ya viene elegido; sin él, se busca entre los estudiantes del colegio.
export default function AbrirCasoModal({ inicial = {}, onCerrar, onAbierto }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [motivos, setMotivos] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [esLider, setEsLider] = useState(false);
  const [form, setForm] = useState({
    estudiante_id: inicial.estudiante_id || '', motivo_id: inicial.motivo_id || '',
    prioridad: inicial.prioridad || 'media', motivo_detalle: '', antecedentes: '', responsable_id: '',
  });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [casoExistente, setCasoExistente] = useState(null);

  useEffect(() => {
    axiosAuth.get('/api/bienestar/catalogos?tipo=motivo_remision')
      .then(r => setMotivos((r.data.data || []).filter(m => m.activo))).catch(() => {});
    axiosAuth.get('/api/bienestar/estado').then(r => {
      const lider = r.data.data?.nivel === 'lider';
      setEsLider(lider);
      if (lider) axiosAuth.get('/api/bienestar/equipo/miembros').then(m => setMiembros(m.data.data || [])).catch(() => {});
    }).catch(() => {});
    if (!inicial.estudiante_id) {
      axiosAuth.get('/api/bienestar/remisiones/estudiantes').then(r => setEstudiantes(r.data.data || [])).catch(() => {});
    }
  }, [inicial.estudiante_id]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? estudiantes.filter(e => `${e.nombre} ${e.grado} ${e.grupo}`.toLowerCase().includes(q)) : estudiantes;
  }, [busqueda, estudiantes]);

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setError(''); setCasoExistente(null);
    if (!form.estudiante_id) return setError('Selecciona el estudiante');
    if (!form.motivo_id) return setError('Selecciona el motivo');
    setOcupado(true);
    try {
      const r = await axiosAuth.post('/api/bienestar/casos', {
        ...form,
        estudiante_id: parseInt(form.estudiante_id),
        motivo_id: parseInt(form.motivo_id),
        responsable_id: form.responsable_id ? parseInt(form.responsable_id) : undefined,
        remision_id: inicial.remision_id || undefined,
      });
      onAbierto(r.data.data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir el caso');
      if (err.response?.data?.caso_id) setCasoExistente(err.response.data.caso_id);
      setOcupado(false);
    }
  }

  return (
    <>
      <div style={s.fondoModal} onClick={onCerrar} />
      <form style={s.modal} onSubmit={guardar} role="dialog" aria-label="Abrir caso">
        <h3 style={s.modalTitulo}>Abrir caso de orientación</h3>

        <div style={s.campo}>
          <label style={s.label}>Estudiante *</label>
          {inicial.estudiante_id ? (
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>{inicial.estudiante}</div>
          ) : (
            <>
              <input style={s.input} placeholder="Buscar por nombre o grupo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              <select style={{ ...s.input, marginTop: '6px' }} value={form.estudiante_id} onChange={set('estudiante_id')}>
                <option value="">— Selecciona ({filtrados.length}) —</option>
                {filtrados.map(e => <option key={e.id} value={e.id}>{e.nombre} · {e.grado}° {e.grupo}</option>)}
              </select>
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' }}>
          <div style={s.campo}>
            <label style={s.label}>Motivo *</label>
            <select style={s.input} value={form.motivo_id} onChange={set('motivo_id')}>
              <option value="">— Selecciona —</option>
              {motivos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Prioridad *</label>
            <select style={s.input} value={form.prioridad} onChange={set('prioridad')}>
              {Object.entries(PRIORIDAD).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
          </div>
        </div>

        {esLider && miembros.length > 1 && (
          <div style={s.campo}>
            <label style={s.label}>Responsable</label>
            <select style={s.input} value={form.responsable_id} onChange={set('responsable_id')}>
              <option value="">Yo</option>
              {miembros.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.nivel === 'lider' ? ' (líder)' : ''}</option>)}
            </select>
          </div>
        )}

        <div style={s.campo}>
          <label style={s.label}>Detalle del motivo</label>
          <textarea style={{ ...s.input, minHeight: '80px', resize: 'vertical' }} maxLength={4000}
            value={form.motivo_detalle} onChange={set('motivo_detalle')} placeholder="Situación que origina el caso, en términos de hechos." />
        </div>
        <div style={s.campo}>
          <label style={s.label}>Antecedentes relevantes</label>
          <textarea style={{ ...s.input, minHeight: '70px', resize: 'vertical' }} maxLength={4000}
            value={form.antecedentes} onChange={set('antecedentes')} placeholder="Solo lo necesario para el acompañamiento." />
        </div>

        {error && (
          <div style={s.errorBox}>
            {error}
            {casoExistente && (
              <button type="button" onClick={() => onAbierto(casoExistente)} style={{ ...s.btnSecundario, marginLeft: '10px', padding: '6px 12px' }}>
                Ir al caso abierto
              </button>
            )}
          </div>
        )}

        <div style={s.botones}>
          <button type="button" onClick={onCerrar} style={s.btnSecundario}>Cancelar</button>
          <button type="submit" disabled={ocupado} style={s.btnPrimario}>{ocupado ? 'Abriendo...' : 'Abrir caso'}</button>
        </div>
      </form>
    </>
  );
}
