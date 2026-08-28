import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconInbox } from '../components/Icons';

const ETIQUETA_TIPO = {
  opcion_multiple:    'Opción múltiple',
  verdadero_falso:    'Verdadero / Falso',
  ordenar_pasos:      'Ordenar pasos',
  completar_espacios: 'Completar espacios',
  relacionar_columnas:'Relacionar columnas',
};

export default function VerActividades() {
  const [actividades, setActividades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [panelPendientes, setPanelPendientes] = useState({});
  const navigate = useNavigate();

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const resp = await axiosAuth.get('/api/actividades/docente');
      setActividades(resp.data.data);
    } catch {
      setError('Error al cargar las actividades');
    } finally {
      setCargando(false);
    }
  }

  async function toggleActiva(act) {
    try {
      await axiosAuth.put(`/api/actividades/${act.id}`, { activa: !act.activa });
      await cargar();
    } catch {
      setError('Error al actualizar la actividad');
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Desactivar esta actividad? Los estudiantes dejarán de verla.')) return;
    try {
      await axiosAuth.delete(`/api/actividades/${id}`);
      await cargar();
    } catch {
      setError('Error al eliminar la actividad');
    }
  }

  async function togglePendientes(actId) {
    const estado = panelPendientes[actId];
    if (estado?.abierto) {
      setPanelPendientes(p => ({ ...p, [actId]: { ...p[actId], abierto: false } }));
      return;
    }
    if (estado?.estudiantes) {
      setPanelPendientes(p => ({ ...p, [actId]: { ...p[actId], abierto: true } }));
      return;
    }
    setPanelPendientes(p => ({ ...p, [actId]: { abierto: true, cargando: true, estudiantes: [] } }));
    try {
      const resp = await axiosAuth.get(`/api/actividades/${actId}/pendientes`);
      setPanelPendientes(p => ({ ...p, [actId]: { abierto: true, cargando: false, estudiantes: resp.data.data } }));
    } catch {
      setPanelPendientes(p => ({ ...p, [actId]: { abierto: true, cargando: false, estudiantes: [] } }));
    }
  }

  const filtradas = filtroPeriodo
    ? actividades.filter(a => a.periodo === filtroPeriodo)
    : actividades;

  function nivelNota(nota) {
    if (!nota) return { texto: '—', color: '#888' };
    if (nota < 3) return { texto: nota, color: '#c62828' };
    if (nota < 4) return { texto: nota, color: '#f57f17' };
    if (nota <= 4.5) return { texto: nota, color: '#2e7d32' };
    return { texto: nota, color: '#1565c0' };
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mis actividades" />
      <div style={es.contenido}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <button onClick={() => navigate('/dashboard-docente')} style={es.btnVolver}>← Volver al panel</button>
          <button onClick={() => navigate('/crear-actividad')} style={es.btnPrimario}>+ Crear nueva actividad</button>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}

        {/* Filtros */}
        <div style={es.filtros}>
          {['', '1', '2', '3'].map(p => (
            <button key={p} onClick={() => setFiltroPeriodo(p)}
              style={{ ...es.filtroBtn, ...(filtroPeriodo === p ? es.filtroBtnActivo : {}) }}>
              {p === '' ? 'Todos' : `Periodo ${p}`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {cargando ? (
          <p style={es.textoGris}>Cargando...</p>
        ) : filtradas.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={48} style={{ color: '#ccc' }} />
            <p>No hay actividades aún. <button onClick={() => navigate('/crear-actividad')} style={es.linkBtn}>Crear la primera</button></p>
          </div>
        ) : (
          filtradas.map(act => (
            <div key={act.id} style={{ ...es.actCard, opacity: act.activa ? 1 : 0.6 }}>
              <div style={es.actHeader}>
                <div style={es.actInfo}>
                  <div style={es.actTitulo}>{act.titulo}</div>
                  <div style={es.actMeta}>
                    <span style={es.badge}>{ETIQUETA_TIPO[act.tipo]}</span>
                    <span style={es.badge}>Periodo {act.periodo}</span>
                    <span style={es.badge}>{act.grado}° {act.nombre_grupo}</span>
                    <span style={es.badge}>{act.nombre_materia}</span>
                    {!act.activa && <span style={{ ...es.badge, background: '#fce4ec', color: '#c62828' }}>Inactiva</span>}
                  </div>
                </div>
                <div style={es.actAcciones}>
                  <button onClick={() => navigate(`/editar-actividad/${act.id}`)} style={es.btnSecundario}>
                    Editar
                  </button>
                  <button onClick={() => toggleActiva(act)} style={es.btnSecundario}>
                    {act.activa ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => eliminar(act.id)} style={es.btnPeligro}>Eliminar</button>
                </div>
              </div>

              {/* Estadísticas */}
              <div style={es.statsRow}>
                <div style={es.stat}>
                  <span style={es.statVal}>{act.total_completadas || 0}</span>
                  <span style={es.statLabel}>Completadas</span>
                </div>
                <div style={es.stat}>
                  <span style={{ ...es.statVal, color: act.total_pendientes > 0 ? '#f57f17' : '#2e7d32' }}>
                    {act.total_pendientes || 0}
                  </span>
                  <span style={es.statLabel}>Pendientes</span>
                </div>
                <div style={es.stat}>
                  <span style={{ ...es.statVal, color: nivelNota(act.nota_promedio).color }}>
                    {act.nota_promedio ? parseFloat(act.nota_promedio).toFixed(1) : '—'}
                  </span>
                  <span style={es.statLabel}>Nota promedio</span>
                </div>
                <div style={es.stat}>
                  <span style={es.statVal}>{act.tiempo_limite_minutos} min</span>
                  <span style={es.statLabel}>Tiempo límite</span>
                </div>
                <div style={es.stat}>
                  <span style={es.statVal}>{act.intentos_permitidos}</span>
                  <span style={es.statLabel}>Intentos máx.</span>
                </div>
              </div>

              {/* Panel de pendientes expandible */}
              {act.total_pendientes > 0 && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '4px' }}>
                  <button onClick={() => togglePendientes(act.id)} style={es.btnPendientes}>
                    {panelPendientes[act.id]?.abierto ? '▲ Ocultar pendientes' : `▼ Ver quién falta (${act.total_pendientes})`}
                  </button>
                  {panelPendientes[act.id]?.abierto && (
                    <div style={es.panelPendientes}>
                      {panelPendientes[act.id]?.cargando ? (
                        <span style={es.textoGris}>Cargando...</span>
                      ) : panelPendientes[act.id]?.estudiantes?.length === 0 ? (
                        <span style={es.textoGris}>Ya no hay pendientes.</span>
                      ) : (
                        panelPendientes[act.id].estudiantes.map(est => (
                          <span key={est.id} style={es.chipEstudiante}>{est.nombre}</span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  btnPrimario: { background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  btnPeligro: { background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' },
  filtros: { display: 'flex', gap: '8px', marginBottom: '20px' },
  filtroBtn: { padding: '8px 16px', borderRadius: '8px', border: '2px solid #e0e0e0', background: '#fff', color: '#888', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit' },
  filtroBtnActivo: { borderColor: 'var(--color-primario)', color: 'var(--color-primario)', background: '#f0f0ff' },
  actCard: { background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  actHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
  actInfo: { flex: 1 },
  actTitulo: { fontSize: '16px', fontWeight: '700', color: '#333', marginBottom: '8px' },
  actMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  actAcciones: { display: 'flex', gap: '8px', flexShrink: 0 },
  badge: { background: '#f0f0ff', color: 'var(--color-primario)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  statVal: { fontSize: '22px', fontWeight: '800', color: '#333' },
  statLabel: { fontSize: '11px', color: '#888' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  textoGris: { color: '#888', fontSize: '14px' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: 'inherit', fontWeight: '600', fontFamily: 'inherit', padding: 0 },
  btnPendientes: {
    background: 'none', border: 'none', color: '#f57f17', cursor: 'pointer',
    fontSize: '13px', fontWeight: '600', padding: '4px 0', fontFamily: 'inherit',
  },
  panelPendientes: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    marginTop: '12px', padding: '12px', background: '#fffde7',
    borderRadius: '10px',
  },
  chipEstudiante: {
    background: '#fff', border: '1px solid #ffe082', borderRadius: '20px',
    padding: '4px 12px', fontSize: '13px', color: '#5d4037',
  },
};
