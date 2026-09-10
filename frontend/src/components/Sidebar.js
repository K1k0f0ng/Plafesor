import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosAuth from '../config/axios';
import {
  IconHome, IconSchool, IconBookOpen, IconUsers, IconUser,
  IconBarChart, IconAlertCircle, IconZap, IconFileText,
  IconEdit, IconClipboard, IconCheckSquare, IconBot, IconLogOut,
  IconCalendar, IconAccessibility, IconStar, IconMegaphone, IconInbox,
  IconChevronRight,
} from './Icons';
import NotificacionBell from './NotificacionBell';

const MENU = {
  admin: [
    { tipo: 'link', Icono: IconHome,       label: 'Panel',        ruta: '/dashboard' },
    { tipo: 'seccion', label: 'Institución' },
    { tipo: 'link', Icono: IconSchool,     label: 'Colegios',     ruta: '/colegios' },
    { tipo: 'link', Icono: IconBookOpen,   label: 'Grupos',       ruta: '/grupos' },
    { tipo: 'link', Icono: IconUsers,      label: 'Docentes',     ruta: '/docentes' },
    { tipo: 'link', Icono: IconUser,       label: 'Estudiantes',  ruta: '/estudiantes' },
    { tipo: 'link', Icono: IconFileText,   label: 'Materias',     ruta: '/materias' },
    { tipo: 'link', Icono: IconUsers,      label: 'Padres',       ruta: '/padres' },
    { tipo: 'seccion', label: 'Comunicación' },
    { tipo: 'link', Icono: IconInbox,      label: 'Mensajería',      ruta: '/mensajeria', badge: 'mensajes' },
    { tipo: 'link', Icono: IconCalendar,   label: 'Citaciones',      ruta: '/citaciones' },
    { tipo: 'link', Icono: IconMegaphone,  label: 'Mensajes masivos',ruta: '/mensajes-masivos' },
  ],
  director: [
    { tipo: 'link', Icono: IconHome,       label: 'Panel',           ruta: '/dashboard-director' },
    { tipo: 'seccion', label: 'Inteligencia Institucional' },
    { tipo: 'link', Icono: IconBarChart,   label: 'Métricas',        ruta: '/metricas' },
    { tipo: 'link', Icono: IconAlertCircle,label: 'Motor de Riesgo', ruta: '/riesgo', badge: 'riesgo' },
    { tipo: 'link', Icono: IconZap,        label: 'Copiloto IA',     ruta: '/copiloto' },
    { tipo: 'link', Icono: IconFileText,   label: 'Observador',      ruta: '/observador' },
    { tipo: 'link', Icono: IconAccessibility, label: 'PIAR',         ruta: '/piar' },
    { tipo: 'seccion', label: 'Equipo Docente' },
    { tipo: 'link', Icono: IconStar,       label: 'Evaluación Docente', ruta: '/evaluacion-docentes' },
    { tipo: 'seccion', label: 'Comunicación' },
    { tipo: 'link', Icono: IconInbox,      label: 'Mensajería',      ruta: '/mensajeria', badge: 'mensajes' },
    { tipo: 'link', Icono: IconCalendar,   label: 'Citaciones',      ruta: '/citaciones' },
    { tipo: 'link', Icono: IconMegaphone,  label: 'Mensajes masivos',ruta: '/mensajes-masivos' },
    { tipo: 'seccion', label: 'Reportes' },
    { tipo: 'link', Icono: IconFileText,   label: 'Boletines',      ruta: '/boletin' },
    { tipo: 'link', Icono: IconBookOpen,   label: 'Libro de Notas', ruta: '/libro-notas' },
  ],
  docente: [
    { tipo: 'link', Icono: IconHome,       label: 'Mi Panel',        ruta: '/dashboard-docente' },
    { tipo: 'seccion', label: 'Actividades' },
    { tipo: 'link', Icono: IconEdit,       label: 'Crear Actividad', ruta: '/crear-actividad' },
    { tipo: 'link', Icono: IconClipboard,  label: 'Mis Actividades', ruta: '/mis-actividades' },
    { tipo: 'seccion', label: 'Asistencia' },
    { tipo: 'link', Icono: IconCheckSquare,label: 'Asistencia',      ruta: '/pasar-lista' },
    { tipo: 'seccion', label: 'Estudiantes' },
    { tipo: 'link', Icono: IconEdit,       label: 'Anotaciones',    ruta: '/anotaciones' },
    { tipo: 'seccion', label: 'Reportes' },
    { tipo: 'link', Icono: IconFileText,   label: 'Boletines',      ruta: '/boletin' },
    { tipo: 'link', Icono: IconBookOpen,   label: 'Libro de Notas', ruta: '/libro-notas' },
    { tipo: 'link', Icono: IconAccessibility, label: 'PIAR',         ruta: '/piar' },
    { tipo: 'seccion', label: 'Comunicación' },
    { tipo: 'link', Icono: IconInbox,      label: 'Mensajería',      ruta: '/mensajeria', badge: 'mensajes' },
    // Los dos siguientes solo se muestran si el docente dirige un grupo —
    // se filtran en tiempoReal más abajo con `soloDirectorGrupo: true`
    { tipo: 'link', Icono: IconCalendar,   label: 'Citaciones',       ruta: '/citaciones',       soloDirectorGrupo: true },
    { tipo: 'link', Icono: IconMegaphone,  label: 'Mensajes masivos', ruta: '/mensajes-masivos', soloDirectorGrupo: true },
  ],
  estudiante: [
    { tipo: 'link', Icono: IconBookOpen,   label: 'Mis Materias', ruta: '/dashboard-estudiante' },
    { tipo: 'link', Icono: IconBot,        label: 'Tutor IA',     ruta: '/tutor' },
  ],
  padre: [
    { tipo: 'link', Icono: IconUser,       label: 'Mi Hijo/a',  ruta: '/dashboard-padre' },
    { tipo: 'seccion', label: 'Comunicación' },
    { tipo: 'link', Icono: IconInbox,      label: 'Mensajería', ruta: '/mensajeria', badge: 'mensajes' },
  ],
};

const ROL_ETIQUETA = {
  admin:      'Administrador',
  director:   'Director',
  docente:    'Docente',
  estudiante: 'Estudiante',
  padre:      'Padre / Madre',
};

export default function Sidebar({ variante, colapsado = false }) {
  const { usuario, cerrarSesion } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const menuRol   = MENU[usuario?.rol] || [];
  const menu      = usuario?.grupo_dirigido_id ? menuRol : menuRol.filter(item => !item.soloDirectorGrupo);
  const inicial   = usuario?.nombre?.charAt(0)?.toUpperCase() || '?';
  const esDirector = variante === 'director';
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [estudiantesEnRiesgo, setEstudiantesEnRiesgo] = useState(0);

  const cargarNoLeidos = useCallback(async () => {
    try {
      const { data } = await axiosAuth.get('/api/mensajes/no-leidos');
      setMensajesNoLeidos(data.data?.total || 0);
    } catch { /* silencioso */ }
  }, []);

  // Contador que acompaña a "Motor de Riesgo": estudiantes distintos con alerta
  const cargarRiesgo = useCallback(async () => {
    if (usuario?.rol !== 'director' || !usuario?.colegio_id) return;
    try {
      const { data } = await axiosAuth.get(`/api/reportes/alertas/colegio/${usuario.colegio_id}`);
      setEstudiantesEnRiesgo(new Set((data.data || []).map(a => a.estudiante_id)).size);
    } catch { /* silencioso */ }
  }, [usuario?.rol, usuario?.colegio_id]);

  useEffect(() => {
    if (!['admin', 'director', 'docente', 'padre'].includes(usuario?.rol)) return;
    cargarNoLeidos();
    const id = setInterval(cargarNoLeidos, 60_000);
    return () => clearInterval(id);
  }, [usuario?.rol, cargarNoLeidos]);

  useEffect(() => {
    cargarRiesgo();
    const id = setInterval(cargarRiesgo, 60_000);
    return () => clearInterval(id);
  }, [cargarRiesgo]);

  function handleLogout() {
    cerrarSesion();
    navigate('/login');
  }

  return (
    <aside style={{
      ...es.sidebar,
      ...(esDirector ? es.sidebarDirector : {}),
      ...(esDirector && colapsado ? es.sidebarColapsado : {}),
    }}>

      {/* Logo: en la variante del Director vive en la barra superior */}
      {!esDirector && (
        <div style={es.logoArea}>
          <img src="/logo-icon.png" alt="Playfesor" style={es.logoIcono} />
          <span style={es.logoText}>Playfesor</span>
        </div>
      )}

      {/* Navegación */}
      <nav style={{ ...es.nav, ...(colapsado ? es.navColapsado : {}) }}>
        {menu.map((item, i) => {
          if (item.tipo === 'seccion') {
            if (colapsado) return null;
            return (
              <span key={i} style={{ ...es.seccionLabel, ...(esDirector ? es.seccionLabelDirector : {}) }}>
                {item.label}
              </span>
            );
          }
          const activo = location.pathname === item.ruta;
          const { Icono } = item;
          const contador = item.badge === 'riesgo' ? estudiantesEnRiesgo : mensajesNoLeidos;
          return (
            <button
              key={item.ruta}
              onClick={() => navigate(item.ruta)}
              title={colapsado ? item.label : undefined}
              style={{
                ...es.link,
                ...(esDirector ? es.linkDirector : {}),
                ...(activo ? es.linkActivo : {}),
                ...(esDirector && activo ? es.linkActivoDirector : {}),
                ...(colapsado ? es.linkColapsado : {}),
              }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.background = esDirector ? 'rgba(255,255,255,0.08)' : '#f5f5ff'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={es.linkIcono}>
                {Icono && <Icono size={17} />}
              </span>
              {!colapsado && <span style={es.linkLabel}>{item.label}</span>}
              {!colapsado && item.badge && contador > 0 && (
                <span style={es.badgeMensajes}>{contador > 9 ? '9+' : contador}</span>
              )}
              {activo && !colapsado && (esDirector
                ? <IconChevronRight size={15} style={{ color: '#fff' }} />
                : <span style={es.activoDot} />)}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div style={{
        ...es.userArea,
        ...(esDirector ? es.userAreaDirector : {}),
        ...(colapsado ? es.userAreaColapsado : {}),
      }}>
        <div style={{ ...es.userRow, ...(colapsado ? es.userRowColapsado : {}) }}>
          <div style={es.avatar}>{inicial}</div>
          {!colapsado && (
            <div style={es.userInfo}>
              <span style={{ ...es.userName, ...(esDirector ? es.userNameDirector : {}) }}>{usuario?.nombre}</span>
              <span style={{ ...es.userRole, ...(esDirector ? es.userRoleDirector : {}) }}>{ROL_ETIQUETA[usuario?.rol] || usuario?.rol}</span>
            </div>
          )}
          {!colapsado && <NotificacionBell oscuro={esDirector} />}
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{
            ...es.btnLogout,
            ...(esDirector ? es.btnLogoutDirector : {}),
            ...(colapsado ? es.btnLogoutColapsado : {}),
          }}
          onMouseEnter={e => {
            if (esDirector) {
              e.currentTarget.style.background = 'rgba(239,68,68,0.16)';
              e.currentTarget.style.color = '#fca5a5';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
            } else {
              e.currentTarget.style.background = '#fff0f0';
              e.currentTarget.style.color = '#c62828';
              e.currentTarget.style.borderColor = '#ffcdd2';
            }
          }}
          onMouseLeave={e => {
            if (esDirector) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
            } else {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#aaa';
              e.currentTarget.style.borderColor = '#eeeeee';
            }
          }}
        >
          <IconLogOut size={13} style={{ marginRight: colapsado ? 0 : 6, verticalAlign: 'middle' }} />
          {!colapsado && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  );
}

const es = {
  sidebar: {
    width: '240px',
    height: '100vh',
    background: '#ffffff',
    borderRight: '1px solid #eeeff3',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    flexShrink: 0,
    boxShadow: '2px 0 8px rgba(0,0,0,0.03)',
  },
  sidebarDirector: {
    width: '248px',
    height: 'auto',
    maxHeight: 'calc(100vh - 96px)',
    alignSelf: 'flex-start',
    top: '84px',
    background: 'linear-gradient(180deg, #4f3f9c 0%, #3c2f7d 100%)',
    border: 'none',
    borderRadius: '16px',
    boxShadow: '0 12px 32px rgba(30,20,70,0.28)',
  },
  sidebarColapsado: { width: '78px' },
  navColapsado: { padding: '10px' },
  linkColapsado: { justifyContent: 'center', padding: '10px 0' },
  userAreaColapsado: { padding: '12px 10px 16px' },
  userRowColapsado: { justifyContent: 'center', padding: '4px 0 10px' },
  btnLogoutColapsado: { padding: '9px 0' },
  linkDirector: {
    color: 'rgba(255,255,255,0.82)',
  },
  linkActivoDirector: {
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
  },
  seccionLabelDirector: {
    color: 'rgba(255,255,255,0.45)',
  },
  userAreaDirector: {
    borderTop: '1px solid rgba(255,255,255,0.12)',
  },
  userNameDirector: { color: '#fff' },
  userRoleDirector: { color: 'rgba(255,255,255,0.55)' },
  btnLogoutDirector: {
    border: '1px solid rgba(255,255,255,0.25)',
    color: 'rgba(255,255,255,0.75)',
  },
  logoArea: {
    padding: '20px 16px 18px',
    borderBottom: '1px solid #f3f3f7',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcono: {
    width: '32px', height: '32px', objectFit: 'contain',
    flexShrink: 0,
  },
  logoText: {
    fontSize: '17px', fontWeight: '800', color: '#1a1a2e', letterSpacing: '-0.4px',
  },
  nav: {
    flex: 1, overflowY: 'auto', padding: '10px 8px',
  },
  seccionLabel: {
    display: 'block', fontSize: '10px', fontWeight: '700', color: '#c0c0cc',
    textTransform: 'uppercase', letterSpacing: '1px',
    padding: '14px 10px 5px',
  },
  link: {
    display: 'flex', alignItems: 'center', gap: '9px',
    padding: '8px 10px', borderRadius: '8px',
    fontSize: '13.5px', fontWeight: '500', color: '#555',
    cursor: 'pointer', border: 'none', background: 'transparent',
    width: '100%', textAlign: 'left', fontFamily: 'inherit',
    marginBottom: '2px', position: 'relative',
    transition: 'background 0.12s',
  },
  linkActivo: {
    background: 'rgba(102, 126, 234, 0.10)',
    color: '#5a4fcf',
    fontWeight: '700',
  },
  linkIcono: {
    width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  linkLabel: {
    flex: 1,
  },
  activoDot: {
    width: '5px', height: '5px', borderRadius: '50%',
    background: '#667eea', flexShrink: 0,
  },
  badgeMensajes: {
    background: '#e53935', color: '#fff', fontSize: '10px', fontWeight: '800',
    borderRadius: '10px', padding: '1px 6px', lineHeight: '1.5', flexShrink: 0,
  },
  userArea: {
    padding: '12px 12px 16px',
    borderTop: '1px solid #f3f3f7',
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '4px 4px 10px',
  },
  avatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: '14px', fontWeight: '800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: {
    display: 'block', fontSize: '13px', fontWeight: '700', color: '#333',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userRole: {
    display: 'block', fontSize: '11px', color: '#aaa', marginTop: '1px',
  },
  btnLogout: {
    width: '100%', background: 'transparent', border: '1px solid #eeeeee',
    borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
    color: '#aaa', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
