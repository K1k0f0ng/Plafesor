import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconStar, IconAlertTriangle, IconClock } from '../components/Icons';

function nivelMEN(nota) {
  if (nota === null || nota === undefined) return { label: '—', color: '#bbb', bg: '#f5f5f5' };
  if (nota >= 4.6) return { label: 'Superior', color: '#1565c0', bg: '#e3f2fd' };
  if (nota >= 4.0) return { label: 'Alto',     color: '#2e7d32', bg: '#e8f5e9' };
  if (nota >= 3.5) return { label: 'Básico',   color: '#f57f17', bg: '#fff8e1' };
  return               { label: 'Bajo',      color: '#c62828', bg: '#ffebee' };
}

function colorCobertura(pct) {
  if (pct === null) return '#ccc';
  if (pct >= 80) return '#43a047';
  if (pct >= 50) return '#ff9800';
  return '#e53935';
}

function fechaRelativa(fecha) {
  if (!fecha) return 'Sin actividad creada';
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} mes${meses > 1 ? 'es' : ''}`;
}

function MiniBarra({ pct }) {
  const color = colorCobertura(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      <div style={{ width: '64px', height: '8px', background: '#ececec', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct === null ? 0 : pct}%`, height: '100%', background: color, borderRadius: '4px' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: '700', color, minWidth: '34px' }}>
        {pct === null ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

export default function EvaluacionDocentes() {
  const { usuario } = useAuth();

  const [docentes, setDocentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const r = await axiosAuth.get(`/api/reportes/colegio/${usuario.colegio_id}/evaluacion-docentes`);
      setDocentes(r.data?.data ?? []);
    } catch {
      setError('No se pudo cargar la evaluación de docentes.');
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Evaluación Docente" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <div>
            <h2 style={es.titulo}>Evaluación Docente</h2>
            <p style={es.subtitulo}>Indicadores objetivos de proceso para apoyar tu evaluación — no un puntaje único</p>
          </div>
        </div>

        <div style={es.metodologia}>
          <IconStar size={18} style={{ color: 'var(--color-secundario)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={es.metodologiaTitulo}>Cómo leer esta tabla</p>
            <p style={es.metodologiaTexto}>
              Ningún número resume por sí solo el trabajo de un docente. Esta tabla muestra <strong>señales de proceso</strong> —
              carga académica, seguimiento a los estudiantes y estudiantes en riesgo bajo su cargo — pensadas para conversar
              con el docente, no para rankearlo. El <strong>promedio</strong> usa solo lo ya calificado (no penaliza actividades
              que aún no ha completado el grupo), y la <strong>cobertura</strong> te dice qué tanto ha respondido el grupo a lo
              asignado. Complementa siempre con observación de clase y la propia autoevaluación del docente.
            </p>
          </div>
        </div>

        {error && <div style={es.error}>{error}</div>}

        {cargando ? (
          <div style={es.cargando}>Calculando indicadores...</div>
        ) : docentes.length === 0 ? (
          <div style={es.sinDatos}>
            <p style={{ fontWeight: '700', color: '#555' }}>Aún no hay docentes activos con datos</p>
          </div>
        ) : (
          <div style={es.tablaWrap}>
            <table style={es.tabla}>
              <thead>
                <tr>
                  <th style={es.th}>Docente</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Carga</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Estudiantes</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Actividades</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Cobertura</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Promedio</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>En alerta</th>
                  <th style={{ ...es.th, textAlign: 'center' }}>Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {docentes.map((d, i) => {
                  const nivel = nivelMEN(d.promedio_completado);
                  return (
                    <tr key={d.docente_id} style={{ ...es.tr, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...es.td, fontWeight: '700', color: '#222' }}>{d.nombre}</td>
                      <td style={{ ...es.td, textAlign: 'center', color: '#888' }}>
                        {d.total_grupos} grupo{d.total_grupos !== 1 ? 's' : ''} · {d.total_materias} materia{d.total_materias !== 1 ? 's' : ''}
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>{d.total_estudiantes}</td>
                      <td style={{ ...es.td, textAlign: 'center' }}>{d.total_actividades}</td>
                      <td style={es.td}><MiniBarra pct={d.cobertura} /></td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <span style={{ ...es.nivelBadge, color: nivel.color, background: nivel.bg }}>
                          {d.promedio_completado !== null ? d.promedio_completado.toFixed(1) : '—'} · {nivel.label}
                        </span>
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        {d.estudiantes_alerta > 0 ? (
                          <span style={es.alertaBadge}>
                            <IconAlertTriangle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {d.estudiantes_alerta}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>0</span>
                        )}
                      </td>
                      <td style={{ ...es.td, textAlign: 'center', color: '#999', fontSize: '12px' }}>
                        <IconClock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {fechaRelativa(d.ultima_actividad)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={es.leyenda}>
          <span><strong>Cobertura</strong>: % de actividades que sus estudiantes ya presentaron</span>
          <span><strong>Promedio</strong>: solo de lo ya calificado, escala MEN 1.0–5.0</span>
          <span><strong>En alerta</strong>: estudiantes con 2+ actividades bajo 3.5 en la misma materia</span>
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '28px 24px', maxWidth: '1200px', margin: '0 auto' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '16px' },
  titulo:    { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: 0 },
  subtitulo: { fontSize: '13px', color: '#888', margin: '4px 0 0' },

  metodologia: {
    display: 'flex', gap: '12px', background: '#f8f6ff', border: '1px solid #e4dcfb',
    borderRadius: '14px', padding: '16px 18px', marginBottom: '22px',
  },
  metodologiaTitulo: { fontSize: '13px', fontWeight: '700', color: '#4a3a80', margin: '0 0 4px' },
  metodologiaTexto:  { fontSize: '12.5px', color: '#6b5f94', lineHeight: '1.6', margin: 0 },

  error:    { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  cargando: { textAlign: 'center', color: '#888', padding: '60px', fontSize: '15px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '60px 24px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },

  tablaWrap: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflowX: 'auto' },
  tabla:     { width: '100%', borderCollapse: 'collapse', minWidth: '900px' },
  th:        { padding: '12px 14px', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f0f0f0', background: '#fafafa', textAlign: 'left' },
  tr:        { borderBottom: '1px solid #f5f5f5' },
  td:        { padding: '12px 14px', fontSize: '13px', color: '#333' },
  nivelBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' },
  alertaBadge: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '20px',
    background: '#ffebee', color: '#c62828', fontSize: '12px', fontWeight: '700',
  },

  leyenda: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px', fontSize: '12px', color: '#aaa' },
};
