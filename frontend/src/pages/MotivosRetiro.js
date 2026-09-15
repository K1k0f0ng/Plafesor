import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

export default function MotivosRetiro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [motivos, setMotivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/motivos-retiro');
      setMotivos(resp.data.data);
    } catch {
      setError('No se pudo cargar el catálogo de motivos de retiro.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  async function crearMotivo() {
    if (!nuevoNombre.trim()) return;
    setCreando(true);
    setError('');
    try {
      await axiosAuth.post('/api/motivos-retiro', { nombre: nuevoNombre.trim() });
      setNuevoNombre('');
      await cargar();
      mostrarMensaje('Motivo agregado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar el motivo');
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(m) {
    setEditandoId(m.id);
    setEditandoNombre(m.nombre);
  }

  async function guardarEdicion(id) {
    if (!editandoNombre.trim()) return;
    setGuardandoId(id);
    setError('');
    try {
      await axiosAuth.put(`/api/motivos-retiro/${id}`, { nombre: editandoNombre.trim() });
      setEditandoId(null);
      await cargar();
      mostrarMensaje('Motivo actualizado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el motivo');
    } finally {
      setGuardandoId(null);
    }
  }

  async function desactivarMotivo(m) {
    if (!window.confirm(`¿Quitar "${m.nombre}" del catálogo? Ya no aparecerá al retirar estudiantes.`)) return;
    setGuardandoId(m.id);
    setError('');
    try {
      await axiosAuth.put(`/api/motivos-retiro/${m.id}`, { activo: false });
      await cargar();
      mostrarMensaje('Motivo desactivado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al desactivar el motivo');
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Motivos de retiro" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Motivos de retiro</h2>
          <p style={es.subtitulo}>
            Personaliza las razones disponibles al retirar un estudiante, para poder analizar después por qué se van.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando catálogo...</div>
        ) : (
          <div style={es.card}>
            <div style={es.lista}>
              {motivos.map(m => (
                <div key={m.id} style={es.fila}>
                  {editandoId === m.id ? (
                    <input
                      style={es.input}
                      value={editandoNombre}
                      onChange={e => setEditandoNombre(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span style={es.nombre}>{m.nombre}</span>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {editandoId === m.id ? (
                      <>
                        <button onClick={() => guardarEdicion(m.id)} disabled={guardandoId === m.id} style={es.btnMini}>Guardar</button>
                        <button onClick={() => setEditandoId(null)} style={es.btnMiniSec}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => iniciarEdicion(m)} style={es.btnMiniSec}>Renombrar</button>
                        <button onClick={() => desactivarMotivo(m)} disabled={guardandoId === m.id} style={es.btnMiniPeligro}>Quitar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {motivos.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '20px 0' }}>No hay motivos configurados.</p>
              )}
            </div>

            <div style={es.nuevaFila}>
              <input
                style={es.input}
                placeholder="Agregar un motivo nuevo…"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearMotivo()}
              />
              <button onClick={crearMotivo} disabled={creando || !nuevoNombre.trim()} style={{ ...es.btnPrimario, opacity: (creando || !nuevoNombre.trim()) ? 0.5 : 1 }}>
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
  contenido: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' },
  fila: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: '#faf8fc', border: '1px solid #f0e9f7' },
  nombre: { fontSize: '13.5px', fontWeight: '600', color: '#374151' },

  nuevaFila: { display: 'flex', gap: '10px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' },
  input: { flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e0d5ee', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },

  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnMini: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniSec: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniPeligro: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
};
