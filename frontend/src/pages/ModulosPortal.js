import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

export default function ModulosPortal() {
  const { usuario, refrescarModulos } = useAuth();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/colegio-modulos');
      setModulos(resp.data.data);
    } catch {
      setError('No se pudieron cargar los módulos del portal.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(clave, activo) {
    const anteriores = modulos;
    const nuevos = modulos.map(m => m.clave === clave ? { ...m, activo } : m);
    setModulos(nuevos);
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.put('/api/colegio-modulos', {
        modulos_desactivados: nuevos.filter(m => !m.activo).map(m => m.clave),
      });
      await refrescarModulos();
      setMensaje('Módulos actualizados.');
      setTimeout(() => setMensaje(''), 2500);
    } catch (err) {
      setModulos(anteriores);
      setError(err.response?.data?.error || 'Error al actualizar el módulo');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Módulos del portal" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Módulos del portal</h2>
          <p style={es.subtitulo}>
            Activa o desactiva funcionalidades opcionales de Playfesor según lo que use tu colegio.
            Los módulos principales (estudiantes, grupos, calificaciones, auditoría) siempre están disponibles.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando módulos...</div>
        ) : (
          <div style={es.card}>
            {modulos.map(m => (
              <div key={m.clave} style={es.fila}>
                <div style={es.filaTitulo}>{m.nombre}</div>
                <label style={es.switch}>
                  <input
                    type="checkbox"
                    checked={m.activo}
                    onChange={e => cambiar(m.clave, e.target.checked)}
                    disabled={guardando}
                    style={es.switchInput}
                  />
                  <span style={{ ...es.switchTrack, background: m.activo ? '#764ba2' : '#e0e0e0' }}>
                    <span style={{ ...es.switchThumb, transform: m.activo ? 'translateX(18px)' : 'translateX(0)' }} />
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
  subtitulo: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },

  card: { background: '#fff', borderRadius: '16px', padding: '8px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  fila: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 0', borderBottom: '1px solid #f2f2f5' },
  filaTitulo: { fontSize: '13.5px', fontWeight: '700', color: '#333' },

  switch: { position: 'relative', display: 'inline-block', flexShrink: 0 },
  switchInput: { position: 'absolute', opacity: 0, width: '38px', height: '20px', margin: 0, cursor: 'pointer' },
  switchTrack: { display: 'block', width: '38px', height: '20px', borderRadius: '999px', transition: 'background 0.15s', position: 'relative' },
  switchThumb: { position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.15s' },
};
