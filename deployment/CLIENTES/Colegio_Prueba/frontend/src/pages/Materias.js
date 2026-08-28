import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconInbox, IconBookOpen, IconUser } from '../components/Icons';

export default function Materias() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoMateria, setGuardandoMateria] = useState(false);
  const [guardandoAsig, setGuardandoAsig] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [formMateria, setFormMateria] = useState({ nombre: '', codigo: '', descripcion: '' });
  const [formAsig, setFormAsig] = useState({ grupo_id: '', materia_id: '', docente_id: '' });
  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rAsig, rMat, rGru, rDoc] = await Promise.all([
        axiosAuth.get('/api/materias/asignaciones'),
        axiosAuth.get('/api/materias'),
        axiosAuth.get('/api/grupos'),
        axiosAuth.get('/api/docentes'),
      ]);
      setAsignaciones(rAsig.data.data);
      setMaterias(rMat.data.data);
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

  async function handleCrearMateria(e) {
    e.preventDefault();
    setGuardandoMateria(true); setError('');
    try {
      await axiosAuth.post('/api/materias', formMateria);
      setFormMateria({ nombre: '', codigo: '', descripcion: '' });
      mostrarMensaje('Materia creada correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la materia');
    } finally {
      setGuardandoMateria(false);
    }
  }

  async function handleDesactivarMateria(id) {
    if (!window.confirm('¿Desactivar esta materia? Dejará de aparecer en las listas.')) return;
    try {
      await axiosAuth.delete(`/api/materias/${id}`);
      mostrarMensaje('Materia desactivada');
      await cargar();
    } catch {
      setError('Error al desactivar la materia');
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
      });
      setFormAsig({ grupo_id: '', materia_id: '', docente_id: '' });
      mostrarMensaje('Asignación creada correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la asignación');
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

  return (
    <div style={es.pagina}>
      <Navbar titulo="Materias" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {mensaje && <div style={es.exito}>{mensaje}</div>}
        {error && <div style={es.errorBox}>{error}</div>}

        {/* SECCIÓN 1: Crear materia */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>1. Crear materia</h3>
          <p style={es.instruccion}>
            Primero crea las materias que se van a dictar. El código debe ser corto y único (ej: MAT, LEN, INF).
          </p>
          <form onSubmit={handleCrearMateria} style={es.form}>
            <input
              type="text" placeholder="Nombre de la materia *" required
              value={formMateria.nombre}
              onChange={e => setFormMateria({ ...formMateria, nombre: e.target.value })}
              style={es.input}
            />
            <input
              type="text" placeholder="Código único *  (ej: MAT)" required
              maxLength={20}
              value={formMateria.codigo}
              onChange={e => setFormMateria({ ...formMateria, codigo: e.target.value })}
              style={{ ...es.input, maxWidth: '160px' }}
            />
            <input
              type="text" placeholder="Descripción (opcional)"
              value={formMateria.descripcion}
              onChange={e => setFormMateria({ ...formMateria, descripcion: e.target.value })}
              style={es.input}
            />
            <button type="submit" disabled={guardandoMateria} style={es.btnPrimario}>
              {guardandoMateria ? 'Guardando...' : '+ Crear materia'}
            </button>
          </form>

          {/* Lista de materias existentes */}
          {materias.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <p style={es.subtitulo}>Materias registradas:</p>
              <div style={es.materiasGrid}>
                {materias.map(m => (
                  <div key={m.id} style={es.materiaTag}>
                    <div>
                      <span style={es.materiaNombre}>{m.nombre}</span>
                      <span style={es.materiaCodigo}>{m.codigo}</span>
                    </div>
                    <button onClick={() => handleDesactivarMateria(m.id)} style={es.btnEliminarTag}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 2: Asignar materia a grupo */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>2. Asignar materia a un grupo</h3>
          <p style={es.instruccion}>
            Selecciona el grupo, la materia y el docente que la dictará. Así los estudiantes de ese grupo podrán ver la materia con su docente asignado.
          </p>
          <form onSubmit={handleAsignar} style={es.form}>
            <select
              value={formAsig.grupo_id}
              onChange={e => setFormAsig({ ...formAsig, grupo_id: e.target.value })}
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
              <option value="">— Selecciona la materia —</option>
              {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <select
              value={formAsig.docente_id}
              onChange={e => setFormAsig({ ...formAsig, docente_id: e.target.value })}
              style={es.select} required
            >
              <option value="">— Selecciona el docente —</option>
              {docentes.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <button type="submit" disabled={guardandoAsig} style={es.btnPrimario}>
              {guardandoAsig ? 'Asignando...' : '+ Asignar'}
            </button>
          </form>
        </div>

        {/* SECCIÓN 3: Asignaciones actuales por grupo */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>3. Asignaciones actuales</h3>
          {cargando ? (
            <p style={es.textoGris}>Cargando...</p>
          ) : Object.keys(porGrupo).length === 0 ? (
            <div style={es.sinDatos}>
              <IconInbox size={40} style={{ color: '#ccc' }} />
              <p>No hay asignaciones aún. Usa la sección de arriba para crear la primera.</p>
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
                        <button onClick={() => handleEliminarAsig(a.id)} style={es.btnEliminar}>
                          Eliminar asignación
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
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '10px' },
  instruccion: { fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.6 },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  input: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '180px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  textoGris: { color: '#888', fontSize: '14px' },
  subtitulo: { fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '10px' },
  materiasGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  materiaTag: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f0f0ff', borderRadius: '10px', padding: '8px 12px' },
  materiaNombre: { fontSize: '14px', fontWeight: '600', color: '#333', marginRight: '6px' },
  materiaCodigo: { fontSize: '12px', color: '#888', background: '#e8e8e8', borderRadius: '6px', padding: '2px 6px' },
  btnEliminarTag: { background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontWeight: '700', fontSize: '18px', lineHeight: 1, padding: 0, fontFamily: 'inherit' },
  sinDatos: { textAlign: 'center', padding: '32px', color: '#888' },
  grupoBloque: { marginBottom: '24px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' },
  grupoTitulo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '12px' },
  gradoBadge: { background: '#ede7f6', color: '#5e35b1', borderRadius: '20px', padding: '3px 10px', fontSize: '13px', fontWeight: '700' },
  asigGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  asigCard: { background: '#f8f8ff', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  asigMateria: { fontSize: '15px', fontWeight: '700', color: '#333' },
  asigDocente: { fontSize: '13px', color: '#555' },
  btnEliminar: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', marginTop: '4px' },
};
