import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/FichaEstudiante';
import { CARGOS_DISPONIBLES, nombreCargo } from '../config/cargos';
import { exportarExcel } from '../utils/exportarExcel';

const RUTAS_POR_ROL = { admin: '/dashboard', director: '/dashboard-director' };
const ROL_LABEL = { admin: 'Administrador', director: 'Director' };

const FORM_VACIO = {
  nombres: '', apellidos: '', email: '', password: '',
  rol: 'admin', cargo: '',
  tipo_documento: '', numero_documento: '',
  fecha_nacimiento: '', telefono_residencial: '', direccion_residencial: '',
  telefono_oficina: '', direccion_oficina: '', telefono_celular: '', telefono_otro: '',
  fecha_ingreso_caja_compensacion: '', fecha_ingreso_institucion: '',
};

// Separa el nombre completo guardado ("Nombres Apellidos") de nuevo en dos
// campos para editar — misma convención que el resto de Playfesor.
function partirNombre(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { nombres: palabras.join(' '), apellidos: '' };
  const apellidos = palabras.slice(-2).join(' ');
  const nombres = palabras.slice(0, -2).join(' ');
  return nombres ? { nombres, apellidos } : { nombres: palabras[0], apellidos: palabras.slice(1).join(' ') };
}

export default function Personal() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  const [modulosPersona, setModulosPersona] = useState(null);
  const [modulosCatalogo, setModulosCatalogo] = useState([]);
  const [modulosDesactivadosSel, setModulosDesactivadosSel] = useState(new Set());
  const [cargandoModulos, setCargandoModulos] = useState(false);
  const [guardandoModulos, setGuardandoModulos] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const resp = await axiosAuth.get('/api/personal');
      setLista(resp.data.data);
    } catch {
      setError('No se pudo cargar el personal del colegio.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  function abrirCrear() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setError('');
    setPanelAbierto(true);
  }

  function abrirEditar(p) {
    const { nombres, apellidos } = partirNombre(p.nombre);
    setEditandoId(p.id);
    setForm({
      nombres, apellidos, email: p.email, password: '',
      rol: p.rol, cargo: p.cargo || '',
      tipo_documento: p.tipo_documento || '', numero_documento: p.numero_documento || '',
      fecha_nacimiento: (p.fecha_nacimiento || '').slice(0, 10),
      telefono_residencial: p.telefono_residencial || '', direccion_residencial: p.direccion_residencial || '',
      telefono_oficina: p.telefono_oficina || '', direccion_oficina: p.direccion_oficina || '',
      telefono_celular: p.telefono_celular || '', telefono_otro: p.telefono_otro || '',
      fecha_ingreso_caja_compensacion: (p.fecha_ingreso_caja_compensacion || '').slice(0, 10),
      fecha_ingreso_institucion: (p.fecha_ingreso_institucion || '').slice(0, 10),
    });
    setError('');
    setPanelAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim()) {
      return setError('Nombres, apellidos y correo son obligatorios');
    }
    if (!editandoId && !form.password.trim()) {
      return setError('La contraseña es obligatoria para crear el usuario');
    }
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await axiosAuth.put(`/api/personal/${editandoId}`, form);
      } else {
        await axiosAuth.post('/api/personal', form);
      }
      setPanelAbierto(false);
      await cargar();
      mostrarMensaje(editandoId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el usuario');
    } finally {
      setGuardando(false);
    }
  }

  async function desactivar(p) {
    if (!window.confirm(`¿Desactivar a ${p.nombre}?`)) return;
    try {
      await axiosAuth.delete(`/api/personal/${p.id}`);
      await cargar();
      mostrarMensaje('Usuario desactivado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al desactivar el usuario');
    }
  }

  async function abrirModulos(p) {
    setModulosPersona(p);
    setCargandoModulos(true);
    setError('');
    try {
      const resp = await axiosAuth.get(`/api/personal/${p.id}/modulos`);
      setModulosCatalogo(resp.data.data);
      setModulosDesactivadosSel(new Set(resp.data.data.filter(m => !m.bloqueado_por_colegio && !m.activo).map(m => m.clave)));
    } catch {
      setError('No se pudieron cargar los módulos de este usuario.');
      setModulosPersona(null);
    } finally {
      setCargandoModulos(false);
    }
  }

  function cerrarModulos() {
    setModulosPersona(null);
  }

  function alternarModulo(clave) {
    setModulosDesactivadosSel(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  async function guardarModulos() {
    setGuardandoModulos(true);
    setError('');
    try {
      await axiosAuth.put(`/api/personal/${modulosPersona.id}/modulos`, {
        modulos_desactivados: Array.from(modulosDesactivadosSel),
      });
      setModulosPersona(null);
      mostrarMensaje('Módulos actualizados correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar los módulos');
    } finally {
      setGuardandoModulos(false);
    }
  }

  async function handleSubirFoto(id, archivo) {
    if (!archivo) return;
    setSubiendoFoto(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('foto', archivo);
      await axiosAuth.post(`/api/personal/${id}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await cargar();
      mostrarMensaje('Foto actualizada correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Usuarios del Sistema" />

      {panelAbierto && (
        <>
          <div onClick={() => !guardando && setPanelAbierto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: '460px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', flexShrink: 0 }}>
              <div style={{ fontWeight: '800', fontSize: '15px' }}>{editandoId ? 'Editar usuario' : 'Creación de usuario del sistema'}</div>
              <button onClick={() => setPanelAbierto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>✕</button>
            </div>

            <form onSubmit={guardar} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {error && <div style={es.errorBox}>{error}</div>}

              {editandoId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                  <Avatar nombre={`${form.nombres} ${form.apellidos}`} fotoUrl={lista.find(p => p.id === editandoId)?.foto_url} size={48} />
                  <label style={{ ...es.btnSec, cursor: subiendoFoto ? 'not-allowed' : 'pointer', opacity: subiendoFoto ? 0.6 : 1 }}>
                    {subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                      onChange={e => handleSubirFoto(editandoId, e.target.files[0])} disabled={subiendoFoto} />
                  </label>
                </div>
              )}

              <p style={es.seccionLabel}>Datos personales</p>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Tipo de documento</label>
                  <select style={es.input} value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}>
                    <option value="">—</option>
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula de Extranjería</option>
                  </select>
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Número de documento</label>
                  <input style={es.input} value={form.numero_documento} onChange={e => setForm({ ...form, numero_documento: e.target.value })} />
                </div>
              </div>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Nombres *</label>
                  <input style={es.input} value={form.nombres} onChange={e => setForm({ ...form, nombres: e.target.value })} required />
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Apellidos *</label>
                  <input style={es.input} value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} required />
                </div>
              </div>
              <div style={es.campo}>
                <label style={es.label}>Fecha de nacimiento</label>
                <input type="date" style={es.input} value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} />
              </div>

              <p style={es.seccionLabel}>Contacto</p>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Teléfono residencial</label>
                  <input style={es.input} value={form.telefono_residencial} onChange={e => setForm({ ...form, telefono_residencial: e.target.value })} />
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Dirección residencial</label>
                  <input style={es.input} value={form.direccion_residencial} onChange={e => setForm({ ...form, direccion_residencial: e.target.value })} />
                </div>
              </div>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Teléfono oficina</label>
                  <input style={es.input} value={form.telefono_oficina} onChange={e => setForm({ ...form, telefono_oficina: e.target.value })} />
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Dirección oficina</label>
                  <input style={es.input} value={form.direccion_oficina} onChange={e => setForm({ ...form, direccion_oficina: e.target.value })} />
                </div>
              </div>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Teléfono celular</label>
                  <input style={es.input} value={form.telefono_celular} onChange={e => setForm({ ...form, telefono_celular: e.target.value })} />
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Otro</label>
                  <input style={es.input} value={form.telefono_otro} onChange={e => setForm({ ...form, telefono_otro: e.target.value })} />
                </div>
              </div>
              <div style={es.campo}>
                <label style={es.label}>Email *</label>
                <input type="email" style={es.input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div style={es.campo}>
                <label style={es.label}>{editandoId ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
                <input type="password" style={es.input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editandoId} />
              </div>

              <p style={es.seccionLabel}>Fechas de ingreso</p>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Ingreso a caja de compensación</label>
                  <input type="date" style={es.input} value={form.fecha_ingreso_caja_compensacion} onChange={e => setForm({ ...form, fecha_ingreso_caja_compensacion: e.target.value })} />
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Ingreso a la institución</label>
                  <input type="date" style={es.input} value={form.fecha_ingreso_institucion} onChange={e => setForm({ ...form, fecha_ingreso_institucion: e.target.value })} />
                </div>
              </div>

              <p style={es.seccionLabel}>Ficha administrativa</p>
              <div style={es.fila2}>
                <div style={es.campo}>
                  <label style={es.label}>Rol del sistema *</label>
                  <select style={es.input} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                    <option value="admin">Administrador</option>
                    <option value="director">Director</option>
                  </select>
                  <p style={es.ayuda}>Determina qué módulos puede usar dentro de Playfesor.</p>
                </div>
                <div style={es.campo}>
                  <label style={es.label}>Cargo</label>
                  <select style={es.input} value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                    <option value="">—</option>
                    {CARGOS_DISPONIBLES.map(c => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
                  </select>
                  <p style={es.ayuda}>Solo es un título — no cambia lo que puede hacer.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setPanelAbierto(false)} style={{ ...es.btnSec, flex: 1, textAlign: 'center' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ ...es.btnPrimario, flex: 2, opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando...' : (editandoId ? 'Guardar cambios' : 'Agregar')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {modulosPersona && (
        <div style={es.modalFondo} onClick={() => !guardandoModulos && cerrarModulos()}>
          <div style={es.modalCaja} onClick={e => e.stopPropagation()}>
            <h3 style={es.modalTitulo}>Módulos de {modulosPersona.nombre}</h3>
            <p style={es.instruccion}>
              Desmarca lo que esta persona no debería poder usar, sin importar su rol o cargo. Lo que aparece
              apagado por el colegio no se puede reactivar aquí — se hace desde "Módulos del Portal".
            </p>
            {error && <div style={es.errorBox}>{error}</div>}
            {cargandoModulos ? (
              <p style={es.textoGris}>Cargando...</p>
            ) : (
              <div style={es.modulosLista}>
                {modulosCatalogo.map(m => (
                  <label key={m.clave} style={{ ...es.moduloItem, opacity: m.bloqueado_por_colegio ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={!modulosDesactivadosSel.has(m.clave) && !m.bloqueado_por_colegio}
                      disabled={m.bloqueado_por_colegio}
                      onChange={() => alternarModulo(m.clave)}
                      style={{ marginRight: '10px' }}
                    />
                    {m.nombre}
                    {m.bloqueado_por_colegio && <span style={es.moduloBloqueado}>Desactivado para todo el colegio</span>}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" onClick={cerrarModulos} style={{ ...es.btnSec, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button type="button" onClick={guardarModulos} disabled={guardandoModulos || cargandoModulos} style={{ ...es.btnPrimario, flex: 2, opacity: (guardandoModulos || cargandoModulos) ? 0.6 : 1 }}>
                {guardandoModulos ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={es.contenido}>
        <button onClick={() => navigate(RUTAS_POR_ROL[usuario.rol] || '/login')} style={es.btnVolver}>← Volver al panel</button>

        <div style={es.encabezado}>
          <h2 style={es.titulo}>Usuarios del Sistema</h2>
          <p style={es.subtitulo}>Personal directivo y administrativo del colegio (rector, coordinadores, secretaría, etc.).</p>
        </div>

        {mensaje && <div style={es.exito}>{mensaje}</div>}
        {error && !panelAbierto && <div style={es.errorBox}>{error}</div>}

        <div style={es.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ ...es.cardTitulo, marginBottom: 0 }}>Personal registrado ({lista.length})</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => exportarExcel(lista, [
                  { header: 'Nombre', campo: 'nombre' },
                  { header: 'Correo', campo: 'email' },
                  { header: 'Rol del sistema', valor: p => ROL_LABEL[p.rol] || p.rol },
                  { header: 'Cargo', valor: p => p.cargo ? nombreCargo(p.cargo) : '' },
                  { header: 'Estado', valor: p => p.activo ? 'Activo' : 'Inactivo' },
                ], 'personal_playfesor.xlsx', 'Personal')}
                disabled={lista.length === 0}
                style={es.btnExportar}
              >
                Exportar a Excel
              </button>
              <button onClick={abrirCrear} style={es.btnPrimario}>+ Crear usuario</button>
            </div>
          </div>

          {cargando ? (
            <p style={es.textoGris}>Cargando...</p>
          ) : lista.length === 0 ? (
            <p style={es.textoGris}>No hay personal administrativo registrado todavía.</p>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>{['Nombre', 'Correo', 'Rol', 'Cargo', 'Estado', 'Acción'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} style={es.tr}>
                    <td style={es.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar nombre={p.nombre} fotoUrl={p.foto_url} />
                        {p.nombre}
                      </div>
                    </td>
                    <td style={es.td}>{p.email}</td>
                    <td style={es.td}>{ROL_LABEL[p.rol] || p.rol}</td>
                    <td style={es.td}>{p.cargo ? nombreCargo(p.cargo) : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}</td>
                    <td style={es.td}>
                      <span style={{ ...es.badge, background: p.activo ? '#e8f5e9' : '#fce4ec', color: p.activo ? '#2e7d32' : '#c62828' }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={es.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => abrirEditar(p)} style={es.btnEditar}>Editar</button>
                        <button onClick={() => abrirModulos(p)} style={es.btnSecTabla}>Módulos</button>
                        {p.activo && p.id !== usuario.id && (
                          <button onClick={() => desactivar(p)} style={es.btnPeligro}>Desactivar</button>
                        )}
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
  contenido: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  encabezado: { marginBottom: '18px' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo: { fontSize: '16px', fontWeight: '700', color: '#333' },
  textoGris: { color: '#888', fontSize: '14px' },

  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px', fontSize: '14px', color: '#333' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },

  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnExportar: { background: '#f0f7f0', border: '1px solid #c5e1c5', color: '#2e7d32', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnEditar: { background: '#f0f0ff', border: '1px solid #c5cae9', color: '#5c6bc0', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  btnSecTabla: { background: '#f5f5f5', border: '1px solid #e0e0e0', color: '#666', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },

  modalFondo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' },
  modalCaja: { background: '#fff', borderRadius: '14px', padding: '26px', width: '100%', maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' },
  modalTitulo: { fontSize: '16px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 8px' },
  instruccion: { fontSize: '12.5px', color: '#888', lineHeight: 1.6, margin: '0 0 16px' },
  modulosLista: { display: 'flex', flexDirection: 'column', border: '1px solid #f0f0f0', borderRadius: '8px', overflow: 'hidden' },
  moduloItem: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', fontSize: '13.5px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' },
  moduloBloqueado: { fontSize: '11px', color: '#c62828', marginLeft: '8px', fontStyle: 'italic' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { background: '#f0f2f5', color: '#666', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', display: 'inline-block' },

  seccionLabel: { fontSize: '11.5px', fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '18px 0 8px' },
  fila2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#555' },
  input: { padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  ayuda: { fontSize: '11px', color: '#aaa', margin: '2px 0 0' },
};
