import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';

const GRADOS = ['5', '6', '7', '8', '9'];

export default function Grupos() {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', grado: '6', ano_lectivo: 2025 });

  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [estudiantesGrupo, setEstudiantesGrupo] = useState([]);
  const [cargandoEst, setCargandoEst] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const rGrupos = await axiosAuth.get('/api/grupos');
      setGrupos(rGrupos.data.data);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.post('/api/grupos', form);
      setForm({ nombre: '', grado: '6', ano_lectivo: 2025 });
      setMensaje('Grupo creado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el grupo');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    if (!window.confirm('¿Desactivar este grupo?')) return;
    try {
      await axiosAuth.delete(`/api/grupos/${id}`);
      if (grupoAbierto === id) setGrupoAbierto(null);
      await cargar();
    } catch {
      setError('Error al desactivar el grupo');
    }
  }

  async function verEstudiantes(grupoId) {
    if (grupoAbierto === grupoId) {
      setGrupoAbierto(null);
      setEstudiantesGrupo([]);
      return;
    }
    setGrupoAbierto(grupoId);
    setCargandoEst(true);
    try {
      const resp = await axiosAuth.get(`/api/grupos/${grupoId}/estudiantes`);
      setEstudiantesGrupo(resp.data.data);
    } catch {
      setEstudiantesGrupo([]);
    } finally {
      setCargandoEst(false);
    }
  }

  async function quitarDeGrupo(grupoId, estudianteId, nombreEst) {
    if (!window.confirm(`¿Quitar a ${nombreEst} del grupo?\n\nEl alumno NO se eliminará del sistema, solo se desvincula de este grupo.`)) return;
    try {
      await axiosAuth.delete(`/api/grupos/${grupoId}/estudiante/${estudianteId}`);
      const resp = await axiosAuth.get(`/api/grupos/${grupoId}/estudiantes`);
      setEstudiantesGrupo(resp.data.data);
      await cargar();
    } catch {
      setError('Error al quitar el alumno del grupo');
    }
  }

  const gruposFiltrados = grupos;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Grupos" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Formulario crear */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Crear grupo</h3>
          <form onSubmit={handleCrear} style={es.form}>
            <input
              type="text" placeholder="Nombre (ej: 9-A) *" required
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={es.input}
            />
            <select value={form.grado} onChange={e => setForm({ ...form, grado: e.target.value })} style={es.select}>
              {GRADOS.map(g => <option key={g} value={g}>Grado {g}°</option>)}
            </select>
            <input
              type="number" placeholder="Año lectivo" min="2020" max="2035"
              value={form.ano_lectivo}
              onChange={e => setForm({ ...form, ano_lectivo: parseInt(e.target.value) })}
              style={{ ...es.input, maxWidth: '130px' }}
            />
            <button type="submit" disabled={guardando} style={es.btnPrimario}>
              {guardando ? 'Guardando...' : '+ Crear grupo'}
            </button>
          </form>
          {mensaje && <div style={es.exito}>{mensaje}</div>}
          {error && <div style={es.errorBox}>{error}</div>}
        </div>

        {/* Lista de grupos */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Grupos registrados ({gruposFiltrados.length})</h3>

          {cargando ? (
            <p style={es.textoGris}>Cargando...</p>
          ) : gruposFiltrados.length === 0 ? (
            <p style={es.textoGris}>No hay grupos registrados.</p>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>
                  {['Nombre', 'Grado', 'Año', 'Alumnos', 'Acciones'].map(h => (
                    <th key={h} style={es.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gruposFiltrados.map(g => (
                  <React.Fragment key={g.id}>
                    <tr style={es.tr}>
                      <td style={es.td}><strong>{g.nombre}</strong></td>
                      <td style={es.td}>{g.grado}°</td>
                      <td style={es.td}>{g.ano_lectivo}</td>
                      <td style={es.td}>
                        <span style={es.badgeAlumnos}>{g.total_estudiantes} alumno{g.total_estudiantes !== 1 ? 's' : ''}</span>
                      </td>
                      <td style={es.td}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => verEstudiantes(g.id)}
                            style={grupoAbierto === g.id ? es.btnVerActivo : es.btnVer}
                          >
                            {grupoAbierto === g.id ? 'Cerrar ▲' : 'Ver alumnos ▼'}
                          </button>
                          <button onClick={() => handleEliminar(g.id)} style={es.btnPeligro}>
                            Desactivar
                          </button>
                        </div>
                      </td>
                    </tr>

                    {grupoAbierto === g.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={es.panelEst}>
                            {cargandoEst ? (
                              <p style={es.textoGris}>Cargando alumnos...</p>
                            ) : estudiantesGrupo.length === 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <p style={{ ...es.textoGris, margin: 0 }}>
                                  No hay alumnos en este grupo.
                                </p>
                                <button onClick={() => navigate('/estudiantes')} style={es.btnLink}>
                                  + Ir a agregar alumnos
                                </button>
                              </div>
                            ) : (
                              <>
                                <div style={es.panelHeader}>
                                  <span style={es.panelTitulo}>
                                    {estudiantesGrupo.length} alumno{estudiantesGrupo.length !== 1 ? 's' : ''} en el grupo {g.grado}° {g.nombre}
                                  </span>
                                  <button onClick={() => navigate('/estudiantes')} style={es.btnLink}>
                                    + Agregar alumno
                                  </button>
                                </div>
                                {estudiantesGrupo.map(e => (
                                  <div key={e.id} style={es.filaEst}>
                                    <div style={{ flex: 1 }}>
                                      <span style={es.nombreEst}>{e.nombre}</span>
                                      <span style={es.emailEst}>{e.email}</span>
                                    </div>
                                    <button
                                      onClick={() => quitarDeGrupo(g.id, e.id, e.nombre)}
                                      style={es.btnQuitar}
                                    >
                                      Quitar del grupo
                                    </button>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  input: { flex: 1, minWidth: '150px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '150px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  btnVer: { background: '#f0f0ff', border: '1px solid #c5cae9', color: '#5c6bc0', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  btnVerActivo: { background: 'var(--color-primario)', border: '1px solid var(--color-primario)', color: '#fff', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  btnQuitar: { background: '#fff8e1', border: '1px solid #ffe082', color: '#e65100', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnLink: { background: 'none', border: 'none', color: 'var(--color-primario)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' },
  exito: { marginTop: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  errorBox: { marginTop: '12px', background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px', fontSize: '14px', color: '#333' },
  badgeAlumnos: { background: '#e8f4fd', color: '#1565c0', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' },
  panelEst: { background: '#f8f9ff', borderTop: '1px solid #e8eaf6', padding: '16px 20px' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  panelTitulo: { fontSize: '13px', fontWeight: '700', color: '#444' },
  filaEst: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: '8px', marginBottom: '6px', border: '1px solid #eee' },
  nombreEst: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#333' },
  emailEst: { display: 'block', fontSize: '12px', color: '#888', marginTop: '2px' },
};
