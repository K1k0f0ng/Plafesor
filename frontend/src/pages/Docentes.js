import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';

export default function Docentes() {
  const [docentes, setDocentes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [docenteAbierto, setDocenteAbierto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', esDirectorGrupo: false, grupoDirigidoId: '' });
  const [formAsig, setFormAsig] = useState({ docente_id: '', grupo_id: '', materia_id: '' });
  const [dirGrupoSel, setDirGrupoSel] = useState({});
  const [guardandoDirector, setGuardandoDirector] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rDoc, rGru, rMat] = await Promise.all([
        axiosAuth.get('/api/docentes'),
        axiosAuth.get('/api/grupos'),
        axiosAuth.get('/api/materias'),
      ]);
      setDocentes(rDoc.data.data);
      setGrupos(rGru.data.data);
      setMaterias(rMat.data.data);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  async function cargarAsignaciones(docenteId) {
    try {
      const resp = await axiosAuth.get(`/api/docentes/${docenteId}/asignaciones`);
      setAsignaciones(prev => ({ ...prev, [docenteId]: resp.data.data }));
    } catch {
      setError('Error al cargar las asignaciones');
    }
  }

  function toggleDocente(id) {
    if (docenteAbierto === id) {
      setDocenteAbierto(null);
    } else {
      setDocenteAbierto(id);
      if (!asignaciones[id]) cargarAsignaciones(id);
      setFormAsig({ docente_id: id, grupo_id: '', materia_id: '' });
      const docente = docentes.find(d => d.id === id);
      setDirGrupoSel(prev => ({ ...prev, [id]: docente?.grupo_dirigido_id ? String(docente.grupo_dirigido_id) : '' }));
    }
  }

  async function handleGuardarDirector(docenteId, grupoIdExplicito) {
    setGuardandoDirector(true); setError('');
    try {
      const grupoId = grupoIdExplicito !== undefined ? grupoIdExplicito : (dirGrupoSel[docenteId] || null);
      await axiosAuth.put(`/api/docentes/${docenteId}/grupo-dirigido`, { grupo_id: grupoId });
      setMensaje(grupoId ? 'Director de grupo asignado' : 'Director de grupo removido');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el director de grupo');
    } finally {
      setGuardandoDirector(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await axiosAuth.post('/api/docentes', {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        grupo_dirigido_id: form.esDirectorGrupo && form.grupoDirigidoId ? form.grupoDirigidoId : null,
      });
      setForm({ nombre: '', email: '', password: '', esDirectorGrupo: false, grupoDirigidoId: '' });
      setMensaje('Docente creado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el docente');
    } finally {
      setGuardando(false);
    }
  }

  async function handleAsignar(e) {
    e.preventDefault();
    if (!formAsig.grupo_id || !formAsig.materia_id) return setError('Selecciona grupo y materia');
    try {
      await axiosAuth.post('/api/docentes/asignar', formAsig);
      setMensaje('Asignación creada');
      await cargarAsignaciones(formAsig.docente_id);
      setFormAsig(prev => ({ ...prev, grupo_id: '', materia_id: '' }));
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la asignación');
    }
  }

  async function handleEliminarAsignacion(asigId, docenteId) {
    try {
      await axiosAuth.delete(`/api/docentes/asignacion/${asigId}`);
      await cargarAsignaciones(docenteId);
    } catch {
      setError('Error al eliminar la asignación');
    }
  }

  async function handleDesactivar(id) {
    if (!window.confirm('¿Desactivar este docente?')) return;
    try {
      await axiosAuth.delete(`/api/docentes/${id}`);
      await cargar();
    } catch {
      setError('Error al desactivar el docente');
    }
  }

  // Grupos que ya tienen un director de grupo asignado (a otro docente) — no
  // se muestran como opción, porque un grupo solo puede tener uno.
  const gruposConDirector = new Set(docentes.filter(d => d.grupo_dirigido_id).map(d => d.grupo_dirigido_id));
  const gruposDisponiblesDireccion = grupos.filter(g => !gruposConDirector.has(g.id));

  return (
    <div style={es.pagina}>
      <Navbar titulo="Docentes" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Formulario crear */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Agregar docente</h3>
          <form onSubmit={handleCrear} style={es.form}>
            <input type="text" placeholder="Nombre completo *" required value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })} style={es.input} />
            <input type="email" placeholder="Correo electrónico *" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} style={es.input} />
            <input type="password" placeholder="Contraseña *" required value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} style={es.input} />

            <label style={es.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.esDirectorGrupo}
                onChange={e => setForm({ ...form, esDirectorGrupo: e.target.checked, grupoDirigidoId: '' })}
              />
              Es director de grupo
            </label>

            {form.esDirectorGrupo && (
              <select
                value={form.grupoDirigidoId}
                onChange={e => setForm({ ...form, grupoDirigidoId: e.target.value })}
                style={{ ...es.select, flex: 1, minWidth: '160px' }}
                required
              >
                <option value="">— ¿De cuál grupo? —</option>
                {gruposDisponiblesDireccion.map(g => (
                  <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>
                ))}
              </select>
            )}

            <button type="submit" disabled={guardando} style={es.btnPrimario}>
              {guardando ? 'Guardando...' : '+ Agregar docente'}
            </button>
          </form>
          {mensaje && <div style={es.exito}>{mensaje}</div>}
          {error && <div style={es.errorBox}>{error}</div>}
        </div>

        {/* Lista de docentes */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Docentes registrados ({docentes.length})</h3>
          {cargando ? <p style={es.textoGris}>Cargando...</p> : docentes.length === 0 ? (
            <p style={es.textoGris}>No hay docentes registrados.</p>
          ) : (
            docentes.map(d => (
              <div key={d.id} style={es.docenteItem}>
                <div style={es.docenteHeader}>
                  <div>
                    <strong style={{ fontSize: '15px' }}>{d.nombre}</strong>
                    <span style={es.email}>{d.email}</span>
                    {d.nombre_colegio && <span style={es.colegioBadge}>{d.nombre_colegio}</span>}
                    {d.grupo_dirigido_id && (
                      <span style={es.directorBadge}>Director de {d.grado_grupo_dirigido}° {d.nombre_grupo_dirigido}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => toggleDocente(d.id)} style={es.btnSecundario}>
                      {docenteAbierto === d.id ? 'Cerrar' : 'Ver asignaciones'}
                    </button>
                    <button onClick={() => handleDesactivar(d.id)} style={es.btnPeligro}>Desactivar</button>
                  </div>
                </div>

                {docenteAbierto === d.id && (
                  <div style={es.asignacionesPanel}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '8px' }}>
                      Director de grupo
                    </p>
                    {d.grupo_dirigido_id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                        <span style={es.directorBadge}>Director Grupo {d.grado_grupo_dirigido}-{d.nombre_grupo_dirigido}</span>
                        <button
                          onClick={() => handleGuardarDirector(d.id, null)}
                          disabled={guardandoDirector}
                          style={es.btnPeligro}
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
                        <select
                          value={dirGrupoSel[d.id] ?? ''}
                          onChange={e => setDirGrupoSel(prev => ({ ...prev, [d.id]: e.target.value }))}
                          style={{ ...es.select, flex: 1, minWidth: '160px' }}
                        >
                          <option value="">— Selecciona un grupo disponible —</option>
                          {grupos
                            .filter(g => !gruposConDirector.has(g.id))
                            .map(g => (
                              <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleGuardarDirector(d.id)}
                          disabled={guardandoDirector || !dirGrupoSel[d.id]}
                          style={es.btnPrimario}
                        >
                          {guardandoDirector ? 'Guardando...' : 'Asignar'}
                        </button>
                      </div>
                    )}

                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '12px' }}>
                      Asignaciones de {d.nombre}
                    </p>

                    {/* Lista de asignaciones actuales */}
                    {(asignaciones[d.id] || []).length === 0 ? (
                      <p style={es.textoGris}>Sin asignaciones aún.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        {(asignaciones[d.id] || []).map(a => (
                          <div key={a.id} style={es.asigTag}>
                            <span>{a.grado}° {a.nombre_grupo} — {a.nombre_materia}</span>
                            <button onClick={() => handleEliminarAsignacion(a.id, d.id)} style={es.btnEliminarTag}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulario nueva asignación */}
                    <form onSubmit={handleAsignar} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select value={formAsig.grupo_id}
                        onChange={e => setFormAsig({ ...formAsig, grupo_id: e.target.value, docente_id: d.id })}
                        style={{ ...es.select, flex: 1, minWidth: '160px' }} required>
                        <option value="">— Grupo —</option>
                        {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
                      </select>
                      <select value={formAsig.materia_id}
                        onChange={e => setFormAsig({ ...formAsig, materia_id: e.target.value, docente_id: d.id })}
                        style={{ ...es.select, flex: 1, minWidth: '160px' }} required>
                        <option value="">— Materia —</option>
                        {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                      <button type="submit" style={es.btnPrimario}>+ Asignar</button>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSecundario: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  exito: { marginTop: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  errorBox: { marginTop: '12px', background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  textoGris: { color: '#888', fontSize: '14px' },
  docenteItem: { borderBottom: '1px solid #f0f0f0', paddingBottom: '12px', marginBottom: '12px' },
  docenteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  email: { display: 'block', fontSize: '13px', color: '#888', marginTop: '2px' },
  colegioBadge: { display: 'inline-block', background: '#ede7f6', color: '#5e35b1', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', marginTop: '4px', marginLeft: '8px' },
  directorBadge: { display: 'inline-block', background: '#e8f5e9', color: '#2e7d32', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', marginTop: '4px', marginLeft: '8px', fontWeight: '600' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#333', minWidth: '160px' },
  asignacionesPanel: { marginTop: '16px', background: '#f8f8ff', borderRadius: '12px', padding: '16px' },
  asigTag: { display: 'flex', alignItems: 'center', gap: '6px', background: '#ede7f6', borderRadius: '20px', padding: '4px 12px', fontSize: '13px', color: '#5e35b1' },
  btnEliminarTag: { background: 'none', border: 'none', cursor: 'pointer', color: '#9c27b0', fontWeight: '700', fontSize: '16px', lineHeight: 1, padding: 0, fontFamily: 'inherit' },
};
