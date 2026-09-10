import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconSchool } from '../components/Icons';
import { API } from '../config/api';

export default function Colegios() {
  const [colegio, setColegio]     = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [form, setForm]           = useState({ nombre: '', ciudad: '', lema: '' });
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
        if (datos) setForm({ nombre: datos.nombre || '', ciudad: datos.ciudad || '', lema: datos.lema || '' });
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
};
