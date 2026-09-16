import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

export default function AreasAcademicas() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoCodigo, setEditandoCodigo] = useState('');
  const [editandoNombre, setEditandoNombre] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/areas-academicas');
      setAreas(resp.data.data);
    } catch {
      setError('No se pudo cargar el catálogo de áreas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  async function crearArea() {
    if (!nuevoNombre.trim() || !nuevoCodigo.trim()) return;
    setCreando(true);
    setError('');
    try {
      await axiosAuth.post('/api/areas-academicas', { codigo: nuevoCodigo.trim(), nombre: nuevoNombre.trim() });
      setNuevoCodigo('');
      setNuevoNombre('');
      await cargar();
      mostrarMensaje('Área agregada correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al agregar el área');
    } finally {
      setCreando(false);
    }
  }

  function iniciarEdicion(a) {
    setEditandoId(a.id);
    setEditandoCodigo(a.codigo);
    setEditandoNombre(a.nombre);
  }

  async function guardarEdicion(id) {
    if (!editandoNombre.trim() || !editandoCodigo.trim()) return;
    setGuardandoId(id);
    setError('');
    try {
      await axiosAuth.put(`/api/areas-academicas/${id}`, { codigo: editandoCodigo.trim(), nombre: editandoNombre.trim() });
      setEditandoId(null);
      await cargar();
      mostrarMensaje('Área actualizada correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el área');
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminarArea(a) {
    if (!window.confirm(`¿Quitar "${a.nombre}" del catálogo de áreas?`)) return;
    setGuardandoId(a.id);
    setError('');
    try {
      await axiosAuth.put(`/api/areas-academicas/${a.id}`, { activo: false });
      await cargar();
      mostrarMensaje('Área eliminada correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el área');
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Áreas de la Institución" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Áreas de la Institución</h2>
          <p style={es.subtitulo}>
            Las áreas agrupan las asignaturas (ej: el área "Matemáticas" puede contener las asignaturas
            Aritmética, Geometría y Estadística). Este es el primer paso para definir las asignaturas del colegio.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando áreas...</div>
        ) : (
          <div style={es.card}>
            <table style={es.tabla}>
              <thead>
                <tr>
                  <th style={{ ...es.th, width: '110px' }}>Código</th>
                  <th style={es.th}>Nombre del área</th>
                  <th style={{ ...es.th, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {areas.map(a => (
                  <tr key={a.id} style={es.tr}>
                    <td style={es.td}>
                      {editandoId === a.id ? (
                        <input
                          style={es.input}
                          value={editandoCodigo}
                          onChange={e => setEditandoCodigo(e.target.value)}
                        />
                      ) : (
                        <span style={es.codigoTag}>{a.codigo}</span>
                      )}
                    </td>
                    <td style={es.td}>
                      {editandoId === a.id ? (
                        <input
                          style={es.input}
                          value={editandoNombre}
                          onChange={e => setEditandoNombre(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span style={{ fontWeight: '600' }}>{a.nombre}</span>
                      )}
                    </td>
                    <td style={{ ...es.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {editandoId === a.id ? (
                          <>
                            <button onClick={() => guardarEdicion(a.id)} disabled={guardandoId === a.id} style={es.btnMini}>Guardar</button>
                            <button onClick={() => setEditandoId(null)} style={es.btnMiniSec}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicion(a)} style={es.btnMiniSec}>Editar</button>
                            <button onClick={() => eliminarArea(a)} disabled={guardandoId === a.id} style={es.btnMiniPeligro}>Eliminar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {areas.length === 0 && (
                  <tr><td colSpan={3} style={{ ...es.td, textAlign: 'center', color: '#999' }}>No hay áreas registradas todavía.</td></tr>
                )}
              </tbody>
            </table>

            <div style={es.nuevaFila}>
              <input
                style={{ ...es.input, width: '110px', flex: 'none' }}
                placeholder="Código"
                value={nuevoCodigo}
                onChange={e => setNuevoCodigo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearArea()}
              />
              <input
                style={{ ...es.input, flex: 1 }}
                placeholder="Nombre del área nueva (ej: Tecnología e informática)…"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearArea()}
              />
              <button onClick={crearArea} disabled={creando || !nuevoNombre.trim() || !nuevoCodigo.trim()} style={{ ...es.btnPrimario, opacity: (creando || !nuevoNombre.trim() || !nuevoCodigo.trim()) ? 0.5 : 1 }}>
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
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
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
  codigoTag: { display: 'inline-block', background: '#f0e9f7', color: '#764ba2', borderRadius: '6px', padding: '3px 9px', fontWeight: '700', fontSize: '12.5px' },

  nuevaFila: { display: 'flex', gap: '10px', paddingTop: '16px', marginTop: '10px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap', alignItems: 'center' },

  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnMini: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniSec: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniPeligro: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
};
