import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const TIPOS = {
  positiva: { label: 'Positiva',  color: '#2e7d32', bg: '#e8f5e9', badge: '#4caf50' },
  mejora:   { label: 'De mejora', color: '#e65100', bg: '#fff3e0', badge: '#ff9800' },
  neutral:  { label: 'Neutral',   color: '#555',    bg: '#f0f0f0', badge: '#9e9e9e' },
};

function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Anotaciones() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargandoRoster, setCargandoRoster] = useState(false);
  const [error, setError] = useState('');

  // Panel de un estudiante
  const [seleccionado, setSeleccionado] = useState(null);
  const [anotaciones, setAnotaciones] = useState([]);
  const [cargandoPanel, setCargandoPanel] = useState(false);
  const [form, setForm] = useState({ tipo: 'positiva', texto: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`)
      .then(resp => {
        const vistos = new Set();
        const unicos = resp.data.data.filter(a => {
          if (vistos.has(a.grupo_id)) return false;
          vistos.add(a.grupo_id);
          return true;
        });
        setGrupos(unicos);
      })
      .catch(() => setError('No se pudieron cargar tus grupos'));
  }, [usuario.id]);

  const cargarRoster = useCallback(() => {
    if (!grupoId) { setEstudiantes([]); return; }
    setCargandoRoster(true); setError('');
    axiosAuth.get(`/api/anotaciones/grupo/${grupoId}/estudiantes`)
      .then(resp => setEstudiantes(resp.data.data))
      .catch(() => setError('No se pudieron cargar los estudiantes de este grupo'))
      .finally(() => setCargandoRoster(false));
  }, [grupoId]);

  useEffect(() => { cargarRoster(); }, [cargarRoster]);

  function abrirPanel(estudiante) {
    setSeleccionado(estudiante);
    setForm({ tipo: 'positiva', texto: '' });
    setCargandoPanel(true);
    axiosAuth.get(`/api/anotaciones/estudiante/${estudiante.id}`)
      .then(resp => setAnotaciones(resp.data.data))
      .catch(() => setAnotaciones([]))
      .finally(() => setCargandoPanel(false));
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setAnotaciones([]);
  }

  async function guardarAnotacion() {
    if (!form.texto.trim() || !seleccionado) return;
    setGuardando(true); setError('');
    try {
      await axiosAuth.post('/api/anotaciones', {
        estudiante_id: seleccionado.id,
        grupo_id: parseInt(grupoId),
        tipo: form.tipo,
        texto: form.texto.trim(),
      });
      setForm({ tipo: 'positiva', texto: '' });
      const resp = await axiosAuth.get(`/api/anotaciones/estudiante/${seleccionado.id}`);
      setAnotaciones(resp.data.data);
      cargarRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la anotación');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarAnotacion(id) {
    if (!window.confirm('¿Eliminar esta anotación?')) return;
    try {
      await axiosAuth.delete(`/api/anotaciones/${id}`);
      setAnotaciones(prev => prev.filter(a => a.id !== id));
      cargarRoster();
    } catch {
      setError('No se pudo eliminar la anotación');
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Anotaciones del estudiante" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard-docente')} style={es.btnVolver}>← Volver al panel</button>

        <p style={es.ayuda}>
          Deja notas puntuales sobre un estudiante — positivas, de mejora o neutrales. Se muestran de inmediato
          al estudiante y a su acudiente en el portal, así que este espacio es visible para la familia.
        </p>

        <div style={es.card}>
          <label style={es.label}>Grupo</label>
          <select value={grupoId} onChange={e => { setGrupoId(e.target.value); cerrarPanel(); }} style={es.select}>
            <option value="">— Selecciona un grupo —</option>
            {grupos.map(g => <option key={g.grupo_id} value={g.grupo_id}>{g.grado}° {g.nombre_grupo || g.grupo}</option>)}
          </select>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}

        {grupoId && (
          <div style={es.card}>
            {cargandoRoster ? (
              <p style={es.textoGris}>Cargando estudiantes...</p>
            ) : estudiantes.length === 0 ? (
              <div style={es.sinDatos}>
                <IconInbox size={40} style={{ color: '#ccc' }} />
                <p>Este grupo no tiene estudiantes registrados.</p>
              </div>
            ) : (
              <div style={es.roster}>
                {estudiantes.map(est => (
                  <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => abrirPanel(est)} style={{ ...es.rosterItem, flex: 1 }}>
                      <span style={es.rosterAvatar}>{formatearApellidoPrimero(est.nombre).charAt(0).toUpperCase()}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{formatearApellidoPrimero(est.nombre)}</span>
                      {est.total_anotaciones > 0 && (
                        <span style={es.rosterBadge}>{est.total_anotaciones}</span>
                      )}
                    </button>
                    <button onClick={() => navigate(`/historial/${est.id}`)} style={es.btnFichaMedica} title="Ver ficha médica e historial">
                      Ficha médica
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel lateral — anotaciones de un estudiante */}
      {seleccionado && (
        <>
          <div onClick={cerrarPanel} style={es.overlay} />
          <div style={es.panel}>
            <div style={es.panelHeader}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>{formatearApellidoPrimero(seleccionado.nombre)}</div>
                <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>Anotaciones</div>
              </div>
              <button onClick={cerrarPanel} style={es.panelCerrar}>✕</button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {/* Nueva anotación */}
              <p style={es.panelSecTitulo}>Nueva anotación</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {Object.entries(TIPOS).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, tipo: key })}
                    style={{
                      ...es.tipoBtn,
                      background: form.tipo === key ? cfg.bg : '#fafafa',
                      color: form.tipo === key ? cfg.color : '#999',
                      borderColor: form.tipo === key ? cfg.badge : '#e0e0e0',
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Escribe la anotación..."
                value={form.texto}
                onChange={e => setForm({ ...form, texto: e.target.value })}
                style={es.textarea}
                rows={3}
              />
              <button
                onClick={guardarAnotacion}
                disabled={guardando || !form.texto.trim()}
                style={{ ...es.btnPrimario, opacity: (guardando || !form.texto.trim()) ? 0.5 : 1 }}
              >
                {guardando ? 'Guardando...' : '+ Agregar anotación'}
              </button>

              {/* Historial */}
              <p style={{ ...es.panelSecTitulo, marginTop: '24px' }}>Historial</p>
              {cargandoPanel ? (
                <p style={es.textoGris}>Cargando...</p>
              ) : anotaciones.length === 0 ? (
                <p style={es.textoGris}>Aún no hay anotaciones para este estudiante.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {anotaciones.map(a => {
                    const cfg = TIPOS[a.tipo] || TIPOS.neutral;
                    const esAutor = a.docente_id === usuario.id;
                    return (
                      <div key={a.id} style={{ ...es.anotacionCard, borderLeft: `4px solid ${cfg.badge}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ ...es.tipoBadge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          {esAutor && (
                            <button onClick={() => eliminarAnotacion(a.id)} style={es.btnEliminar}>Eliminar</button>
                          )}
                        </div>
                        <p style={es.anotacionTexto}>{a.texto}</p>
                        <p style={es.anotacionMeta}>{a.nombre_docente} · {fechaLarga(a.creado_en)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '16px', padding: 0, fontFamily: 'inherit' },
  ayuda: { fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '20px' },
  card: { background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  textoGris: { color: '#888', fontSize: '14px' },
  sinDatos: { textAlign: 'center', color: '#888', padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },

  roster: { display: 'flex', flexDirection: 'column', gap: '6px' },
  rosterItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #f0f0f0', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', color: '#333', textAlign: 'left' },
  rosterAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rosterBadge: { background: '#667eea', color: '#fff', borderRadius: '20px', padding: '1px 9px', fontSize: '11px', fontWeight: '700' },
  btnFichaMedica: { background: '#fff0f0', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '9px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },

  // Panel lateral
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 },
  panel: { position: 'fixed', top: 0, right: 0, width: '420px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' },
  panelCerrar: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' },
  panelSecTitulo: { fontSize: '11px', fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' },

  tipoBtn: { flex: 1, padding: '9px 6px', borderRadius: '8px', border: '2px solid', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '10px' },
  btnPrimario: { width: '100%', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  anotacionCard: { background: '#fafafa', borderRadius: '10px', padding: '12px 14px' },
  tipoBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  anotacionTexto: { fontSize: '13px', color: '#333', margin: '8px 0 6px', lineHeight: 1.5 },
  anotacionMeta: { fontSize: '11px', color: '#aaa', margin: 0 },
  btnEliminar: { background: 'none', border: 'none', color: '#c62828', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600', padding: 0 },
};
