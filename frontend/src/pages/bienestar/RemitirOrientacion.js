import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { IconAlertTriangle } from '../../components/Icons';

// Formulario de remisión a orientación (docente, director, orientador).
const PRIORIDADES = [
  { valor: 'baja',    nombre: 'Baja',    desc: 'Puede esperar a la próxima revisión.' },
  { valor: 'media',   nombre: 'Media',   desc: 'Conviene revisarla esta semana.' },
  { valor: 'alta',    nombre: 'Alta',    desc: 'Requiere atención en los próximos días.' },
  { valor: 'urgente', nombre: 'Urgente', desc: 'Avisa de inmediato a todo el equipo de orientación.' },
];

const FORM_VACIO = { estudiante_id: '', motivo_id: '', prioridad: 'media', descripcion: '', observaciones: '', familia_informada: '' };

export default function RemitirOrientacion() {
  const navigate = useNavigate();
  const [estudiantes, setEstudiantes] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviada, setEnviada] = useState(false);
  const [permiteAdjuntos, setPermiteAdjuntos] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [avisoAdjuntos, setAvisoAdjuntos] = useState('');

  useEffect(() => {
    Promise.all([
      axiosAuth.get('/api/bienestar/remisiones/estudiantes'),
      axiosAuth.get('/api/bienestar/catalogos?tipo=motivo_remision'),
      axiosAuth.get('/api/bienestar/estado'),
    ])
      .then(([rE, rM, rS]) => {
        setEstudiantes(rE.data.data || []);
        setMotivos((rM.data.data || []).filter(m => m.activo));
        setPermiteAdjuntos(!!rS.data.data?.adjuntos_remision);
      })
      .catch(err => setError(err.response?.data?.error || 'No se pudo cargar el formulario'))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return estudiantes;
    return estudiantes.filter(e => `${e.nombre} ${e.grado} ${e.grupo}`.toLowerCase().includes(q));
  }, [busqueda, estudiantes]);

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!form.estudiante_id) return setError('Selecciona el estudiante');
    if (!form.motivo_id) return setError('Selecciona el motivo');
    if (form.descripcion.trim().length < 10) return setError('Describe lo observado (mínimo 10 caracteres)');
    setEnviando(true);
    setAvisoAdjuntos('');
    try {
      const r = await axiosAuth.post('/api/bienestar/remisiones', {
        ...form,
        estudiante_id: parseInt(form.estudiante_id),
        motivo_id: parseInt(form.motivo_id),
        familia_informada: form.familia_informada === '' ? null : form.familia_informada === 'si',
      });
      if (archivos.length) {
        const datos = new FormData();
        archivos.forEach(a => datos.append('archivos', a));
        try {
          await axiosAuth.post(`/api/bienestar/remisiones/${r.data.data.id}/adjuntos`, datos, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (err) {
          // La remisión ya quedó enviada; solo fallaron los archivos
          setAvisoAdjuntos(err.response?.data?.error || 'La remisión se envió, pero no se pudieron adjuntar los archivos.');
        }
      }
      setEnviada(true);
      setForm(FORM_VACIO);
      setArchivos([]);
      setBusqueda('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar la remisión');
    } finally {
      setEnviando(false);
    }
  }

  if (enviada) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Remitir a orientación" />
        <div style={es.contenido}>
          <div style={{ ...es.card, textAlign: 'center' }}>
            <div style={es.check}>✓</div>
            <h3 style={es.cardTitulo}>Remisión enviada a orientación</h3>
            <p style={es.ayuda}>Recibirás una notificación cuando orientación la reciba. Puedes consultar su estado en “Mis remisiones”.</p>
            {avisoAdjuntos && <div style={es.errorBox}>{avisoAdjuntos}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
              <button onClick={() => setEnviada(false)} style={es.btnSecundario}>Remitir otro estudiante</button>
              <button onClick={() => navigate('/bienestar/mis-remisiones')} style={es.btnPrimario}>Ver mis remisiones</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Remitir a orientación" />
      <div style={es.contenido}>
        <div style={es.avisoRiesgo}>
          <IconAlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>
            <strong>Si hay riesgo inminente para el estudiante</strong>, activa de inmediato la ruta de atención del colegio
            (coordinación, rectoría o las líneas de emergencia). Esta remisión no la reemplaza.
          </span>
        </div>

        <form onSubmit={enviar} style={es.card}>
          <h3 style={es.cardTitulo}>Nueva remisión</h3>
          <p style={es.ayuda}>Lo que escribas solo lo verá el equipo de orientación. Tú podrás consultar el estado de la remisión.</p>

          {cargando ? <p style={es.ayuda}>Cargando...</p> : (
            <>
              <div style={es.campo}>
                <label style={es.label}>Estudiante *</label>
                {estudiantes.length === 0 ? (
                  <div style={es.vacio}>No tienes estudiantes asignados a quienes remitir.</div>
                ) : (
                  <>
                    <input style={es.input} placeholder="Buscar por nombre o grupo..." value={busqueda}
                      onChange={e => setBusqueda(e.target.value)} />
                    <select style={{ ...es.input, marginTop: '6px' }} value={form.estudiante_id} onChange={set('estudiante_id')}>
                      <option value="">— Selecciona ({filtrados.length}) —</option>
                      {filtrados.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre} · {e.grado}° {e.grupo}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div style={es.campo}>
                <label style={es.label}>Motivo *</label>
                <select style={es.input} value={form.motivo_id} onChange={set('motivo_id')}>
                  <option value="">— Selecciona —</option>
                  {motivos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>

              <div style={es.campo}>
                <label style={es.label}>Prioridad *</label>
                <div style={es.prioridades}>
                  {PRIORIDADES.map(p => (
                    <label key={p.valor} style={{ ...es.prioridad, ...(form.prioridad === p.valor ? es.prioridadActiva : {}), ...(p.valor === 'urgente' && form.prioridad === p.valor ? es.prioridadUrgente : {}) }}>
                      <input type="radio" name="prioridad" value={p.valor} checked={form.prioridad === p.valor}
                        onChange={set('prioridad')} style={{ display: 'none' }} />
                      <strong>{p.nombre}</strong>
                      <span style={es.prioridadDesc}>{p.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={es.campo}>
                <label style={es.label}>¿Qué observaste? *</label>
                <div style={es.guia}>
                  Describe <strong>hechos concretos</strong> y desde cuándo, no conclusiones.
                  <br />✓ “Desde hace 3 semanas no entrega tareas y se aísla en el descanso.”
                  <br />✗ “Está deprimido.” / “Tiene problemas en la casa.”
                </div>
                <textarea style={{ ...es.input, minHeight: '130px', resize: 'vertical' }} maxLength={4000}
                  value={form.descripcion} onChange={set('descripcion')} />
                <span style={es.contador}>{form.descripcion.length} / 4000</span>
              </div>

              <div style={es.campo}>
                <label style={es.label}>Observaciones adicionales</label>
                <textarea style={{ ...es.input, minHeight: '70px', resize: 'vertical' }} maxLength={2000}
                  value={form.observaciones} onChange={set('observaciones')}
                  placeholder="Qué has intentado en el aula, con quién lo has hablado..." />
              </div>

              <div style={es.campo}>
                <label style={es.label}>¿La familia está enterada?</label>
                <select style={es.input} value={form.familia_informada} onChange={set('familia_informada')}>
                  <option value="">No sé / prefiero no indicar</option>
                  <option value="si">Sí, la familia está enterada</option>
                  <option value="no">No, la familia no ha sido informada</option>
                </select>
              </div>

              {permiteAdjuntos && (
                <div style={es.campo}>
                  <label style={es.label}>Evidencias (opcional)</label>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx"
                    onChange={e => setArchivos(Array.from(e.target.files || []).slice(0, 5))} />
                  <span style={es.contador}>
                    {archivos.length ? `${archivos.length} archivo(s) · ` : ''}Máximo 5 archivos de 5 MB. Solo los verá orientación.
                  </span>
                </div>
              )}

              {error && <div style={es.errorBox}>{error}</div>}

              <div style={es.botones}>
                <button type="button" onClick={() => navigate('/bienestar/mis-remisiones')} style={es.btnSecundario}>Mis remisiones</button>
                <button type="submit" disabled={enviando || estudiantes.length === 0} style={es.btnPrimario}>
                  {enviando ? 'Enviando...' : 'Enviar a orientación'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '760px', margin: '0 auto', width: '100%' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '18px', fontWeight: 700, color: '#333', margin: '0 0 6px' },
  ayuda: { fontSize: '13px', color: '#888', margin: '0 0 16px', lineHeight: 1.5 },
  avisoRiesgo: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fff3e0', border: '1px solid #ffcc80', color: '#8a4b00', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' },
  label: { fontSize: '13px', fontWeight: 700, color: '#555' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff', width: '100%' },
  guia: { background: '#f7f8ff', border: '1px solid #e6e8fb', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#555', lineHeight: 1.6 },
  contador: { fontSize: '11px', color: '#aaa', alignSelf: 'flex-end' },
  prioridades: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '8px' },
  prioridad: { display: 'flex', flexDirection: 'column', gap: '2px', border: '1.5px solid #e6e8f0', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: '#444' },
  prioridadActiva: { border: '1.5px solid #667eea', background: '#f3f4ff' },
  prioridadUrgente: { border: '1.5px solid #e53935', background: '#fff1f1' },
  prioridadDesc: { fontSize: '11.5px', color: '#999', lineHeight: 1.4 },
  vacio: { background: '#fafbff', border: '1px dashed #dde0f0', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#888' },
  botones: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '11px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
  check: { width: '56px', height: '56px', borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', fontSize: '28px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
};
