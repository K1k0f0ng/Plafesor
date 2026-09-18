import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { exportarExcel } from '../utils/exportarExcel';

export default function Padres() {
  const navigate = useNavigate();
  const [padres,      setPadres]      = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando,    setCargando]    = useState(true);
  const [guardando,   setGuardando]   = useState(false);
  const [mensaje,     setMensaje]     = useState('');
  const [error,       setError]       = useState('');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', estudiante_id: '' });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [rPadres, rEst] = await Promise.all([
        axiosAuth.get('/api/padre/listar'),
        axiosAuth.get('/api/estudiantes'),
      ]);
      setPadres(rPadres.data.data);
      setEstudiantes(rEst.data.data.filter(e => e.activo));
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await axiosAuth.post('/api/padre', form);
      setForm({ nombre: '', email: '', password: '', estudiante_id: '' });
      setMensaje('Cuenta de padre creada correctamente');
      await cargar();
      setTimeout(() => setMensaje(''), 3500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cuenta');
    } finally {
      setGuardando(false);
    }
  }

  async function handleDesactivar(id) {
    if (!window.confirm('¿Desactivar este padre?')) return;
    try {
      await axiosAuth.delete(`/api/padre/${id}`);
      await cargar();
    } catch {
      setError('Error al desactivar');
    }
  }

  async function handleReactivar(id) {
    if (!window.confirm('¿Reactivar este padre? Podrá volver a iniciar sesión.')) return;
    setError('');
    try {
      await axiosAuth.put(`/api/padre/${id}/reactivar`);
      await cargar();
      setMensaje('Padre reactivado correctamente');
      setTimeout(() => setMensaje(''), 3500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al reactivar');
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Padres de Familia" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Formulario */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Crear cuenta de padre / madre</h3>
          <p style={es.ayuda}>
            Crea el acceso para el padre o madre de familia. Al ingresar podrá ver las notas, asistencia y alertas de su hijo/a en tiempo real.
          </p>
          <form onSubmit={handleCrear} style={es.form}>
            <input
              type="text" placeholder="Nombre completo *" required
              value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              style={es.input}
            />
            <input
              type="email" placeholder="Correo electrónico *" required
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              style={es.input}
            />
            <input
              type="password" placeholder="Contraseña *" required
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              style={es.input}
            />
            <select
              value={form.estudiante_id}
              onChange={e => setForm({ ...form, estudiante_id: e.target.value })}
              style={es.select}
            >
              <option value="">— Selecciona el hijo/a (opcional) —</option>
              {estudiantes.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre} {e.nombre_grupo ? `(${e.grado}° ${e.nombre_grupo})` : ''}
                </option>
              ))}
            </select>
            <button type="submit" disabled={guardando} style={es.btnPrimario}>
              {guardando ? 'Creando...' : '+ Crear cuenta'}
            </button>
          </form>
          {mensaje && <div style={es.exito}>{mensaje}</div>}
          {error   && <div style={es.errorBox}>{error}</div>}
        </div>

        {/* Lista */}
        <div style={es.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ ...es.cardTitulo, marginBottom: 0 }}>Cuentas de padres ({padres.length})</h3>
            <button
              onClick={() => exportarExcel(padres, [
                { header: 'Nombre', campo: 'nombre' },
                { header: 'Correo', campo: 'email' },
                { header: 'Hijo/a vinculado', campo: 'hijos' },
                { header: 'Estado', valor: p => p.activo ? 'Activo' : 'Inactivo' },
              ], 'padres_playfesor.xlsx', 'Padres')}
              disabled={padres.length === 0}
              style={es.btnExportar}
            >
              Exportar a Excel
            </button>
          </div>
          <div style={{ marginBottom: '8px' }} />
          {cargando ? (
            <p style={es.textoGris}>Cargando...</p>
          ) : padres.length === 0 ? (
            <p style={es.textoGris}>No hay cuentas de padres creadas aún.</p>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>{['Nombre', 'Correo', 'Hijo/a vinculado', 'Estado', 'Acción'].map(h =>
                  <th key={h} style={es.th}>{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {padres.map(p => (
                  <tr key={p.id} style={es.tr}>
                    <td style={{ ...es.td, fontWeight: '700' }}>{p.nombre}</td>
                    <td style={es.td}>{p.email}</td>
                    <td style={es.td}>
                      {p.hijos
                        ? <span style={es.badgeHijo}>{p.hijos}</span>
                        : <span style={{ color: '#ccc', fontSize: '12px' }}>Sin vincular</span>}
                    </td>
                    <td style={es.td}>
                      <span style={{ ...es.badge, background: p.activo ? '#e8f5e9' : '#fce4ec', color: p.activo ? '#2e7d32' : '#c62828' }}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={es.td}>
                      {p.activo
                        ? <button onClick={() => handleDesactivar(p.id)} style={es.btnPeligro}>Desactivar</button>
                        : <button onClick={() => handleReactivar(p.id)} style={es.btnReactivar}>Reactivar</button>}
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
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card:      { background: '#fff', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardTitulo:{ fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '8px' },
  ayuda:     { fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: '1.5' },
  form:      { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  input:     { flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  select:    { flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '2px solid #e8e8e8', fontSize: '14px', fontFamily: 'inherit', background: '#fff' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnExportar: { background: '#f0f7f0', border: '1px solid #c5e1c5', color: '#2e7d32', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  exito:     { marginTop: '14px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '12px 16px', fontSize: '14px' },
  errorBox:  { marginTop: '12px', background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabla:     { width: '100%', borderCollapse: 'collapse' },
  th:        { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr:        { borderBottom: '1px solid #f5f5f5' },
  td:        { padding: '12px', fontSize: '14px', color: '#333' },
  badge:     { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  badgeHijo: { background: '#e3f2fd', color: '#1565c0', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  btnPeligro:{ background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  btnReactivar:{ background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#2e7d32', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
};
