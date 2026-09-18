import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  color: '#e65100', bg: '#fff3e0' },
  realizada:  { label: 'Realizada',  color: '#2e7d32', bg: '#e8f5e9' },
  cancelada:  { label: 'Cancelada',  color: '#999',    bg: '#f0f0f0' },
};

const PANEL_INICIAL = { home: '/dashboard-docente', director: '/dashboard-director', admin: '/dashboard' };

function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Citaciones() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const rutaPanel = PANEL_INICIAL[usuario.rol] || PANEL_INICIAL.home;

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargandoRoster, setCargandoRoster] = useState(false);
  const [error, setError] = useState('');

  const [seleccionado, setSeleccionado] = useState(null);
  const [citaciones, setCitaciones] = useState([]);
  const [cargandoPanel, setCargandoPanel] = useState(false);
  const [form, setForm] = useState({ motivo: '', fecha_cita: '', hora_cita: '', lugar: '', notificar_whatsapp: true, notificar_mensajeria: false });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');

  useEffect(() => {
    axiosAuth.get('/api/citaciones/mis-grupos')
      .then(resp => setGrupos(resp.data.data))
      .catch(() => setError('No se pudieron cargar tus grupos'));
  }, []);

  const cargarRoster = useCallback(() => {
    if (!grupoId) { setEstudiantes([]); return; }
    setCargandoRoster(true); setError('');
    axiosAuth.get(`/api/citaciones/grupo/${grupoId}/estudiantes`)
      .then(resp => setEstudiantes(resp.data.data))
      .catch(() => setError('No se pudieron cargar los estudiantes de este grupo'))
      .finally(() => setCargandoRoster(false));
  }, [grupoId]);

  useEffect(() => { cargarRoster(); }, [cargarRoster]);

  function abrirPanel(estudiante) {
    setSeleccionado(estudiante);
    setForm({ motivo: '', fecha_cita: '', hora_cita: '', lugar: '', notificar_whatsapp: true, notificar_mensajeria: false });
    setExito('');
    setCargandoPanel(true);
    axiosAuth.get(`/api/citaciones/estudiante/${estudiante.id}`)
      .then(resp => setCitaciones(resp.data.data))
      .catch(() => setCitaciones([]))
      .finally(() => setCargandoPanel(false));
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setCitaciones([]);
  }

  async function enviarCitacion() {
    if (!form.motivo.trim() || !seleccionado) return;
    setGuardando(true); setError(''); setExito('');
    try {
      const resp = await axiosAuth.post('/api/citaciones', {
        estudiante_id: seleccionado.id,
        grupo_id: parseInt(grupoId),
        motivo: form.motivo.trim(),
        fecha_cita: form.fecha_cita || null,
        hora_cita: form.hora_cita || null,
        lugar: form.lugar.trim() || null,
        notificar_whatsapp: form.notificar_whatsapp,
        notificar_mensajeria: form.notificar_mensajeria,
      });
      const { whatsapp_enviado, mensajeria_enviada } = resp.data.data;
      const canales = [];
      if (form.notificar_whatsapp) canales.push(whatsapp_enviado ? 'WhatsApp' : 'WhatsApp (no se pudo enviar — verifica el teléfono registrado)');
      if (form.notificar_mensajeria) canales.push(mensajeria_enviada ? 'Mensajería Interna' : 'Mensajería Interna (no se pudo enviar)');
      setExito(canales.length
        ? `Citación guardada. Notificada por: ${canales.join(' y ')}. También queda visible en el portal del acudiente.`
        : 'Citación guardada. El acudiente la verá en su portal y en la campanita de notificaciones.');
      setForm({ motivo: '', fecha_cita: '', hora_cita: '', lugar: '', notificar_whatsapp: true, notificar_mensajeria: false });
      const historial = await axiosAuth.get(`/api/citaciones/estudiante/${seleccionado.id}`);
      setCitaciones(historial.data.data);
      cargarRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la citación');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      await axiosAuth.patch(`/api/citaciones/${id}/estado`, { estado });
      setCitaciones(prev => prev.map(c => c.id === id ? { ...c, estado } : c));
    } catch {
      setError('No se pudo actualizar la citación');
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Citaciones a acudientes" />
      <div style={es.contenido}>
        <button onClick={() => navigate(rutaPanel)} style={es.btnVolver}>← Volver al panel</button>

        <p style={es.ayuda}>
          Convoca a una reunión al acudiente de un estudiante. Elige por qué canal avisarle además de que
          quede visible en su portal — la campanita de notificaciones siempre se activa.
        </p>

        <div style={es.card}>
          <label style={es.label}>Grupo</label>
          <select value={grupoId} onChange={e => { setGrupoId(e.target.value); cerrarPanel(); }} style={es.select}>
            <option value="">— Selecciona un grupo —</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
          </select>
          {grupos.length === 0 && (
            <p style={{ ...es.textoGris, marginTop: '10px', marginBottom: 0 }}>
              No tienes grupos disponibles para citar. Solo el director de grupo o la dirección del colegio pueden generar citaciones.
            </p>
          )}
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
                  <button key={est.id} onClick={() => abrirPanel(est)} style={es.rosterItem}>
                    <span style={es.rosterAvatar}>{formatearApellidoPrimero(est.nombre).charAt(0).toUpperCase()}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{formatearApellidoPrimero(est.nombre)}</span>
                    {est.citaciones_pendientes > 0 && (
                      <span style={es.rosterBadge}>{est.citaciones_pendientes} pendiente{est.citaciones_pendientes > 1 ? 's' : ''}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {seleccionado && (
        <>
          <div onClick={cerrarPanel} style={es.overlay} />
          <div style={es.panel}>
            <div style={es.panelHeader}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>{formatearApellidoPrimero(seleccionado.nombre)}</div>
                <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>Citaciones</div>
              </div>
              <button onClick={cerrarPanel} style={es.panelCerrar}>✕</button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              <p style={es.panelSecTitulo}>Nueva citación</p>
              <textarea
                placeholder="Motivo de la reunión..."
                value={form.motivo}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
                style={es.textarea}
                rows={3}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input type="date" value={form.fecha_cita} onChange={e => setForm({ ...form, fecha_cita: e.target.value })} style={{ ...es.input, flex: 1 }} />
                <input type="time" value={form.hora_cita} onChange={e => setForm({ ...form, hora_cita: e.target.value })} style={{ ...es.input, flex: 1 }} />
              </div>
              <input
                type="text"
                placeholder="Lugar (opcional)"
                value={form.lugar}
                onChange={e => setForm({ ...form, lugar: e.target.value })}
                style={{ ...es.input, marginBottom: '10px' }}
              />

              <p style={{ ...es.label, marginBottom: '6px' }}>Notificar al acudiente por</p>
              <label style={es.checkFila}>
                <input type="checkbox" checked={form.notificar_whatsapp}
                  onChange={e => setForm({ ...form, notificar_whatsapp: e.target.checked })} />
                📲 WhatsApp
              </label>
              <label style={{ ...es.checkFila, marginBottom: '10px' }}>
                <input type="checkbox" checked={form.notificar_mensajeria}
                  onChange={e => setForm({ ...form, notificar_mensajeria: e.target.checked })} />
                💬 Mensajería Interna
              </label>

              {exito && <div style={es.exitoBox}>{exito}</div>}
              <button
                onClick={enviarCitacion}
                disabled={guardando || !form.motivo.trim()}
                style={{ ...es.btnPrimario, opacity: (guardando || !form.motivo.trim()) ? 0.5 : 1 }}
              >
                {guardando ? 'Enviando...' : 'Enviar citación'}
              </button>

              <p style={{ ...es.panelSecTitulo, marginTop: '24px' }}>Historial</p>
              {cargandoPanel ? (
                <p style={es.textoGris}>Cargando...</p>
              ) : citaciones.length === 0 ? (
                <p style={es.textoGris}>Aún no hay citaciones para este estudiante.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {citaciones.map(c => {
                    const cfg = ESTADOS[c.estado] || ESTADOS.pendiente;
                    return (
                      <div key={c.id} style={es.citaCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ ...es.estadoBadge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          {!c.whatsapp_enviado && <span style={es.avisoBadge}>No enviada por WhatsApp</span>}
                        </div>
                        <p style={es.citaTexto}>{c.motivo}</p>
                        {(c.fecha_cita || c.lugar) && (
                          <p style={es.citaDetalle}>
                            {c.fecha_cita && new Date(c.fecha_cita).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {c.hora_cita && ` · ${c.hora_cita.slice(0, 5)}`}
                            {c.lugar && ` · ${c.lugar}`}
                          </p>
                        )}
                        <p style={es.citaMeta}>{c.nombre_citador} · {fechaLarga(c.creado_en)}</p>
                        {c.estado === 'pendiente' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button onClick={() => cambiarEstado(c.id, 'realizada')} style={es.btnEstado}>Marcar realizada</button>
                            <button onClick={() => cambiarEstado(c.id, 'cancelada')} style={{ ...es.btnEstado, color: '#c62828' }}>Cancelar</button>
                          </div>
                        )}
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
  input: { padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', width: '100%' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  exitoBox: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '10px', lineHeight: 1.5 },
  textoGris: { color: '#888', fontSize: '14px' },
  sinDatos: { textAlign: 'center', color: '#888', padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },

  roster: { display: 'flex', flexDirection: 'column', gap: '6px' },
  rosterItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #f0f0f0', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', color: '#333', textAlign: 'left' },
  rosterAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rosterBadge: { background: '#ff9800', color: '#fff', borderRadius: '20px', padding: '1px 9px', fontSize: '11px', fontWeight: '700' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 },
  panel: { position: 'fixed', top: 0, right: 0, width: '420px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' },
  panelCerrar: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' },
  panelSecTitulo: { fontSize: '11px', fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' },

  textarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '10px' },
  checkFila: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#333', marginBottom: '6px', cursor: 'pointer' },
  btnPrimario: { width: '100%', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  citaCard: { background: '#fafafa', borderRadius: '10px', padding: '12px 14px' },
  estadoBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  avisoBadge: { display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#fff0f0', color: '#c62828' },
  citaTexto: { fontSize: '13px', color: '#333', margin: '8px 0 4px', lineHeight: 1.5 },
  citaDetalle: { fontSize: '12px', color: '#667eea', fontWeight: '600', margin: '0 0 4px' },
  citaMeta: { fontSize: '11px', color: '#aaa', margin: 0 },
  btnEstado: { background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', color: '#555', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600', padding: '5px 10px' },
};
