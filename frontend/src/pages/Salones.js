import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

export default function Salones() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [salones, setSalones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoSimultaneas, setNuevoSimultaneas] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/salones');
      setSalones(resp.data.data);
    } catch {
      setError('No se pudo cargar el catálogo de salones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  async function crearSalon() {
    if (!nuevoNombre.trim()) return;
    setCreando(true);
    setError('');
    try {
      await axiosAuth.post('/api/salones', { nombre: nuevoNombre.trim(), permite_clases_simultaneas: nuevoSimultaneas });
      setNuevoNombre('');
      setNuevoSimultaneas(false);
      await cargar();
      mostrarMensaje('Salón agregado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar el salón');
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(s) {
    setEditandoId(s.id);
    setEditandoNombre(s.nombre);
  }

  async function guardarEdicion(id) {
    if (!editandoNombre.trim()) return;
    setGuardandoId(id);
    setError('');
    try {
      await axiosAuth.put(`/api/salones/${id}`, { nombre: editandoNombre.trim() });
      setEditandoId(null);
      await cargar();
      mostrarMensaje('Salón actualizado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el salón');
    } finally {
      setGuardandoId(null);
    }
  }

  async function alternarSimultaneas(s) {
    setGuardandoId(s.id);
    setError('');
    try {
      await axiosAuth.put(`/api/salones/${s.id}`, { permite_clases_simultaneas: !s.permite_clases_simultaneas });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el salón');
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminarSalon(s) {
    if (!window.confirm(`¿Quitar "${s.nombre}" del catálogo de salones?`)) return;
    setGuardandoId(s.id);
    setError('');
    try {
      await axiosAuth.put(`/api/salones/${s.id}`, { activo: false });
      await cargar();
      mostrarMensaje('Salón eliminado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el salón');
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Salones de Clase" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Salones de Clase</h2>
          <p style={es.subtitulo}>
            Espacios físicos del colegio que los docentes pueden elegir al armar su horario. Marca "Permite
            clases simultáneas" para espacios como una cancha, donde varios grupos pueden usarlo a la vez.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando salones...</div>
        ) : (
          <div style={es.card}>
            <table style={es.tabla}>
              <thead>
                <tr>
                  <th style={es.th}>Nombre del salón</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Permite clases simultáneas</th>
                  <th style={{ ...es.th, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {salones.map(s => (
                  <tr key={s.id} style={es.tr}>
                    <td style={es.td}>
                      {editandoId === s.id ? (
                        <input
                          style={es.input}
                          value={editandoNombre}
                          onChange={e => setEditandoNombre(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span style={{ fontWeight: '600' }}>{s.nombre}</span>
                      )}
                    </td>
                    <td style={{ ...es.td, textAlign: 'center' }}>
                      <label style={es.switch}>
                        <input
                          type="checkbox"
                          checked={!!s.permite_clases_simultaneas}
                          onChange={() => alternarSimultaneas(s)}
                          disabled={guardandoId === s.id}
                          style={es.switchInput}
                        />
                        <span style={{ ...es.switchTrack, background: s.permite_clases_simultaneas ? '#764ba2' : '#e0e0e0' }}>
                          <span style={{ ...es.switchThumb, transform: s.permite_clases_simultaneas ? 'translateX(18px)' : 'translateX(0)' }} />
                        </span>
                      </label>
                    </td>
                    <td style={{ ...es.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {editandoId === s.id ? (
                          <>
                            <button onClick={() => guardarEdicion(s.id)} disabled={guardandoId === s.id} style={es.btnMini}>Guardar</button>
                            <button onClick={() => setEditandoId(null)} style={es.btnMiniSec}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicion(s)} style={es.btnMiniSec}>Renombrar</button>
                            <button onClick={() => eliminarSalon(s)} disabled={guardandoId === s.id} style={es.btnMiniPeligro}>Quitar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {salones.length === 0 && (
                  <tr><td colSpan={3} style={{ ...es.td, textAlign: 'center', color: '#999' }}>No hay salones registrados todavía.</td></tr>
                )}
              </tbody>
            </table>

            <div style={es.nuevaFila}>
              <input
                style={{ ...es.input, flex: 1 }}
                placeholder="Nombre del salón nuevo (ej: Laboratorio, Cancha, Salón 12)…"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearSalon()}
              />
              <label style={es.checkboxLabel}>
                <input type="checkbox" checked={nuevoSimultaneas} onChange={e => setNuevoSimultaneas(e.target.checked)} />
                Permite simultáneas
              </label>
              <button onClick={crearSalon} disabled={creando || !nuevoNombre.trim()} style={{ ...es.btnPrimario, opacity: (creando || !nuevoNombre.trim()) ? 0.5 : 1 }}>
                {creando ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '800px', margin: '0 auto' },
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
  input: { padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #e0d5ee', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', width: '100%' },

  nuevaFila: { display: 'flex', gap: '10px', paddingTop: '16px', marginTop: '10px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap', alignItems: 'center' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#666', whiteSpace: 'nowrap' },

  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnMini: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniSec: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniPeligro: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  switch: { position: 'relative', display: 'inline-block' },
  switchInput: { position: 'absolute', opacity: 0, width: '38px', height: '20px', margin: 0, cursor: 'pointer' },
  switchTrack: { display: 'block', width: '38px', height: '20px', borderRadius: '999px', transition: 'background 0.15s', position: 'relative' },
  switchThumb: { position: 'absolute', top: '2px', left: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.15s' },
};
