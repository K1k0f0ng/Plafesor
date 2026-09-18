import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconSchool } from '../components/Icons';
import { API } from '../config/api';
import { useAuth } from '../context/AuthContext';

// Lista de colegios a los que el admin tiene acceso, con la opción de crear
// uno adicional y pasar a administrarlo.
function MisColegios() {
  const { iniciarSesion } = useAuth();
  const [colegios, setColegios]     = useState([]);
  const [puedeCrear, setPuedeCrear] = useState(false);
  const [creando, setCreando]       = useState(false);
  const [form, setForm]             = useState({ nombre: '', ciudad: '' });
  const [ocupado, setOcupado]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    axiosAuth.get('/api/colegios/mis-colegios')
      .then(r => { setColegios(r.data.data || []); setPuedeCrear(!!r.data.puede_crear); })
      .catch(() => {});
  }, []);

  async function entrar(id) {
    setOcupado(true); setError('');
    try {
      const r = await axiosAuth.post(`/api/colegios/${id}/cambiar`);
      iniciarSesion(r.data.token, r.data.usuario);
      // Recarga completa para que ningún módulo conserve datos del colegio anterior
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar de colegio');
      setOcupado(false);
    }
  }

  async function handleCrear(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    setOcupado(true); setError('');
    try {
      const r = await axiosAuth.post('/api/colegios', form);
      await entrar(r.data.data.id);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el colegio');
      setOcupado(false);
    }
  }

  // Sin colegios adicionales ni permiso para crear: no hay nada que mostrar
  if (colegios.length <= 1 && !puedeCrear) return null;

  return (
    <div style={{ ...es.card, marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <h3 style={{ ...es.cardTitulo, fontSize: '17px', margin: 0 }}>Mis colegios</h3>
        {puedeCrear && !creando && (
          <button onClick={() => { setCreando(true); setError(''); }} style={es.btnEditar}>
            + Crear colegio adicional
          </button>
        )}
      </div>

      {error && <div style={es.errorBox}>{error}</div>}

      {creando && (
        <form onSubmit={handleCrear} style={{ ...es.form, marginBottom: '18px' }}>
          <div style={es.formFila}>
            <div style={es.formGrupo}>
              <label style={es.label}>Nombre del nuevo colegio *</label>
              <input style={es.input} value={form.nombre} maxLength={150} required
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre oficial del colegio" />
            </div>
            <div style={es.formGrupo}>
              <label style={es.label}>Ciudad</label>
              <input style={es.input} value={form.ciudad}
                onChange={e => setForm({ ...form, ciudad: e.target.value })}
                placeholder="Ciudad o municipio" />
            </div>
          </div>
          <p style={es.ayuda}>Al crearlo entrarás de inmediato como administrador del nuevo colegio. Podrás volver a este desde aquí mismo.</p>
          <div style={es.formBtns}>
            <button type="button" onClick={() => { setCreando(false); setError(''); }} style={es.btnCancelar}>Cancelar</button>
            <button type="submit" disabled={ocupado} style={es.btnPrimario}>
              {ocupado ? 'Creando...' : 'Crear y entrar'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {colegios.map(c => (
          <div key={c.id} style={es.filaColegio}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#333', fontSize: '14px' }}>{c.nombre}</div>
              {c.ciudad && <div style={{ fontSize: '12px', color: '#999' }}>{c.ciudad}</div>}
            </div>
            {c.actual ? (
              <span style={es.chipActual}>Administrando ahora</span>
            ) : (
              <button onClick={() => entrar(c.id)} disabled={ocupado} style={es.btnCancelar}>
                Entrar como admin
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Colegios() {
  const [colegio, setColegio]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [form, setForm]           = useState({ nombre: '', ciudad: '', lema: '', dias_rotacion_password: '' });
  const [editando, setEditando]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mensaje, setMensaje]     = useState('');
  const [error, setError]         = useState('');
  const inputLogoRef              = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    axiosAuth.get('/api/colegios')
      .then(r => {
        const datos = r.data.data?.[0] || null;
        setColegio(datos);
        if (datos) setForm({
          nombre: datos.nombre || '', ciudad: datos.ciudad || '', lema: datos.lema || '',
          dias_rotacion_password: datos.dias_rotacion_password || '',
        });
      })
      .catch(() => setError('No se pudo cargar la información de la institución'))
      .finally(() => setCargando(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    setGuardando(true); setError('');
    try {
      await axiosAuth.put(`/api/colegios/${colegio.id}`, form);
      setColegio(prev => ({ ...prev, ...form }));
      setMensaje('Institución actualizada correctamente');
      setEditando(false);
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setGuardando(false);
    }
  }

  async function handleSubirLogo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendoLogo(true); setError('');
    const formData = new FormData();
    formData.append('logo', archivo);
    try {
      const resp = await axiosAuth.post(`/api/colegios/${colegio.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setColegio(prev => ({ ...prev, logo_url: resp.data.data.logo_url }));
      setMensaje('Logo actualizado correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir el logo');
    } finally {
      setSubiendoLogo(false);
      if (inputLogoRef.current) inputLogoRef.current.value = '';
    }
  }

  const logoSrc = colegio?.logo_url ? `${API}${colegio.logo_url}` : null;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mi institución" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {/* Card principal */}
        <div style={es.card}>
          {/* Cabecera con logo */}
          <div style={es.cardCabecera}>
            <div style={es.logoZona}>
              {logoSrc ? (
                <img src={logoSrc} alt="Logo institución" style={es.logoImg} />
              ) : (
                <div style={es.logoPlaceholder}>
                  <IconSchool size={40} style={{ color: '#c5cae9' }} />
                </div>
              )}
              <div style={es.logoAcciones}>
                <input
                  ref={inputLogoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  id="inputLogo"
                  onChange={handleSubirLogo}
                />
                <label htmlFor="inputLogo" style={{ ...es.btnLogo, opacity: subiendoLogo ? 0.6 : 1, cursor: subiendoLogo ? 'not-allowed' : 'pointer' }}>
                  {subiendoLogo ? 'Subiendo...' : logoSrc ? 'Cambiar logo' : '+ Subir logo'}
                </label>
                <p style={es.logoAyuda}>JPG, PNG, SVG — máximo 2 MB</p>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={es.cardTitulo}>{cargando ? 'Cargando...' : (colegio?.nombre || '—')}</h3>
              {colegio?.ciudad && <p style={es.ciudad}>{colegio.ciudad}</p>}
              {colegio?.lema && <p style={es.lema}>{colegio.lema}</p>}
            </div>

            {!cargando && !editando && colegio && (
              <button onClick={() => setEditando(true)} style={es.btnEditar}>
                Editar datos
              </button>
            )}
          </div>

          {mensaje && <div style={es.exito}>{mensaje}</div>}
          {error   && <div style={es.errorBox}>{error}</div>}

          {editando && (
            <form onSubmit={handleGuardar} style={es.form}>
              <div style={es.formFila}>
                <div style={es.formGrupo}>
                  <label style={es.label}>Nombre de la institución *</label>
                  <input
                    style={es.input}
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre oficial del colegio"
                    required
                  />
                </div>
                <div style={es.formGrupo}>
                  <label style={es.label}>Ciudad</label>
                  <input
                    style={es.input}
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Ciudad o municipio"
                  />
                </div>
              </div>
              <div style={es.formGrupo}>
                <label style={es.label}>Lema o eslogan</label>
                <input
                  style={es.input}
                  value={form.lema}
                  onChange={e => setForm({ ...form, lema: e.target.value })}
                  placeholder="Ej: Formación integral para un mejor mañana"
                  maxLength={255}
                />
                <p style={es.ayuda}>Se muestra debajo del nombre del colegio en el panel del director.</p>
              </div>
              <div style={es.formGrupo}>
                <label style={es.label}>Rotación de contraseña</label>
                <select
                  style={es.input}
                  value={form.dias_rotacion_password}
                  onChange={e => setForm({ ...form, dias_rotacion_password: e.target.value })}
                >
                  <option value="">Desactivada</option>
                  <option value="60">Cada 60 días</option>
                  <option value="90">Cada 90 días</option>
                  <option value="180">Cada 180 días</option>
                  <option value="365">Cada 365 días</option>
                </select>
                <p style={es.ayuda}>Aplica solo al personal (director, administradores y docentes). Cuando se cumpla el plazo, deberán cambiar su contraseña al iniciar sesión.</p>
              </div>
              <div style={es.formBtns}>
                <button type="button" onClick={() => { setEditando(false); setError(''); }} style={es.btnCancelar}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} style={es.btnPrimario}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}
        </div>

        <MisColegios />
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '700px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardCabecera: { display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' },

  logoZona: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', minWidth: '120px' },
  logoImg: { width: '120px', height: '100px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #eee', background: '#fafafa', padding: '8px' },
  logoPlaceholder: { width: '120px', height: '100px', borderRadius: '10px', border: '2px dashed #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoAcciones: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  btnLogo: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff',
    border: 'none', borderRadius: '8px', padding: '7px 14px',
    fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'inline-block',
  },
  logoAyuda: { fontSize: '11px', color: '#aaa', margin: 0, textAlign: 'center' },

  cardTitulo: { fontSize: '20px', fontWeight: '800', color: '#333', margin: '0 0 4px' },
  ciudad: { fontSize: '14px', color: '#888', margin: 0 },
  lema: { fontSize: '13px', color: '#aaa', margin: '2px 0 0', fontStyle: 'italic' },
  btnEditar: {
    marginLeft: 'auto', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff',
    border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formFila: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  formGrupo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#555' },
  ayuda: { fontSize: '11.5px', color: '#aaa', margin: '2px 0 0' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  formBtns: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnCancelar: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  filaColegio: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', border: '1px solid #eee', borderRadius: '10px', flexWrap: 'wrap' },
  chipActual: { background: '#e8eaf6', color: '#3949ab', borderRadius: '999px', padding: '5px 12px', fontSize: '12px', fontWeight: 700 },
};
