import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import {
  IconBot, IconClipboard, IconBarChart, IconBookOpen, IconMonitor,
  IconGlobe, IconFlask, IconMap, IconGrid, IconInbox, IconTrendUp,
  IconStar, IconFlame, IconZap, IconCheckCircle, IconCheck,
} from '../components/Icons';

const COLORES_MATERIA = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

const LOGRO_ICONO = {
  primera_actividad:   <IconStar size={16} style={{ color: '#ffd600' }} />,
  nota_perfecta:       <IconZap size={16} style={{ color: '#ff6d00' }} />,
  diez_actividades:    <IconCheck size={16} style={{ color: '#43a047' }} />,
  treinta_actividades: <IconCheckCircle size={16} style={{ color: '#1565c0' }} />,
  racha_3_dias:        <IconFlame size={16} style={{ color: '#ff6d00' }} />,
  racha_7_dias:        <IconFlame size={16} style={{ color: '#d32f2f' }} />,
  todo_aprobado:       <IconCheckCircle size={16} style={{ color: '#2e7d32' }} />,
  sin_errores:         <IconStar size={16} style={{ color: '#7b1fa2' }} />,
};

const ICONO_MATERIA = {
  MAT: IconGrid,
  ING: IconGlobe,
  INF: IconMonitor,
  LEN: IconBookOpen,
  CNT: IconFlask,
  CSO: IconMap,
};

export default function DashboardEstudiante() {
  const [materias, setMaterias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sinGrupo, setSinGrupo] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [planExpandido, setPlanExpandido] = useState(null);
  const [logrosData, setLogrosData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function cargar() {
      try {
        const [respMaterias, respActividades, respPlanes, respLogros] = await Promise.allSettled([
          axiosAuth.get('/api/materias/mis-materias'),
          axiosAuth.get('/api/actividades/estudiante'),
          axiosAuth.get('/api/planes/mis-planes'),
          axiosAuth.get('/api/logros/mis-logros'),
        ]);

        const listaMaterias = respMaterias.status === 'fulfilled'
          ? respMaterias.value.data.data
          : [];

        const actividades = respActividades.status === 'fulfilled'
          ? respActividades.value.data.data
          : [];

        // Contar actividades por materia
        const conteos = {};
        for (const act of actividades) {
          if (!conteos[act.materia_id]) {
            conteos[act.materia_id] = { total: 0, completadas: 0 };
          }
          conteos[act.materia_id].total++;
          if (act.nota !== null) conteos[act.materia_id].completadas++;
        }

        const combinadas = listaMaterias.map(m => ({
          ...m,
          total: conteos[m.id]?.total || 0,
          completadas: conteos[m.id]?.completadas || 0,
        }));

        if (respPlanes.status === 'fulfilled') {
          setPlanes(respPlanes.value.data.data || []);
        }
        if (respLogros.status === 'fulfilled') {
          setLogrosData(respLogros.value.data.data);
        }

        setSinGrupo(listaMaterias.length === 0);
        setMaterias(combinadas);
      } catch {
        setSinGrupo(true);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mis materias" />
      <div style={es.contenido}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/tutor')} style={{ ...es.btnTutor, flex: 1 }}>
            <IconBot size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Tutor IA — ¿Tienes dudas? ¡Pregúntame!
          </button>
          <button onClick={() => navigate('/mi-historial')} style={{ ...es.btnTutor, flex: 1, background: 'linear-gradient(135deg, #2e7d32, #43a047)' }}>
            <IconTrendUp size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Mi historial académico
          </button>
        </div>

        {/* Racha y logros */}
        {logrosData && (
          <div style={es.logrosBanner}>
            <div style={es.rachaRow}>
              <div style={es.rachaChip}>
                <IconFlame size={18} style={{ color: logrosData.racha > 0 ? '#ff6d00' : '#bbb' }} />
                <span style={{ fontWeight: 800, fontSize: 20, color: logrosData.racha > 0 ? '#ff6d00' : '#bbb', margin: '0 4px' }}>
                  {logrosData.racha}
                </span>
                <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>
                  {logrosData.racha === 1 ? 'día seguido' : 'días seguidos'}
                </span>
              </div>
              <div style={es.rachaStats}>
                <span style={es.statChip}>{logrosData.totalActividades} actividades</span>
                {logrosData.promedio && (
                  <span style={{ ...es.statChip, background: '#e8f5e9', color: '#2e7d32' }}>
                    Promedio {logrosData.promedio}
                  </span>
                )}
                <span style={{ ...es.statChip, background: '#ede7f6', color: '#512da8' }}>
                  {logrosData.logros.filter(l => l.obtenido).length}/{logrosData.logros.length} logros
                </span>
              </div>
            </div>
            <div style={es.logrosGrid}>
              {logrosData.logros.map(logro => (
                <div key={logro.tipo} title={logro.desc}
                  style={{ ...es.logroChip, opacity: logro.obtenido ? 1 : 0.38 }}>
                  {LOGRO_ICONO[logro.tipo] || <IconStar size={16} />}
                  <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5 }}>{logro.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Planes de mejoramiento activos */}
        {planes.length > 0 && (
          <div style={es.planBanner}>
            <div style={es.planEncabezado}>
              <IconClipboard size={26} style={{ color: '#e65100', flexShrink: 0 }} />
              <div>
                <div style={es.planTitulo}>
                  Tienes {planes.length === 1 ? 'un plan de mejoramiento activo' : `${planes.length} planes de mejoramiento activos`}
                </div>
                <div style={es.planSubtitulo}>Tu institución generó un plan para apoyarte. ¡Revísalo!</div>
              </div>
            </div>
            {planes.map(plan => (
              <div key={plan.id} style={es.planCard}>
                <div style={es.planCardHeader}>
                  <div>
                    <span style={es.planMateria}>{plan.materia}</span>
                    <span style={es.planPeriodo}>Período {plan.periodo} · {plan.grado}° {plan.grupo}</span>
                  </div>
                  <button onClick={() => setPlanExpandido(planExpandido === plan.id ? null : plan.id)} style={es.planBtnVer}>
                    {planExpandido === plan.id ? '▲ Ocultar' : '▼ Ver plan'}
                  </button>
                </div>
                <div style={es.planDiag}><IconBarChart size={13} style={{ marginRight: 5, verticalAlign: 'middle', color: '#667eea' }} />{plan.diagnostico}</div>
                {planExpandido === plan.id && plan.plan_texto && (
                  <div style={es.planTexto}>
                    {plan.plan_texto.split('\n').map((linea, i) => {
                      const esTitulo = /^[A-ZÁÉÍÓÚÑ\s]+:/.test(linea.trim()) && linea.trim().length < 40;
                      return (
                        <p key={i} style={esTitulo ? es.planSeccion : es.planLinea}>{linea || ' '}</p>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p style={es.subtitulo}>Selecciona una materia para ver tus actividades</p>

        {cargando ? (
          <p style={es.textoGris}>Cargando...</p>
        ) : sinGrupo ? (
          <div style={es.sinDatos}>
            <IconInbox size={48} style={{ color: '#ccc' }} />
            <p>Aún no estás asignado a un grupo.<br />Consulta con tu administrador.</p>
          </div>
        ) : (
          <div style={es.materiasGrid}>
            {materias.map((m, i) => {
              const progreso = m.total > 0 ? Math.round((m.completadas / m.total) * 100) : 0;
              const color = COLORES_MATERIA[i % COLORES_MATERIA.length];
              return (
                <button key={m.id} onClick={() => navigate(`/materia/${m.id}`)}
                  style={{ ...es.materiaCard, borderTop: `5px solid ${color}` }}>
                  <div style={es.materiaIcono}>
                    {(() => { const Ic = ICONO_MATERIA[m.codigo] || IconBookOpen; return <Ic size={36} style={{ color }} />; })()}
                  </div>
                  <div style={es.materiaNombre}>{m.nombre}</div>
                  {m.nombre_docente && (
                    <div style={es.materiaDocente}>{m.nombre_docente}</div>
                  )}
                  <div style={es.progresoBarra}>
                    <div style={{ ...es.progresoRelleno, width: `${progreso}%`, background: color }} />
                  </div>
                  <div style={es.progresoTexto}>
                    {m.total === 0
                      ? 'Sin actividades aún'
                      : `${m.completadas}/${m.total} actividades completadas`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' },
  subtitulo: { color: '#888', marginBottom: '28px', fontSize: '15px' },
  materiasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' },
  materiaCard: {
    background: '#fff', border: 'none', borderRadius: '16px', padding: '28px 24px',
    cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'inherit',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  materiaIcono: { height: 40, display: 'flex', alignItems: 'center' },
  materiaNombre: { fontSize: '17px', fontWeight: '700', color: '#333' },
  materiaDocente: { fontSize: '13px', color: '#666' },
  progresoBarra: { height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' },
  progresoRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.3s' },
  progresoTexto: { fontSize: '12px', color: '#888' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  textoGris: { color: '#888', fontSize: '14px' },
  btnTutor: {
    display: 'block', width: '100%', marginBottom: '16px',
    background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    color: '#1b4332', border: 'none', borderRadius: '14px',
    padding: '16px 24px', fontSize: '15px', fontWeight: '700',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(67,233,123,0.3)',
  },
  planBanner: {
    background: '#fff8e1', border: '2px solid #ffe082', borderRadius: 14,
    padding: '16px 20px', marginBottom: 24,
  },
  planEncabezado: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  planTitulo: { fontSize: 15, fontWeight: 800, color: '#e65100', marginBottom: 2 },
  planSubtitulo: { fontSize: 13, color: '#888' },
  planCard: {
    background: '#fff', borderRadius: 10, padding: '12px 16px',
    marginBottom: 10, border: '1px solid #ffe082',
  },
  planCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  planMateria: { fontSize: 15, fontWeight: 800, color: '#333', marginRight: 10 },
  planPeriodo: { fontSize: 12, color: '#888', fontWeight: 600 },
  planBtnVer: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', padding: 0 },
  planDiag: { fontSize: 13, color: '#555', background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 6, padding: '6px 10px' },
  planTexto: { marginTop: 10, background: '#f8f9fa', borderRadius: 8, padding: 14, borderLeft: '4px solid #667eea' },
  planSeccion: { fontWeight: 800, color: '#333', fontSize: 13, margin: '10px 0 4px' },
  planLinea: { fontSize: 13, color: '#555', margin: '2px 0', lineHeight: 1.6 },
  logrosBanner: {
    background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 20,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  },
  rachaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  rachaChip: { display: 'flex', alignItems: 'center', gap: 4 },
  rachaStats: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statChip: { background: '#f0f2f5', color: '#555', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
  logrosGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  logroChip: {
    display: 'flex', alignItems: 'center', background: '#f8f9fa',
    borderRadius: 20, padding: '5px 12px', border: '1px solid #eee',
    transition: 'opacity 0.2s',
  },
};
