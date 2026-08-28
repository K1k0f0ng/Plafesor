import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import {
  IconSchool, IconBookOpen, IconUsers, IconUser, IconFileText,
  IconCalendar, IconCheck, IconInbox,
} from '../components/Icons';

export default function Dashboard() {
  const [stats, setStats] = useState({ colegios: 0, grupos: 0, docentes: 0, estudiantes: 0, asignaciones: 0 });
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function cargarStats() {
      try {
        const [rGrupos, rDocentes, rEstudiantes, rAsignaciones] = await Promise.all([
          axiosAuth.get('/api/grupos'),
          axiosAuth.get('/api/docentes'),
          axiosAuth.get('/api/estudiantes'),
          axiosAuth.get('/api/materias/asignaciones'),
        ]);
        setStats({
          colegios: 1,
          grupos: rGrupos.data.data.length,
          docentes: rDocentes.data.data.filter(d => d.activo).length,
          estudiantes: rEstudiantes.data.data.filter(e => e.activo).length,
          asignaciones: rAsignaciones.data.data.length,
        });
      } catch {
        // Si hay error de conexión, solo muestra los cards de navegación
      } finally {
        setCargando(false);
      }
    }
    cargarStats();
  }, []);

  const pasos = [
    { label: 'Grupos creados',          hecho: stats.grupos > 0,       ruta: '/grupos',      Icono: IconBookOpen },
    { label: 'Docentes registrados',    hecho: stats.docentes > 0,     ruta: '/docentes',    Icono: IconUsers },
    { label: 'Estudiantes registrados', hecho: stats.estudiantes > 0,  ruta: '/estudiantes', Icono: IconUser },
    { label: 'Materias asignadas',      hecho: stats.asignaciones > 0, ruta: '/materias',    Icono: IconFileText },
  ];
  const todosHechos = pasos.every(p => p.hecho);
  const pasosHechos = pasos.filter(p => p.hecho).length;

  const secciones = [
    { titulo: 'Mi institución', Icono: IconSchool,   ruta: '/colegios',    desc: 'Ver y editar los datos de tu institución',    color: 'var(--color-primario)' },
    { titulo: 'Grupos',         Icono: IconBookOpen, ruta: '/grupos',      desc: 'Crear y administrar grupos por grado',        color: 'var(--color-secundario)' },
    { titulo: 'Docentes',       Icono: IconUsers,    ruta: '/docentes',    desc: 'Gestionar docentes y sus asignaciones',       color: '#f093fb' },
    { titulo: 'Estudiantes',    Icono: IconUser,     ruta: '/estudiantes', desc: 'Gestionar estudiantes e importar listas',     color: '#4facfe' },
    { titulo: 'Materias',       Icono: IconFileText, ruta: '/materias',    desc: 'Asignar materias a grupos y docentes',        color: '#43e97b' },
    { titulo: 'Padres',         Icono: IconUsers,    ruta: '/padres',      desc: 'Crear accesos para padres de familia',        color: '#fa709a' },
    { titulo: 'Períodos',       Icono: IconCalendar, ruta: '/periodos',    desc: 'Gestionar períodos académicos con fechas',    color: '#f5a623' },
  ];

  return (
    <div style={es.pagina}>
      <Navbar titulo="Panel Administrador" />
      <div style={es.contenido}>

        {/* Stats */}
        <div style={es.statsGrid}>
          {[
            { label: 'Grupos activos',      valor: cargando ? '...' : stats.grupos,      Icono: IconBookOpen, color: 'var(--color-primario)' },
            { label: 'Docentes activos',    valor: cargando ? '...' : stats.docentes,    Icono: IconUsers,    color: 'var(--color-secundario)' },
            { label: 'Estudiantes activos', valor: cargando ? '...' : stats.estudiantes, Icono: IconUser,     color: '#4facfe' },
          ].map(s => (
            <div key={s.label} style={es.statCard}>
              <s.Icono size={30} style={{ color: s.color }} />
              <span style={{ ...es.statValor, color: s.color }}>{s.valor}</span>
              <span style={es.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Checklist de primeros pasos */}
        {!cargando && !todosHechos && (
          <div style={es.checkCard}>
            <div style={es.checkEncabezado}>
              <div>
                <h3 style={es.checkTitulo}>Primeros pasos</h3>
                <p style={es.checkSubtitulo}>{pasosHechos} de {pasos.length} completados — completa la configuración inicial</p>
              </div>
              <div style={es.checkBarra}>
                <div style={{ ...es.checkBarraRelleno, width: `${(pasosHechos / pasos.length) * 100}%` }} />
              </div>
            </div>
            <div style={es.checkLista}>
              {pasos.map(paso => {
                const { Icono } = paso;
                return (
                  <button
                    key={paso.ruta}
                    onClick={() => navigate(paso.ruta)}
                    style={{ ...es.checkItem, ...(paso.hecho ? es.checkItemHecho : es.checkItemPendiente) }}
                  >
                    <span style={es.checkCirculo}>
                      {paso.hecho
                        ? <IconCheck size={18} style={{ color: '#43a047' }} />
                        : <Icono size={18} style={{ color: 'var(--color-primario)' }} />
                      }
                    </span>
                    <span style={{ ...es.checkLabel, ...(paso.hecho ? { textDecoration: 'line-through', color: '#aaa' } : {}) }}>
                      {paso.label}
                    </span>
                    {!paso.hecho && <span style={es.checkFlecha}>→</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navegación por secciones */}
        <h3 style={es.seccionTitulo}>Módulos de gestión</h3>
        <div style={es.navGrid}>
          {secciones.map(sec => {
            const { Icono } = sec;
            return (
              <button key={sec.ruta} onClick={() => navigate(sec.ruta)} style={{ ...es.navCard, borderTop: `4px solid ${sec.color}` }}>
                <Icono size={32} style={{ color: sec.color }} />
                <span style={es.navTitulo}>{sec.titulo}</span>
                <span style={es.navDesc}>{sec.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {!cargando && stats.grupos === 0 && stats.docentes === 0 && (
          <div style={es.sinDatos}>
            <IconInbox size={48} style={{ color: '#ccc' }} />
            <p>Comienza creando un colegio en el módulo de Colegios.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '36px' },
  statCard: {
    background: '#fff', borderRadius: '16px', padding: '24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  statValor: { fontSize: '36px', fontWeight: '800' },
  statLabel: { fontSize: '13px', color: '#888', textAlign: 'center' },
  seccionTitulo: { fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  navGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  navCard: {
    background: '#fff', borderRadius: '16px', padding: '28px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px',
    cursor: 'pointer', border: 'none', textAlign: 'left',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  navTitulo: { fontSize: '18px', fontWeight: '700', color: '#333' },
  navDesc: { fontSize: '13px', color: '#888' },
  checkCard: {
    background: '#fff', borderRadius: '16px', padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '28px',
    borderLeft: '4px solid var(--color-primario)',
  },
  checkEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' },
  checkTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', margin: 0 },
  checkSubtitulo: { fontSize: '13px', color: '#888', margin: '4px 0 0' },
  checkBarra: { height: '6px', width: '160px', background: '#f0f0f0', borderRadius: '4px', alignSelf: 'center' },
  checkBarraRelleno: { height: '100%', background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', borderRadius: '4px', transition: 'width 0.3s' },
  checkLista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', borderRadius: '10px', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  checkItemHecho: { background: '#f8f8f8' },
  checkItemPendiente: { background: '#f5f3ff' },
  checkCirculo: { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkLabel: { fontSize: '14px', fontWeight: '500', color: '#333', flex: 1 },
  checkFlecha: { fontSize: '14px', color: 'var(--color-primario)', fontWeight: '700' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
};
