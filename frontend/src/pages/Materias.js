import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox, IconBookOpen, IconUser } from '../components/Icons';

const FORM_MATERIA_VACIO = { area_id: '', codigo: '', nombre: '', descripcion: '' };

export default function Materias() {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [areas, setAreas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [pensumGrado, setPensumGrado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardandoMateria, setGuardandoMateria] = useState(false);
  const [guardandoAsig, setGuardandoAsig] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formMateria, setFormMateria] = useState(FORM_MATERIA_VACIO);
  const [formAsig, setFormAsig] = useState({ grupo_id: '', materia_id: '', docente_id: '', intensidad_horaria_semanal: '' });
  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rAsig, rMat, rAreas, rGru, rDoc] = await Promise.all([
        axiosAuth.get('/api/materias/asignaciones'),
        axiosAuth.get('/api/materias'),
        axiosAuth.get('/api/areas-academicas'),
        axiosAuth.get('/api/grupos'),
        axiosAuth.get('/api/docentes'),
      ]);
      setAsignaciones(rAsig.data.data);
      setMaterias(rMat.data.data);
      setAreas(rAreas.data.data);
      setGrupos(rGru.data.data.filter(g => g.activo));
      setDocentes(rDoc.data.data.filter(d => d.activo));
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  function abrirModalCrear() {
    setEditandoId(null);
    setFormMateria(FORM_MATERIA_VACIO);
    setError('');
    setModalAbierto(true);
  }

  function abrirModalEditar(m) {
    setEditandoId(m.id);
    setFormMateria({
      area_id: m.area_id || '',
      codigo: m.codigo || '',
      nombre: m.nombre || '',
      descripcion: m.descripcion || '',
    });
    setError('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
  }

  async function guardarMateria(e) {
    e.preventDefault();
    setGuardandoMateria(true); setError('');
    try {
      const payload = {
        nombre: formMateria.nombre,
        codigo: formMateria.codigo,
        descripcion: formMateria.descripcion || null,
        area_id: formMateria.area_id || null,
      };
      if (editandoId) {
        await axiosAuth.put(`/api/materias/${editandoId}`, payload);
        mostrarMensaje('Asignatura actualizada correctamente');
      } else {
        await axiosAuth.post('/api/materias', payload);
        mostrarMensaje('Asignatura creada correctamente');
      }
      setModalAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la asignatura');
    } finally {
      setGuardandoMateria(false);
    }
  }

  async function handleDesactivarMateria(id) {
    if (!window.confirm('¿Desactivar esta asignatura? Dejará de aparecer en las listas.')) return;
    try {
      await axiosAuth.delete(`/api/materias/${id}`);
      mostrarMensaje('Asignatura desactivada');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al desactivar la asignatura');
    }
  }

  // Cuando cambia el grupo, trae el pénsum de su grado para filtrar las
  // materias disponibles (si el colegio no lo ha definido, se muestran todas).
  async function seleccionarGrupo(grupo_id) {
    setFormAsig({ ...formAsig, grupo_id, materia_id: '' });
    setPensumGrado(null);
    const grupo = grupos.find(g => String(g.id) === String(grupo_id));
    if (!grupo) return;
    try {
      const resp = await axiosAuth.get(`/api/grado-materias/${grupo.grado}`);
      setPensumGrado(resp.data.data.length > 0 ? new Set(resp.data.data) : null);
    } catch {
      setPensumGrado(null);
    }
  }

  async function handleAsignar(e) {
    e.preventDefault();
    if (!formAsig.grupo_id || !formAsig.materia_id || !formAsig.docente_id) {
      return setError('Debes seleccionar grupo, materia y docente');
    }
    setGuardandoAsig(true); setError('');
    try {
      await axiosAuth.post('/api/docentes/asignar', {
        docente_id: formAsig.docente_id,
        grupo_id: formAsig.grupo_id,
        materia_id: formAsig.materia_id,
        intensidad_horaria_semanal: formAsig.intensidad_horaria_semanal || null,
      });
      setFormAsig({ grupo_id: '', materia_id: '', docente_id: '', intensidad_horaria_semanal: '' });
      setPensumGrado(null);
      mostrarMensaje('Clase definida correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al definir la clase');
    } finally {
      setGuardandoAsig(false);
    }
  }

  async function handleEliminarAsig(id) {
    if (!window.confirm('¿Eliminar esta asignación?')) return;
    try {
      await axiosAuth.delete(`/api/docentes/asignacion/${id}`);
      mostrarMensaje('Asignación eliminada');
      await cargar();
    } catch {
      setError('Error al eliminar la asignación');
    }
  }

  // Agrupar asignaciones por grupo
  const porGrupo = asignaciones.reduce((acc, a) => {
    const key = `${a.grado}-${a.nombre_grupo}`;
    if (!acc[key]) acc[key] = { grado: a.grado, nombre: a.nombre_grupo, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  // Agrupar asignaturas por área (las sin área quedan al final)
  const porArea = materias.reduce((acc, m) => {
    const key = m.area_id || 'sin-area';
    if (!acc[key]) acc[key] = { nombre: m.nombre_area || 'Sin área asignada', codigo: m.codigo_area || '', items: [] };
    acc[key].items.push(m);
    return acc;
  }, {});
  const gruposArea = Object.entries(porArea).sort(([a], [b]) => (a === 'sin-area' ? 1 : b === 'sin-area' ? -1 : 0));

  return (
    <div style={es.pagina}>
      <Navbar titulo="Materias" />
      <div style={es.contenido}>
        <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>← Volver al panel</button>

        {mensaje && <div style={es.exito}>{mensaje}</div>}
        {error && <div style={es.errorBox}>{error}</div>}

        {/* SECCIÓN 1: Asignaturas de la institución, agrupadas por área */}
        <div style={es.card}>
          <div style={es.cardEncabezado}>
            <div>
              <h3 style={es.cardTitulo}>1. Asignaturas de la Institución</h3>
              <p style={es.instruccion}>
                Cada asignatura pertenece a un área (definidas en "Definición de Áreas"). El código debe ser corto (ej: MAT, LEN, INF).
              </p>
            </div>
            <button onClick={abrirModalCrear} style={es.btnPrimario}>+ Agregar asignatura</button>
          </div>

          {materias.length === 0 ? (
            <p style={es.textoGris}>No hay asignaturas registradas todavía.</p>
          ) : (
            gruposArea.map(([key, grupo]) => (
              <div key={key} style={es.areaBloque}>
                <div style={es.areaEncabezado}>
                  {grupo.codigo && <span style={es.areaCodigo}>{grupo.codigo}</span>}
                  {grupo.nombre}
                </div>
                <table style={es.tabla}>
                  <tbody>
                    {grupo.items.map(m => (
                      <tr key={m.id} style={es.tr}>
                        <td style={{ ...es.td, width: '90px' }}><span style={es.materiaCodigo}>{m.codigo}</span></td>
                        <td style={es.td}>{m.nombre}</td>
                        <td style={{ ...es.td, textAlign: 'right' }}>
                          {m.colegio_id ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => abrirModalEditar(m)} style={es.btnMiniSec}>Editar</button>
                              <button onClick={() => handleDesactivarMateria(m.id)} style={es.btnMiniPeligro}>Eliminar</button>
                            </div>
                          ) : (
                            <span style={es.compartidaTag}>Compartida</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {modalAbierto && (
          <div style={es.modalFondo} onClick={cerrarModal}>
            <div style={es.modalCaja} onClick={e => e.stopPropagation()}>
              <h3 style={es.modalTitulo}>{editandoId ? 'Edición de Asignatura' : 'Creación de Asignaturas'}</h3>
              <form onSubmit={guardarMateria} style={es.modalForm}>
                <label style={es.modalLabel}>Área de la asignatura</label>
                <select
                  value={formMateria.area_id}
                  onChange={e => setFormMateria({ ...formMateria, area_id: e.target.value })}
                  style={es.select}
                >
                  <option value="">— Sin área —</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
                </select>

                <label style={es.modalLabel}>Código de la asignatura</label>
                <input
                  type="text" required maxLength={20}
                  value={formMateria.codigo}
                  onChange={e => setFormMateria({ ...formMateria, codigo: e.target.value })}
                  style={es.input}
                />

                <label style={es.modalLabel}>Nombre</label>
                <input
                  type="text" required
                  value={formMateria.nombre}
                  onChange={e => setFormMateria({ ...formMateria, nombre: e.target.value })}
                  style={es.input}
                />

                <label style={es.modalLabel}>Descripción (opcional)</label>
                <input
                  type="text"
                  value={formMateria.descripcion}
                  onChange={e => setFormMateria({ ...formMateria, descripcion: e.target.value })}
                  style={es.input}
                />

                <div style={es.modalAcciones}>
                  <button type="submit" disabled={guardandoMateria} style={es.btnPrimario}>
                    {guardandoMateria ? 'Guardando...' : (editandoId ? 'Guardar' : 'Agregar')}
                  </button>
                  <button type="button" onClick={cerrarModal} style={es.btnSecundario}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECCIÓN 2: Definición de clases (asignatura + docente para un grupo) */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>2. Definición de clases</h3>
          <p style={es.instruccion}>
            Selecciona el grupo, la asignatura, el docente que la dictará y las horas semanales. Así los
            estudiantes de ese grupo podrán ver la clase con su docente asignado.
          </p>
          <form onSubmit={handleAsignar} style={es.form}>
            <select
              value={formAsig.grupo_id}
              onChange={e => seleccionarGrupo(e.target.value)}
              style={es.select} required
            >
              <option value="">— Selecciona el grupo —</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
            </select>
            <select
              value={formAsig.materia_id}
              onChange={e => setFormAsig({ ...formAsig, materia_id: e.target.value })}
              style={es.select} required
            >
              <option value="">— Selecciona la asignatura —</option>
              {materias
                .filter(m => !pensumGrado || pensumGrado.has(m.id))
                .map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <select
              value={formAsig.docente_id}
              onChange={e => setFormAsig({ ...formAsig, docente_id: e.target.value })}
              style={es.select} required
            >
              <option value="">— Selecciona el docente —</option>
              {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <input
              type="number" min="1" placeholder="Horas/semana"
              value={formAsig.intensidad_horaria_semanal}
              onChange={e => setFormAsig({ ...formAsig, intensidad_horaria_semanal: e.target.value })}
              style={{ ...es.input, maxWidth: '130px' }}
            />
            <button type="submit" disabled={guardandoAsig} style={es.btnPrimario}>
              {guardandoAsig ? 'Guardando...' : '+ Agregar clase'}
            </button>
          </form>
          {formAsig.grupo_id && pensumGrado && (
            <p style={es.notaPensum}>Mostrando solo las asignaturas definidas en el pénsum de este grado.</p>
          )}
        </div>

        {/* SECCIÓN 3: Clases definidas por grupo */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>3. Clases definidas</h3>
          {cargando ? (
            <p style={es.textoGris}>Cargando...</p>
          ) : Object.keys(porGrupo).length === 0 ? (
            <div style={es.sinDatos}>
              <IconInbox size={40} style={{ color: '#ccc' }} />
              <p>No hay clases definidas aún. Usa la sección de arriba para crear la primera.</p>
            </div>
          ) : (
            Object.values(porGrupo)
              .sort((a, b) => a.grado - b.grado)
              .map(grupo => (
                <div key={`${grupo.grado}-${grupo.nombre}`} style={es.grupoBloque}>
                  <div style={es.grupoTitulo}>
                    <span style={es.gradoBadge}>{grupo.grado}°</span>
                    <span>Grupo {grupo.nombre}</span>
                  </div>
                  <div style={es.asigGrid}>
                    {grupo.items.map(a => (
                      <div key={a.id} style={es.asigCard}>
                        <div style={es.asigMateria}><IconBookOpen size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{a.nombre_materia}</div>
                        <div style={es.asigDocente}><IconUser size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{a.nombre_docente}</div>
                        {a.intensidad_horaria_semanal && (
                          <div style={es.asigHoras}>{a.intensidad_horaria_semanal} hora(s)/semana</div>
                        )}
                        <button onClick={() => handleEliminarAsig(a.id)} style={es.btnEliminar}>
                          Eliminar clase
                        </button>
                      </div>
                    ))}
                  </div>
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
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '10px' },
  instruccion: { fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  input: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '180px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  textoGris: { color: '#888', fontSize: '14px' },
  subtitulo: { fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '10px' },
  materiaCodigo: { fontSize: '12px', color: '#764ba2', background: '#f0e9f7', borderRadius: '6px', padding: '3px 8px', fontWeight: '700' },
  sinDatos: { textAlign: 'center', padding: '32px', color: '#888' },

  cardEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' },
  areaBloque: { marginBottom: '18px' },
  areaEncabezado: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px 8px 0 0', background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', fontSize: '13px', fontWeight: '700' },
  areaCodigo: { background: 'rgba(255,255,255,0.25)', borderRadius: '6px', padding: '2px 7px', fontSize: '11.5px' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  tr: { borderBottom: '1px solid #f0e9f7' },
  td: { padding: '9px 12px', fontSize: '13.5px', color: '#374151' },
  compartidaTag: { fontSize: '11.5px', color: '#999', fontStyle: 'italic' },
  btnMiniSec: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniPeligro: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  modalFondo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modalCaja: { background: '#fff', borderRadius: '14px', padding: '26px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
  modalTitulo: { fontSize: '16px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 18px' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '4px' },
  modalLabel: { fontSize: '12.5px', fontWeight: '600', color: '#666', marginTop: '10px' },
  modalAcciones: { display: 'flex', gap: '10px', marginTop: '20px' },
  btnSecundario: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  grupoBloque: { marginBottom: '24px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' },
  grupoTitulo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '12px' },
  gradoBadge: { background: '#ede7f6', color: '#5e35b1', borderRadius: '20px', padding: '3px 10px', fontSize: '13px', fontWeight: '700' },
  asigGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  asigCard: { background: '#f8f8ff', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  asigMateria: { fontSize: '15px', fontWeight: '700', color: '#333' },
  asigDocente: { fontSize: '13px', color: '#555' },
  asigHoras: { fontSize: '12px', color: '#764ba2', fontWeight: '600' },
  notaPensum: { fontSize: '12px', color: '#888', marginTop: '10px', fontStyle: 'italic' },
  btnEliminar: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', marginTop: '4px' },
};
