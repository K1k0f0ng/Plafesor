import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';

export default function Estudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [tab, setTab] = useState('individual');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', grupo_id: '', telefono_padres: '' });
  const [editando,   setEditando]   = useState(null);
  const [editForm,   setEditForm]   = useState({ nombre: '', email: '', grupo_id: '', telefono_padres: '' });
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // CSV
  const [csvGrupoId, setCsvGrupoId] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvNombreArchivo, setCsvNombreArchivo] = useState('');
  const [csvResultado, setCsvResultado] = useState(null);

  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rEst, rGru] = await Promise.all([
        axiosAuth.get('/api/estudiantes'),
        axiosAuth.get('/api/grupos'),
      ]);
      setEstudiantes(rEst.data.data);
      setGrupos(rGru.data.data);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  async function handleCrearIndividual(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await axiosAuth.post('/api/estudiantes', form);
      setForm({ nombre: '', email: '', password: '', grupo_id: '', telefono_padres: '' });
      setFiltroGrupo('');
      setMensaje('Estudiante creado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el estudiante');
    } finally {
      setGuardando(false);
    }
  }

  function parsearCSV(texto) {
    const lineas = texto.trim().split('\n').filter(l => l.trim());
    if (lineas.length === 0) return [];
    const primera = lineas[0].toLowerCase();
    const inicio = (primera.includes('nombre') || primera.includes('email')) ? 1 : 0;
    return lineas.slice(inicio).map(linea => {
      const partes = linea.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      return { nombre: partes[0] || '', email: partes[1] || '', password: partes[2] || '123456' };
    }).filter(e => e.nombre && e.email);
  }

  function handleArchivoCSV(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setCsvNombreArchivo(archivo.name);
    setCsvResultado(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const alumnos = parsearCSV(ev.target.result);
      setCsvPreview(alumnos);
      if (alumnos.length === 0) {
        setError('No se encontraron alumnos válidos en el archivo. Verifica el formato.');
      }
    };
    reader.readAsText(archivo, 'UTF-8');
  }

  function descargarPlantilla() {
    const contenido = 'nombre,email,contraseña\nJuan Pérez,juan@correo.com,clave123\nMaría López,maria@correo.com,clave456\nCarlos García,carlos@correo.com,clave789';
    const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_alumnos_playfesor.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportarCSV() {
    if (csvPreview.length === 0) return;
    setGuardando(true); setError('');
    const estudiantesAEnviar = csvPreview.map(e => ({
      ...e,
      grupo_id: csvGrupoId || null,
    }));
    try {
      const resp = await axiosAuth.post('/api/estudiantes/importar', { estudiantes: estudiantesAEnviar });
      setCsvResultado(resp.data);
      setCsvPreview([]);
      setCsvNombreArchivo('');
      setFiltroGrupo('');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error en la importación');
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicion(est) {
    setEditForm({
      nombre:          est.nombre,
      email:           est.email,
      grupo_id:        est.grupo_id || '',
      telefono_padres: est.telefono_padres || '',
    });
    setEditando(est);
    setError('');
  }

  async function handleGuardarEdicion() {
    if (!editForm.nombre || !editForm.email) return;
    setGuardandoEdit(true); setError('');
    try {
      await axiosAuth.put(`/api/estudiantes/${editando.id}`, editForm);
      setEditando(null);
      setMensaje('Estudiante actualizado correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el estudiante');
    } finally {
      setGuardandoEdit(false);
    }
  }

  async function handleDesactivar(id) {
    if (!window.confirm('¿Desactivar este estudiante?')) return;
    try {
      await axiosAuth.delete(`/api/estudiantes/${id}`);
      await cargar();
    } catch {
      setError('Error al desactivar el estudiante');
    }
  }

  const estudiantesFiltrados = filtroGrupo
    ? estudiantes.filter(e => e.grupo_id === parseInt(filtroGrupo))
    : estudiantes;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Estudiantes" />

      {/* Panel lateral — editar estudiante */}
      {editando && (
        <>
          <div onClick={() => setEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: '400px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'linear-gradient(135deg,var(--color-primario),var(--color-secundario))', color: '#fff' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>Editar estudiante</div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{editando.nombre}</div>
              </div>
              <button onClick={() => setEditando(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>✕</button>
            </div>

            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {error && <div style={es.errorBox}>{error}</div>}

              <div>
                <label style={es.labelPanel}>Nombre completo *</label>
                <input style={es.inputPanel} value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
              </div>
              <div>
                <label style={es.labelPanel}>Correo electrónico *</label>
                <input style={es.inputPanel} type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label style={es.labelPanel}>Grupo</label>
                <select style={es.inputPanel} value={editForm.grupo_id} onChange={e => setEditForm({ ...editForm, grupo_id: e.target.value })}>
                  <option value="">— Sin grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={es.labelPanel}>Teléfono del acudiente</label>
                <input style={es.inputPanel} type="tel" placeholder="3001234567" value={editForm.telefono_padres} onChange={e => setEditForm({ ...editForm, telefono_padres: e.target.value })} />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f5', display: 'flex', gap: '10px' }}>
              <button onClick={() => setEditando(null)} style={{ ...es.btnPeligro, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button
                onClick={handleGuardarEdicion}
                disabled={guardandoEdit || !editForm.nombre || !editForm.email}
                style={{ ...es.btnPrimario, flex: 2, opacity: (guardandoEdit || !editForm.nombre || !editForm.email) ? 0.5 : 1 }}
              >
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </>
      )}
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Tabs */}
        <div style={es.tabs}>
          <button onClick={() => setTab('individual')} style={{ ...es.tab, ...(tab === 'individual' ? es.tabActivo : {}) }}>
            Agregar individual
          </button>
          <button onClick={() => setTab('csv')} style={{ ...es.tab, ...(tab === 'csv' ? es.tabActivo : {}) }}>
            Importar por CSV
          </button>
        </div>

        {/* Formulario individual */}
        {tab === 'individual' && (
          <div style={es.card}>
            <h3 style={es.cardTitulo}>Agregar estudiante</h3>
            <form onSubmit={handleCrearIndividual} style={es.form}>
              <input type="text" placeholder="Nombre completo *" required value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })} style={es.input} />
              <input type="email" placeholder="Correo electrónico *" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} style={es.input} />
              <input type="password" placeholder="Contraseña *" required value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} style={es.input} />
              <select value={form.grupo_id} onChange={e => setForm({ ...form, grupo_id: e.target.value })} style={es.select}>
                <option value="">— Grupo (opcional) —</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
              </select>
              <input type="tel" placeholder="Teléfono del padre/madre (opcional)" value={form.telefono_padres}
                onChange={e => setForm({ ...form, telefono_padres: e.target.value })} style={es.input} />
              <button type="submit" disabled={guardando} style={es.btnPrimario}>
                {guardando ? 'Guardando...' : '+ Agregar'}
              </button>
            </form>
            {mensaje && <div style={es.exito}>{mensaje}</div>}
            {error && <div style={es.errorBox}>{error}</div>}
          </div>
        )}

        {/* Importación CSV */}
        {tab === 'csv' && (
          <div style={es.card}>
            <h3 style={es.cardTitulo}>Importar alumnos desde archivo CSV</h3>

            {/* Paso 1 */}
            <div style={es.pasoBox}>
              <span style={es.pasoBadge}>1</span>
              <div style={{ flex: 1 }}>
                <p style={es.pasoTitulo}>Asignar grupo <span style={es.opcional}>(opcional — todos los alumnos del archivo quedarán en el mismo grupo)</span></p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <select value={csvGrupoId} onChange={e => setCsvGrupoId(e.target.value)} style={{ ...es.select, maxWidth: '240px' }}>
                    <option value="">— Sin grupo —</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div style={es.pasoBox}>
              <span style={es.pasoBadge}>2</span>
              <div style={{ flex: 1 }}>
                <p style={es.pasoTitulo}>Seleccionar archivo CSV</p>
                <div style={es.zonaArchivo}>
                  <input
                    type="file" accept=".csv" id="csvFile"
                    style={{ display: 'none' }}
                    onChange={handleArchivoCSV}
                  />
                  <label htmlFor="csvFile" style={es.btnSeleccionar}>
                    Seleccionar archivo .CSV
                  </label>
                  {csvNombreArchivo && (
                    <span style={es.nombreArchivo}>Archivo: {csvNombreArchivo}</span>
                  )}
                </div>
                <p style={es.ayudaCSV}>
                  Formato requerido: <code style={es.codigo}>nombre,email,contraseña</code>
                  {' · La primera fila puede ser el encabezado (se detecta automáticamente)'}
                  {' · '}
                  <button type="button" onClick={descargarPlantilla} style={es.btnPlantilla}>
                    Descargar plantilla de ejemplo
                  </button>
                </p>
              </div>
            </div>

            {/* Paso 3: Vista previa */}
            {csvPreview.length > 0 && (
              <div style={es.pasoBox}>
                <span style={es.pasoBadge}>3</span>
                <div style={{ flex: 1 }}>
                  <p style={es.pasoTitulo}>
                    Vista previa — {csvPreview.length} alumno{csvPreview.length !== 1 ? 's' : ''} encontrado{csvPreview.length !== 1 ? 's' : ''}
                  </p>
                  <div style={es.previsualizacion}>
                    <table style={es.tabla}>
                      <thead>
                        <tr>
                          {['#', 'Nombre', 'Correo', 'Contraseña'].map(h => (
                            <th key={h} style={es.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0, 10).map((alumno, i) => (
                          <tr key={i} style={es.tr}>
                            <td style={{ ...es.td, color: '#bbb', fontSize: '12px' }}>{i + 1}</td>
                            <td style={es.td}>{alumno.nombre}</td>
                            <td style={es.td}>{alumno.email}</td>
                            <td style={es.td}>
                              <span style={es.tagPass}>
                                {alumno.password === '123456' ? '123456 (por defecto)' : '••••••'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <p style={{ ...es.textoGris, marginTop: '8px', textAlign: 'center', fontSize: '13px' }}>
                        ... y {csvPreview.length - 10} alumno{csvPreview.length - 10 !== 1 ? 's' : ''} más
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleImportarCSV}
                    disabled={guardando}
                    style={{ ...es.btnPrimario, marginTop: '16px' }}
                  >
                    {guardando ? 'Importando...' : `Importar ${csvPreview.length} alumno${csvPreview.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}

            {/* Resultado de la importación */}
            {csvResultado && (
              <div style={csvResultado.errores.length === 0 ? es.exito : es.resultadoMixto}>
                <strong>{csvResultado.creados.length} alumno{csvResultado.creados.length !== 1 ? 's' : ''} importado{csvResultado.creados.length !== 1 ? 's' : ''} correctamente.</strong>
                {csvResultado.errores.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>{csvResultado.errores.length} error{csvResultado.errores.length !== 1 ? 'es' : ''}:</strong>
                    {csvResultado.errores.map((err, i) => (
                      <div key={i} style={{ fontSize: '13px', marginTop: '4px' }}>
                        • {err.email}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <div style={es.errorBox}>{error}</div>}
          </div>
        )}

        {/* Lista de estudiantes */}
        <div style={es.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ ...es.cardTitulo, marginBottom: 0 }}>Estudiantes registrados ({estudiantesFiltrados.length})</h3>
            <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{ ...es.select, maxWidth: '200px' }}>
              <option value="">Todos los grupos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
            </select>
          </div>

          {cargando ? <p style={es.textoGris}>Cargando...</p> : estudiantesFiltrados.length === 0 ? (
            <p style={es.textoGris}>No hay estudiantes registrados.</p>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>{['Nombre', 'Correo', 'Grupo', 'WhatsApp', 'Estado', 'Acción'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {estudiantesFiltrados.map(e => (
                  <tr key={e.id} style={es.tr}>
                    <td style={es.td}>{e.nombre}</td>
                    <td style={es.td}>{e.email}</td>
                    <td style={es.td}>{e.nombre_grupo ? `${e.grado}° ${e.nombre_grupo}` : '—'}</td>
                    <td style={es.td}>
                      {e.telefono_padres
                        ? <span style={es.badgeWa}>{e.telefono_padres}</span>
                        : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={es.td}>
                      <span style={{ ...es.badge, background: e.activo ? '#e8f5e9' : '#fce4ec', color: e.activo ? '#2e7d32' : '#c62828' }}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={es.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => abrirEdicion(e)} style={es.btnEditar}>Editar</button>
                        <button onClick={() => handleDesactivar(e.id)} style={es.btnPeligro}>Desactivar</button>
                      </div>
                    </td>
                  </tr>
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
  tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: { padding: '10px 20px', borderRadius: '10px', border: '2px solid #e0e0e0', background: '#fff', color: '#888', cursor: 'pointer', fontWeight: '600', fontSize: '14px', fontFamily: 'inherit' },
  tabActivo: { borderColor: 'var(--color-primario)', color: 'var(--color-primario)', background: '#f0f0ff' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  form: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select: { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  exito: { marginTop: '16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '12px 16px', fontSize: '14px' },
  errorBox: { marginTop: '12px', background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  resultadoMixto: { marginTop: '16px', background: '#fff8e1', color: '#e65100', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', border: '1px solid #ffe082' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px', fontSize: '14px', color: '#333' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeWa: { background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  // CSV
  pasoBox: { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #f0f0f0' },
  pasoBadge: { width: '28px', height: '28px', background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0, marginTop: '2px' },
  pasoTitulo: { fontSize: '14px', fontWeight: '700', color: '#333', marginBottom: '10px' },
  opcional: { fontSize: '12px', fontWeight: '400', color: '#999' },
  zonaArchivo: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  btnSeleccionar: { display: 'inline-block', padding: '10px 20px', background: '#f0f0ff', border: '2px dashed #c5cae9', borderRadius: '10px', color: '#5c6bc0', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  nombreArchivo: { fontSize: '13px', color: '#555', background: '#f5f5f5', padding: '6px 12px', borderRadius: '8px' },
  ayudaCSV: { fontSize: '12px', color: '#888', marginTop: '10px', lineHeight: 1.6 },
  codigo: { background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#333' },
  btnPlantilla: { background: 'none', border: 'none', color: 'var(--color-primario)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' },
  previsualizacion: { background: '#fafafa', borderRadius: '10px', border: '1px solid #eee', overflow: 'hidden' },
  tagPass:    { background: '#f3f4f6', color: '#666', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' },
  btnEditar:  { background: '#f0f0ff', border: '1px solid #c5cae9', color: '#5c6bc0', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  labelPanel: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  inputPanel: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' },
};
