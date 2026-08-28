import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

const PANEL_INICIAL = { home: '/dashboard-docente', director: '/dashboard-director', admin: '/dashboard' };

function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ALCANCE_LABEL = { grupo: 'Un grupo', grado: 'Un grado completo', colegio: 'Todo el colegio' };

export default function MensajesMasivos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const rutaPanel = PANEL_INICIAL[usuario.rol] || PANEL_INICIAL.home;
  const puedeAmpliarAlcance = usuario.rol === 'admin' || usuario.rol === 'director';

  const [grupos, setGrupos] = useState([]);
  const [alcance, setAlcance] = useState('grupo');
  const [grupoId, setGrupoId] = useState('');
  const [grado, setGrado] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [historial, setHistorial] = useState([]);

  const gradosDisponibles = useMemo(() => (
    [...new Set(grupos.map(g => g.grado))].sort()
  ), [grupos]);

  useEffect(() => {
    axiosAuth.get('/api/citaciones/mis-grupos')
      .then(resp => {
        setGrupos(resp.data.data);
        if (!puedeAmpliarAlcance && resp.data.data.length) {
          setGrupoId(String(resp.data.data[0].id));
        }
      })
      .catch(() => setError('No se pudieron cargar tus grupos'));
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cargarHistorial() {
    axiosAuth.get('/api/mensajes-masivos').then(resp => setHistorial(resp.data.data)).catch(() => {});
  }

  const cargarPreview = useCallback(() => {
    if (alcance === 'grupo' && !grupoId) { setPreview(null); return; }
    if (alcance === 'grado' && !grado)   { setPreview(null); return; }
    setCargandoPreview(true);
    const params = { alcance };
    if (alcance === 'grupo') params.grupo_id = grupoId;
    if (alcance === 'grado') params.grado = grado;
    axiosAuth.get('/api/mensajes-masivos/destinatarios', { params })
      .then(resp => setPreview(resp.data.data))
      .catch(() => setPreview(null))
      .finally(() => setCargandoPreview(false));
  }, [alcance, grupoId, grado]);

  useEffect(() => { cargarPreview(); }, [cargarPreview]);

  async function enviar() {
    if (!asunto.trim() || !mensaje.trim()) return;
    setEnviando(true); setError(''); setExito('');
    try {
      const body = { alcance, asunto: asunto.trim(), mensaje: mensaje.trim() };
      if (alcance === 'grupo') body.grupo_id = parseInt(grupoId);
      if (alcance === 'grado') body.grado = grado;
      const resp = await axiosAuth.post('/api/mensajes-masivos', body);
      setExito(`Comunicado enviado a ${resp.data.data.total_enviados} de ${resp.data.data.total_destinatarios} familias.`);
      setAsunto(''); setMensaje('');
      cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar el comunicado');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mensajes masivos" />
      <div style={es.contenido}>
        <button onClick={() => navigate(rutaPanel)} style={es.btnVolver}>← Volver al panel</button>

        <p style={es.ayuda}>
          Envía un comunicado por WhatsApp a varias familias a la vez — por ejemplo, para avisar una reunión de
          padres. Cada acudiente también lo recibe como notificación en su portal.
        </p>

        <div style={es.card}>
          <label style={es.label}>Alcance</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {(puedeAmpliarAlcance ? ['grupo', 'grado', 'colegio'] : ['grupo']).map(a => (
              <button
                key={a}
                onClick={() => setAlcance(a)}
                style={{ ...es.alcanceBtn, ...(alcance === a ? es.alcanceBtnActivo : {}) }}
              >
                {ALCANCE_LABEL[a]}
              </button>
            ))}
          </div>

          {alcance === 'grupo' && (
            <>
              <label style={es.label}>Grupo</label>
              <select value={grupoId} onChange={e => setGrupoId(e.target.value)} style={es.select}>
                <option value="">— Selecciona un grupo —</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
              </select>
            </>
          )}

          {alcance === 'grado' && (
            <>
              <label style={es.label}>Grado</label>
              <select value={grado} onChange={e => setGrado(e.target.value)} style={es.select}>
                <option value="">— Selecciona un grado —</option>
                {gradosDisponibles.map(g => <option key={g} value={g}>{g}°</option>)}
              </select>
            </>
          )}

          {alcance === 'colegio' && (
            <p style={{ ...es.textoGris, margin: 0 }}>Se enviará a todas las familias del colegio.</p>
          )}

          {cargandoPreview ? (
            <p style={{ ...es.textoGris, marginTop: '10px' }}>Calculando destinatarios...</p>
          ) : preview && (
            <p style={es.previewTexto}>
              Llegará a <strong>{preview.total_con_telefono}</strong> estudiante{preview.total_con_telefono !== 1 ? 's' : ''}
              {' '}({preview.total_mensajes_whatsapp} mensaje{preview.total_mensajes_whatsapp !== 1 ? 's' : ''} de WhatsApp — algunos acudientes comparten el mismo número)
              {preview.sin_telefono > 0 && `. ${preview.sin_telefono} estudiante${preview.sin_telefono > 1 ? 's' : ''} sin teléfono registrado`}.
            </p>
          )}
        </div>

        <div style={es.card}>
          <label style={es.label}>Asunto</label>
          <input
            type="text"
            placeholder="Ej. Reunión de padres de familia"
            value={asunto}
            onChange={e => setAsunto(e.target.value)}
            style={{ ...es.input, marginBottom: '14px' }}
          />
          <label style={es.label}>Mensaje</label>
          <textarea
            placeholder="Escribe el comunicado..."
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            style={es.textarea}
            rows={5}
          />

          {error && <div style={es.errorBox}>{error}</div>}
          {exito && <div style={es.exitoBox}>{exito}</div>}

          <button
            onClick={enviar}
            disabled={enviando || !asunto.trim() || !mensaje.trim() || (alcance === 'grupo' && !grupoId) || (alcance === 'grado' && !grado)}
            style={{ ...es.btnPrimario, opacity: (enviando || !asunto.trim() || !mensaje.trim()) ? 0.5 : 1 }}
          >
            {enviando ? 'Enviando...' : '📲 Enviar por WhatsApp'}
          </button>
        </div>

        {historial.length > 0 && (
          <div style={es.card}>
            <p style={es.label}>Historial de comunicados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historial.map(h => (
                <div key={h.id} style={es.historialCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#333' }}>{h.asunto}</span>
                    <span style={es.alcanceBadge}>
                      {h.alcance === 'grupo' ? `Grupo ${h.nombre_grupo || ''}` : h.alcance === 'grado' ? `Grado ${h.grado}°` : 'Todo el colegio'}
                    </span>
                  </div>
                  <p style={es.historialTexto}>{h.mensaje}</p>
                  <p style={es.citaMeta}>
                    {h.nombre_remitente} · {fechaLarga(h.creado_en)} · {h.total_enviados}/{h.total_destinatarios} enviados
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '16px', padding: 0, fontFamily: 'inherit' },
  ayuda: { fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '20px' },
  card: { background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  select: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' },
  input: { padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', width: '100%' },
  textarea: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '14px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
  exitoBox: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 },
  textoGris: { color: '#888', fontSize: '14px' },
  previewTexto: { fontSize: '13px', color: 'var(--color-primario)', fontWeight: '600', marginTop: '10px', marginBottom: 0 },
  btnPrimario: { width: '100%', background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  alcanceBtn: { flex: 1, padding: '9px 6px', borderRadius: '8px', border: '2px solid #e0e0e0', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', background: '#fafafa', color: '#999' },
  alcanceBtnActivo: { background: '#eef0ff', borderColor: 'var(--color-primario)', color: '#5a4fcf' },

  historialCard: { background: '#fafafa', borderRadius: '10px', padding: '12px 14px' },
  historialTexto: { fontSize: '13px', color: '#555', margin: '8px 0 6px', lineHeight: 1.5 },
  citaMeta: { fontSize: '11px', color: '#aaa', margin: 0 },
  alcanceBadge: { fontSize: '11px', fontWeight: '700', color: 'var(--color-primario)', background: '#eef0ff', padding: '2px 9px', borderRadius: '20px', whiteSpace: 'nowrap' },
};
