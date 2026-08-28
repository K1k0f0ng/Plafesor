import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IconHome, IconSchool, IconBookOpen, IconUsers, IconUser,
  IconBarChart, IconAlertCircle, IconZap, IconFileText,
  IconEdit, IconClipboard, IconCheckSquare, IconBot, IconLogOut,
  IconCalendar, IconAccessibility, IconStar, IconMegaphone,
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
    { tipo: 'link', Icono: IconCalendar,   label: 'Citaciones',      ruta: '/citaciones' },
    { tipo: 'link', Icono: IconMegaphone,  label: 'Mensajes masivos',ruta: '/mensajes-masivos' },
  ],
  director: [
    { tipo: 'link', Icono: IconHome,       label: 'Panel',           ruta: '/dashboard-director' },
    { tipo: 'seccion', label: 'Inteligencia Institucional' },
    { tipo: 'link', Icono: IconBarChart,   label: 'Métricas',        ruta: '/metricas' },
    { tipo: 'link', Icono: IconAlertCircle,label: 'Motor de Riesgo', ruta: '/riesgo' },
    { tipo: 'link', Icono: IconZap,        label: 'Copiloto IA',     ruta: '/copiloto' },
    { tipo: 'link', Icono: IconFileText,   label: 'Observador',      ruta: '/observador' },
    { tipo: 'link', Icono: IconAccessibility, label: 'PIAR',         ruta: '/piar' },
    { tipo: 'seccion', label: 'Equipo Docente' },
    { tipo: 'link', Icono: IconStar,       label: 'Evaluación Docente', ruta: '/evaluacion-docentes' },
    { tipo: 'seccion', label: 'Comunicación' },
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
    // Los dos siguientes solo se muestran si el docente dirige un grupo —
    // se filtran en tiempoReal más abajo con `soloDirectorGrupo: true`
    { tipo: 'seccion', label: 'Comunicación', soloDirectorGrupo: true },
    { tipo: 'link', Icono: IconCalendar,   label: 'Citaciones',       ruta: '/citaciones',       soloDirectorGrupo: true },
    { tipo: 'link', Icono: IconMegaphone,  label: 'Mensajes masivos', ruta: '/mensajes-masivos', soloDirectorGrupo: true },
  ],
  estudiante: [
    { tipo: 'link', Icono: IconBookOpen,   label: 'Mis Materias', ruta: '/dashboard-estudiante' },
    { tipo: 'link', Icono: IconBot,        label: 'Tutor IA',     ruta: '/tutor' },
  ],
  padre: [
    { tipo: 'link', Icono: IconUser,       label: 'Mi Hijo/a', ruta: '/dashboard-padre' },
  ],
};

const ROL_ETIQUETA = {
  admin:      'Administrador',
  director:   'Director',
  docente:    'Docente',
  estudiante: 'Estudiante',
  padre:      'Padre / Madre',
};

export default function Sidebar() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const menuRol   = MENU[usuario?.rol] || [];
  const menu      = usuario?.grupo_dirigido_id ? menuRol : menuRol.filter(item => !item.soloDirectorGrupo);
  const inicial   = usuario?.nombre?.charAt(0)?.toUpperCase() || '?';

  function handleLogout() {
    cerrarSesion();
    navigate('/login');
  }

  return (
    <aside style={es.sidebar}>

      {/* Logo */}
      <div style={es.logoArea}>
        <img src="/logo-icon.png" alt="Playfesor" style={es.logoIcono} />
        <span style={es.logoText}>Playfesor</span>
      </div>

      {/* Navegación */}
      <nav style={es.nav}>
        {menu.map((item, i) => {
          if (item.tipo === 'seccion') {
            return <span key={i} style={es.seccionLabel}>{item.label}</span>;
          }
          const activo = location.pathname === item.ruta;
          const { Icono } = item;
          return (
            <button
              key={item.ruta}
              onClick={() => navigate(item.ruta)}
              style={{ ...es.link, ...(activo ? es.linkActivo : {}) }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.background = '#f5f5ff'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={es.linkIcono}>
                {Icono && <Icono size={17} />}
              </span>
              <span style={es.linkLabel}>{item.label}</span>
              {activo && <span style={es.activoDot} />}
            </button>
          );
        })}
      </nav>

      {/* Usuario */}
      <div style={es.userArea}>
        <div style={es.userRow}>
          <div style={es.avatar}>{inicial}</div>
          <div style={es.userInfo}>
            <span style={es.userName}>{usuario?.nombre}</span>
            <span style={es.userRole}>{ROL_ETIQUETA[usuario?.rol] || usuario?.rol}</span>
          </div>
          <NotificacionBell />
        </div>
        <button
          onClick={handleLogout}
          style={es.btnLogout}
          onMouseEnter={e => { e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.color = '#c62828'; e.currentTarget.style.borderColor = '#ffcdd2'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#eeeeee'; }}
        >
          <IconLogOut size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Cerrar sesión
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
