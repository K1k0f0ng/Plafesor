import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificacionBell from './NotificacionBell';
import { Avatar } from './FichaEstudiante';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconMenu, IconShield, IconChevronDown, IconLogOut, IconEdit } from './Icons';

const ROL_ETIQUETA = {
  admin:      'Administrador',
  director:   'Director del Colegio',
  docente:    'Docente',
  estudiante: 'Estudiante',
  padre:      'Acudiente',
};

/**
 * Marco del panel de Director: barra superior a todo el ancho, menú lateral
 * flotante y área de contenido. El resto de roles sigue usando `Layout`.
 */
export default function LayoutDirector({ colegio, children }) {
  const { usuario, cerrarSesion, actualizarUsuario } = useAuth();
  const navigate = useNavigate();
  const [colapsado, setColapsado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState('');
  const menuRef = useRef(null);
  const inputFotoRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleLogout() {
    cerrarSesion();
    navigate('/login');
  }

  async function handleSubirFoto(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    setErrorFoto('');
    const formData = new FormData();
    formData.append('foto', archivo);
    try {
      const resp = await axiosAuth.post('/api/auth/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      actualizarUsuario({ foto_url: resp.data.data.foto_url });
    } catch (err) {
      setErrorFoto(err.response?.data?.error || 'No se pudo actualizar la foto');
    } finally {
      setSubiendoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
    }
  }

  return (
    <div style={es.raiz}>

      <header style={es.barra}>
        <div style={es.barraIzq}>
          <img src="/logo-icon.png" alt="Playfesor" style={es.logoIcono} />
          <span style={es.logoTexto}>Playfesor</span>

          <button
            onClick={() => setColapsado(v => !v)}
            style={es.btnMenu}
            title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
            aria-label={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          >
            <IconMenu size={19} />
          </button>

          <div style={es.colegioBloque}>
            <span style={es.colegioEscudo}>
              {colegio?.logo_url
                ? <img src={`${process.env.REACT_APP_API_URL}${colegio.logo_url}`} alt="" style={es.colegioLogoImg} />
                : <IconShield size={22} />}
            </span>
            <span style={es.colegioDatos}>
              <span style={es.colegioNombre}>{colegio?.nombre || 'Mi institución'}</span>
              <span style={es.colegioSub}>{colegio?.lema || colegio?.ciudad || 'Panel de dirección académica'}</span>
            </span>
          </div>
        </div>

        <div style={es.barraDer} ref={menuRef}>
          <NotificacionBell haciaAbajo />

          <button onClick={() => setMenuAbierto(v => !v)} style={es.usuarioBtn}>
            <Avatar nombre={usuario?.nombre} fotoUrl={usuario?.foto_url} size={38} />
            <span style={es.usuarioDatos}>
              <span style={es.usuarioNombre}>{usuario?.nombre}</span>
              <span style={es.usuarioRol}>{ROL_ETIQUETA[usuario?.rol] || usuario?.rol}</span>
            </span>
            <IconChevronDown size={16} style={{ color: '#9aa3b2' }} />
          </button>

          {menuAbierto && (
            <div style={es.menuUsuario}>
              <div style={es.menuCabecera}>
                <div style={es.menuAvatarZona}>
                  <Avatar nombre={usuario?.nombre} fotoUrl={usuario?.foto_url} size={44} />
                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    id="inputFotoPerfil"
                    onChange={handleSubirFoto}
                  />
                  <label
                    htmlFor="inputFotoPerfil"
                    title="Cambiar foto de perfil"
                    style={{ ...es.btnCambiarFoto, opacity: subiendoFoto ? 0.6 : 1, cursor: subiendoFoto ? 'not-allowed' : 'pointer' }}
                  >
                    <IconEdit size={11} style={{ color: '#fff' }} />
                  </label>
                </div>
                <span style={es.menuNombre}>{usuario?.nombre}</span>
                <span style={es.menuEmail}>{usuario?.email}</span>
                {errorFoto && <span style={es.menuErrorFoto}>{errorFoto}</span>}
              </div>
              <button
                onClick={handleLogout}
                style={es.menuItem}
                onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.color = '#c62828'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5b6478'; }}
              >
                <IconLogOut size={14} style={{ marginRight: 8 }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={es.cuerpo}>
        <Sidebar variante="director" colapsado={colapsado} />
        <main style={es.principal}>{children}</main>
      </div>
    </div>
  );
}

const es = {
  raiz: {
    minHeight: '100vh',
    background: '#eef1f8',
    display: 'flex',
    flexDirection: 'column',
  },
  barra: {
    position: 'sticky',
    top: 0,
    zIndex: 60,
    height: '64px',
    flexShrink: 0,
    background: '#ffffff',
    borderBottom: '1px solid #e8ebf3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
    padding: '0 22px',
  },
  barraIzq: { display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 },
  logoIcono: { width: '30px', height: '30px', objectFit: 'contain', flexShrink: 0 },
  logoTexto: { fontSize: '19px', fontWeight: '800', color: '#16224a', letterSpacing: '-0.4px' },
  btnMenu: {
    background: 'transparent', border: 'none', color: '#8b93a7', cursor: 'pointer',
    padding: '6px', marginLeft: '4px', borderRadius: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  },
  colegioBloque: {
    display: 'flex', alignItems: 'center', gap: '10px',
    paddingLeft: '14px', marginLeft: '4px', borderLeft: '1px solid #eceff5', minWidth: 0,
  },
  colegioEscudo: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#16224a', flexShrink: 0,
    width: '30px', height: '30px', borderRadius: '9px',
    background: '#eef1fb', overflow: 'hidden',
  },
  colegioLogoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  colegioDatos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  colegioNombre: {
    fontSize: '14.5px', fontWeight: '700', color: '#1a1a2e', lineHeight: '1.25',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  colegioSub: { fontSize: '11px', color: '#9aa3b2', lineHeight: '1.3' },

  barraDer: { display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' },
  usuarioBtn: {
    display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent',
    border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '12px',
    fontFamily: 'inherit', textAlign: 'left',
  },
  usuarioDatos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  usuarioNombre: {
    fontSize: '13px', fontWeight: '700', color: '#1a1a2e', lineHeight: '1.25',
    whiteSpace: 'nowrap', maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  usuarioRol: { fontSize: '11px', color: '#9aa3b2' },

  menuUsuario: {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '238px',
    background: '#fff', border: '1px solid #e8ebf3', borderRadius: '12px',
    boxShadow: '0 14px 34px rgba(20,30,70,0.14)', overflow: 'hidden', zIndex: 200,
  },
  menuCabecera: { padding: '16px 14px 14px', borderBottom: '1px solid #f3f5f9', textAlign: 'center' },
  menuAvatarZona: { position: 'relative', width: '44px', margin: '0 auto 10px' },
  btnCambiarFoto: {
    position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px',
    borderRadius: '50%', background: '#667eea', border: '2px solid #fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  menuNombre: { display: 'block', fontSize: '13px', fontWeight: '700', color: '#1a1a2e' },
  menuEmail: {
    display: 'block', fontSize: '11.5px', color: '#9aa3b2', marginTop: '2px',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  menuErrorFoto: { display: 'block', fontSize: '11px', color: '#c62828', marginTop: '6px' },
  menuItem: {
    width: '100%', background: 'transparent', border: 'none', textAlign: 'left',
    padding: '11px 14px', fontSize: '13px', color: '#5b6478', cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'all 0.15s',
  },

  cuerpo: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '18px',
    padding: '18px 22px 28px',
    minWidth: 0,
  },
  principal: { flex: 1, minWidth: 0, maxWidth: '1600px' },
};