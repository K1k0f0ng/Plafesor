import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconCalendar } from '../components/Icons';

export default function SemanaAcademica() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [dias, setDias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/semana-academica');
      setDias(resp.data.data);
    } catch {
      setError('No se pudo cargar la semana académica.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  function cambiarNombre(id, nombre) {
    setDias(prev => prev.map(d => d.id === id ? { ...d, nombre } : d));
  }

  async function guardarNombre(dia) {
    if (!dia.nombre.trim()) return;
    setGuardandoId(dia.id);
    setError('');
    try {
      await axiosAuth.put(`/api/semana-academica/${dia.id}`, { nombre: dia.nombre.trim() });
      mostrarMensaje('Día actualizado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el día');
    } finally {
      setGuardandoId(null);
    }
  }

  async function alternarActivo(dia) {
    setGuardandoId(dia.id);
    setError('');
    try {
      await axiosAuth.put(`/api/semana-academica/${dia.id}`, { activo: !dia.activo });
      setDias(prev => prev.map(d => d.id === dia.id ? { ...d, activo: !d.activo } : d));
      mostrarMensaje('Día actualizado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el día');
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Semana Académica" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCalendar size={20} style={{ color: '#764ba2' }} />
            Semana Académica
          </h2>
          <p style={es.subtitulo}>
            Define qué días de la semana dicta clase tu colegio y cómo se llaman. Estos días son los que
            los docentes pueden usar al armar su horario.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando semana académica...</div>
        ) : (
          <div style={es.card}>
            <table style={es.tabla}>
              <thead>
                <tr>
                  <th style={es.th}>Día</th>
                  <th style={es.th}>Nombre</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Dicta clase</th>
                </tr>
              </thead>
              <tbody>
                {dias.map(d => (
                  <tr key={d.id} style={es.tr}>
                    <td style={{ ...es.td, fontWeight: '700', color: '#764ba2', whiteSpace: 'nowrap' }}>Día {d.dia_numero}</td>
                    <td style={es.td}>
                      <input
                        style={es.input}
                        value={d.nombre}
                        onChange={e => cambiarNombre(d.id, e.target.value)}
                        onBlur={() => guardarNombre(d)}
                        disabled={guardandoId === d.id}
                      />
                    </td>
                    <td style={{ ...es.td, textAlign: 'center' }}>
                      <label style={es.switch}>
                        <input
                          type="checkbox"
                          checked={!!d.activo}
                          onChange={() => alternarActivo(d)}
                          disabled={guardandoId === d.id}
                          style={es.switchInput}
                        />
                        <span style={{ ...es.switchTrack, background: d.activo ? '#764ba2' : '#e0e0e0' }}>
                          <span style={{ ...es.switchThumb, transform: d.activo ? 'translateX(18px)' : 'translateX(0)' }} />
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={es.ayuda}>Los cambios se guardan automáticamente al salir del campo o marcar el interruptor.</p>
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

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: '11.5px', fontWeight: '700', color: '#fff', background: 'linear-gradient(135deg, #a084c9, #764ba2)', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f0e9f7' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#374151' },
  input: { width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #e0d5ee', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  ayuda: { fontSize: '11.5px', color: '#aaa', margin: '12px 0 0', textAlign: 'center' },

  switch: { position: 'relative', display: 'inline-block' },
  switchInput: { position: 'absolute', opacity: 0, width: '38px', height: '20px', margin: 0, cursor: 'pointer' },
  switchTrack: { display: 'block', width: '38px', height: '20px', borderRadius: '999px', transition: 'background 0.15s', position: 'relative' },
  switchThumb: { position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.15s' },
};
