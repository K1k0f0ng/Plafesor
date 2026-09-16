import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox } from '../components/Icons';

export default function ReasignacionCarga() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [docentes, setDocentes] = useState([]);
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [clases, setClases] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [cargandoClases, setCargandoClases] = useState(false);
  const [reasignando, setReasignando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarDocentes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/docentes');
      setDocentes(resp.data.data.filter(d => d.activo));
    } catch {
      setError('No se pudo cargar la lista de docentes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDocentes(); }, [cargarDocentes]);

  const cargarClasesDelOrigen = useCallback(async (id) => {
    if (!id) { setClases([]); setSeleccionadas(new Set()); return; }
    setCargandoClases(true);
    setError('');
    try {
      const resp = await axiosAuth.get(`/api/docentes/${id}/asignaciones`);
      setClases(resp.data.data);
      setSeleccionadas(new Set(resp.data.data.map(c => c.id)));
    } catch {
      setError('No se pudo cargar la carga académica de este docente.');
    } finally {
      setCargandoClases(false);
    }
  }, []);

  useEffect(() => { cargarClasesDelOrigen(origenId); }, [origenId, cargarClasesDelOrigen]);

  function alternar(id) {
    setSeleccionadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function alternarTodas() {
    setSeleccionadas(prev => prev.size === clases.length ? new Set() : new Set(clases.map(c => c.id)));
  }

  async function reasignar() {
    if (!origenId || !destinoId || seleccionadas.size === 0) {
      return setError('Selecciona el docente de origen, el de destino y al menos una clase');
    }
    setReasignando(true);
    setError('');
    setMensaje('');
    try {
      const resp = await axiosAuth.put('/api/docentes/carga-academica/reasignar', {
        docente_origen_id: origenId,
        docente_destino_id: destinoId,
        asignacion_ids: Array.from(seleccionadas),
      });
      setMensaje(resp.data.mensaje);
      await cargarClasesDelOrigen(origenId);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al reasignar la carga académica');
    } finally {
      setReasignando(false);
    }
  }

  const docentesDestino = docentes.filter(d => String(d.id) !== String(origenId));

  return (
    <div style={es.pagina}>
      <Navbar titulo="Reasignación de Carga Académica" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Reasignación de Carga Académica</h2>
          <p style={es.subtitulo}>
            Mueve las clases de un docente a otro sin tener que borrarlas y crearlas de nuevo — útil cuando
            un docente sale de licencia, se retira o cambia de grupo.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando docentes...</div>
        ) : (
          <div style={es.card}>
            <div style={es.selectores}>
              <div style={es.campoSelector}>
                <label style={es.label}>Docente de origen</label>
                <select style={es.select} value={origenId} onChange={e => { setOrigenId(e.target.value); setMensaje(''); }}>
                  <option value="">— Selecciona —</option>
                  {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div style={es.campoSelector}>
                <label style={es.label}>Docente de destino</label>
                <select style={es.select} value={destinoId} onChange={e => setDestinoId(e.target.value)} disabled={!origenId}>
                  <option value="">— Selecciona —</option>
                  {docentesDestino.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
            </div>

            {!origenId ? (
              <p style={es.textoGris}>Selecciona un docente de origen para ver su carga académica.</p>
            ) : cargandoClases ? (
              <div style={es.cargando}>Cargando carga académica...</div>
            ) : clases.length === 0 ? (
              <div style={es.sinDatos}>
                <IconInbox size={36} style={{ color: '#ccc' }} />
                <p>Este docente no tiene clases definidas.</p>
              </div>
            ) : (
              <>
                <table style={es.tabla}>
                  <thead>
                    <tr>
                      <th style={{ ...es.th, width: '40px' }}>
                        <input type="checkbox" checked={seleccionadas.size === clases.length} onChange={alternarTodas} />
                      </th>
                      <th style={es.th}>Grupo</th>
                      <th style={es.th}>Asignatura</th>
                      <th style={{ ...es.th, textAlign: 'center' }}>Horas/semana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clases.map(c => (
                      <tr key={c.id} style={es.tr}>
                        <td style={es.td}>
                          <input type="checkbox" checked={seleccionadas.has(c.id)} onChange={() => alternar(c.id)} />
                        </td>
                        <td style={es.td}>{c.grado}° {c.nombre_grupo}</td>
                        <td style={es.td}>{c.nombre_materia}</td>
                        <td style={{ ...es.td, textAlign: 'center' }}>{c.intensidad_horaria_semanal || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={es.botones}>
                  <button
                    onClick={reasignar}
                    disabled={reasignando || !destinoId || seleccionadas.size === 0}
                    style={{ ...es.btnPrimario, opacity: (reasignando || !destinoId || seleccionadas.size === 0) ? 0.5 : 1 }}
                  >
                    {reasignando ? 'Reasignando...' : `Reasignar ${seleccionadas.size} clase(s)`}
                  </button>
                </div>
              </>
            )}
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
  cargando: { textAlign: 'center', padding: '40px', color: '#888', fontSize: '15px' },
  textoGris: { color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px 0' },
  sinDatos: { textAlign: 'center', padding: '32px', color: '#888' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  selectores: { display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  campoSelector: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '220px' },
  label: { fontSize: '12.5px', fontWeight: '600', color: '#666' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', background: '#fff' },

  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: '11.5px', fontWeight: '700', color: '#fff', background: 'linear-gradient(135deg, #a084c9, #764ba2)', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f0e9f7' },
  td: { padding: '9px 12px', fontSize: '13.5px', color: '#374151' },

  botones: { display: 'flex', justifyContent: 'flex-end', marginTop: '18px' },
  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
