import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBell } from '../components/Icons';

const RUTAS_POR_ROL = {
  admin: '/dashboard', docente: '/dashboard-docente', estudiante: '/dashboard-estudiante',
  director: '/dashboard-director', padre: '/dashboard-padre',
};

// Qué categorías tiene sentido mostrarle a cada rol — no todos reciben todos
// los tipos de aviso (ej. solo los acudientes reciben WhatsApp de citaciones
// o inasistencias).
const CATEGORIAS = [
  {
    campo: 'notif_mensajes', titulo: 'Mensajería interna',
    descripcion: 'Avisos en la campanita cuando te llega un mensaje nuevo.',
    roles: ['admin', 'director', 'docente', 'padre'],
  },
  {
    campo: 'notif_citaciones', titulo: 'Citaciones',
    descripcion: 'Avisos en la campanita cuando el colegio te cita a una reunión.',
    roles: ['padre'],
  },
  {
    campo: 'notif_riesgo_academico', titulo: 'Riesgo académico',
    descripcion: 'Avisos en la campanita cuando un estudiante entra en riesgo académico.',
    roles: ['director', 'docente', 'padre'],
  },
  {
    campo: 'notif_whatsapp', titulo: 'Mensajes de WhatsApp',
    descripcion: 'Mensajes de WhatsApp del colegio (inasistencias, citaciones) al número registrado de tu hijo/a.',
    roles: ['padre'],
  },
];

export default function PreferenciasNotificacion() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [preferencias, setPreferencias] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/preferencias-notificacion');
      setPreferencias(resp.data.data);
    } catch {
      setError('No se pudieron cargar tus preferencias de notificación.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(campo, valor) {
    const anterior = preferencias[campo];
    setPreferencias(prev => ({ ...prev, [campo]: valor }));
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.put('/api/preferencias-notificacion', { [campo]: valor });
      setMensaje('Preferencias actualizadas.');
      setTimeout(() => setMensaje(''), 2500);
    } catch (err) {
      setPreferencias(prev => ({ ...prev, [campo]: anterior }));
      setError(err.response?.data?.error || 'Error al actualizar la preferencia');
    } finally {
      setGuardando(false);
    }
  }

  const categoriasVisibles = CATEGORIAS.filter(c => c.roles.includes(usuario.rol));

  return (
    <div style={es.pagina}>
      <Navbar titulo="Preferencias de notificación" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(RUTAS_POR_ROL[usuario.rol] || '/login')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconBell size={20} style={{ color: '#667eea' }} />
            Preferencias de notificación
          </h2>
          <p style={es.subtitulo}>Elige qué avisos quieres recibir.</p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando preferencias...</div>
        ) : !preferencias ? null : categoriasVisibles.length === 0 ? (
          <div style={es.card}>
            <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', margin: 0 }}>
              Tu rol no tiene categorías de notificación configurables por ahora.
            </p>
          </div>
        ) : (
          <div style={es.card}>
            {categoriasVisibles.map(c => (
              <div key={c.campo} style={es.fila}>
                <div>
                  <div style={es.filaTitulo}>{c.titulo}</div>
                  <div style={es.filaDesc}>{c.descripcion}</div>
                </div>
                <label style={es.switch}>
                  <input
                    type="checkbox"
                    checked={!!preferencias[c.campo]}
                    onChange={e => cambiar(c.campo, e.target.checked)}
                    disabled={guardando}
                    style={es.switchInput}
                  />
                  <span style={{ ...es.switchTrack, background: preferencias[c.campo] ? '#764ba2' : '#e0e0e0' }}>
                    <span style={{ ...es.switchThumb, transform: preferencias[c.campo] ? 'translateX(18px)' : 'translateX(0)' }} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },

  card: { background: '#fff', borderRadius: '16px', padding: '8px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  fila: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 0', borderBottom: '1px solid #f2f2f5' },
  filaTitulo: { fontSize: '13.5px', fontWeight: '700', color: '#333' },
  filaDesc: { fontSize: '12px', color: '#999', marginTop: '3px', lineHeight: 1.4, maxWidth: '440px' },

  switch: { position: 'relative', display: 'inline-block', flexShrink: 0 },
  switchInput: { position: 'absolute', opacity: 0, width: '38px', height: '20px', margin: 0, cursor: 'pointer' },
  switchTrack: { display: 'block', width: '38px', height: '20px', borderRadius: '999px', transition: 'background 0.15s', position: 'relative' },
  switchThumb: { position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.15s' },
};
