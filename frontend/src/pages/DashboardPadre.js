import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconAlertTriangle, IconBarChart, IconTrendUp, IconInbox, IconEdit, IconCalendar } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const NIVEL_RIESGO = {
  bajo:    { label: 'Bajo',    color: '#2e7d32', fondo: '#e8f5e9' },
  medio:   { label: 'Medio',   color: '#f57f17', fondo: '#fff8e1' },
  alto:    { label: 'Alto',    color: '#e65100', fondo: '#fff3e0' },
  critico: { label: 'Crítico', color: '#c62828', fondo: '#ffebee' },
};

const TIPO_ANOTACION = {
  positiva: { label: 'Positiva',  color: '#2e7d32', bg: '#e8f5e9', badge: '#4caf50' },
  mejora:   { label: 'De mejora', color: '#e65100', bg: '#fff3e0', badge: '#ff9800' },
  neutral:  { label: 'Neutral',   color: '#555',    bg: '#f0f0f0', badge: '#9e9e9e' },
};

function colorNota(p) {
  if (!p) return '#aaa';
  if (p < 3.5) return '#ef5350';
  if (p < 4.0) return '#ff9800';
  return '#43a047';
}

function nivelMEN(p) {
  if (!p) return '—';
  if (p < 3.5) return 'Bajo';
  if (p < 4.0) return 'Básico';
  if (p <= 4.5) return 'Alto';
  return 'Superior';
}

function nivelDetalle(p) {
  if (!p) return { texto: '—', color: '#aaa', bg: '#f5f5f5' };
  if (p < 3.5) return { texto: 'Bajo',     color: '#c62828', bg: '#ffcdd2' };
  if (p < 4.0) return { texto: 'Básico',   color: '#f57f17', bg: '#fff9c4' };
  if (p <= 4.5) return { texto: 'Alto',    color: '#2e7d32', bg: '#c8e6c9' };
  return              { texto: 'Superior', color: '#1565c0', bg: '#bbdefb' };
}

function fechaCorta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Matriz de notas por período × materia
function MatrizPeriodos({ promediosPeriodo }) {
  if (!promediosPeriodo || promediosPeriodo.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', padding: '20px 0' }}>
        Aún no hay datos por período registrados.
      </div>
    );
  }

  const mapa = {};
  for (const row of promediosPeriodo) {
    if (!mapa[row.materia]) mapa[row.materia] = {};
    mapa[row.materia][row.periodo] = parseFloat(row.promedio);
  }
  const materiasOrdenadas = Object.keys(mapa).sort();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={es.thMatriz}>Materia</th>
            <th style={{ ...es.thMatriz, textAlign: 'center' }}>Período 1</th>
            <th style={{ ...es.thMatriz, textAlign: 'center' }}>Período 2</th>
            <th style={{ ...es.thMatriz, textAlign: 'center' }}>Período 3</th>
            <th style={{ ...es.thMatriz, textAlign: 'center' }}>Tendencia</th>
          </tr>
        </thead>
        <tbody>
          {materiasOrdenadas.map(mat => {
            const ps    = mapa[mat];
            const vals  = ['1', '2', '3'].map(p => ps[p] ?? null);
            const primer = vals.find(v => v !== null);
            const ultimo = [...vals].reverse().find(v => v !== null);
            const delta  = primer !== null && ultimo !== null && primer !== ultimo
              ? (ultimo - primer).toFixed(1) : null;
            return (
              <tr key={mat} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '9px 8px', fontWeight: '600', color: '#444' }}>{mat}</td>
                {['1', '2', '3'].map(p => {
                  const nota = ps[p];
                  const nd   = nivelDetalle(nota);
                  return (
                    <td key={p} style={{ textAlign: 'center', padding: '9px 12px' }}>
                      {nota != null ? (
                        <span style={{ background: nd.bg, color: nd.color, borderRadius: '6px', padding: '3px 10px', fontWeight: '800', fontSize: '13px', display: 'inline-block' }}>
                          {nota.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: '#ddd', fontSize: '13px' }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', padding: '9px 8px' }}>
                  {delta !== null ? (
                    <span style={{ fontWeight: '800', fontSize: '14px', color: parseFloat(delta) >= 0 ? '#27ae60' : '#e74c3c' }}>
                      {parseFloat(delta) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(delta)).toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ color: '#ddd' }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Gráfico de asistencia desglosado por estado
function GraficoAsistencia({ asistenciaDetalle }) {
  const ESTADO = {
    presente:    { label: 'Presente',    color: '#43a047' },
    tardanza:    { label: 'Tardanza',    color: '#fb8c00' },
    justificado: { label: 'Justificado', color: '#1e88e5' },
    ausente:     { label: 'Ausente',     color: '#e53935' },
  };

  if (!asistenciaDetalle || asistenciaDetalle.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', padding: '20px 0' }}>
        Sin registros de asistencia en los últimos 30 días.
      </div>
    );
  }

  const mapa  = {};
  for (const r of asistenciaDetalle) mapa[r.estado] = parseInt(r.total);
  const total = Object.values(mapa).reduce((s, v) => s + v, 0);
  const orden = ['presente', 'tardanza', 'justificado', 'ausente'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Barra apilada */}
      <div style={{ display: 'flex', height: '30px', borderRadius: '10px', overflow: 'hidden', gap: '2px' }}>
        {orden.map(e => {
          const count = mapa[e] || 0;
          const pct   = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div key={e}
              style={{ width: `${pct}%`, background: ESTADO[e].color, transition: 'width 0.4s' }}
              title={`${ESTADO[e].label}: ${count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {orden.map(e => {
          const count = mapa[e] || 0;
          const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
          if (count === 0) return null;
          return (
            <div key={e} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '6px 12px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: ESTADO[e].color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#666' }}>{ESTADO[e].label}</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: ESTADO[e].color }}>{count}</span>
              <span style={{ fontSize: '11px', color: '#bbb' }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '11px', color: '#bbb' }}>
        Total: {total} registros en los últimos 30 días
      </div>
    </div>
  );
}

// Gráfico de barras del historial (mismo patrón que MateriaEstudiante)
function GraficoHistorial({ historial }) {
  if (!historial || historial.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: '13px' }}>
        Aún no hay actividades completadas para mostrar el historial.
      </div>
    );
  }

  const notas     = historial.map(a => parseFloat(a.nota));
  const promedio  = (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(2);
  const mejor     = Math.max(...notas);
  const peor      = Math.min(...notas);
  const tendencia = notas.length >= 2 ? (notas[notas.length - 1] - notas[0]).toFixed(2) : null;
  const nivelProm = nivelDetalle(parseFloat(promedio));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Stats del historial */}
      <div style={es.historialStats}>
        <div style={es.hStatBox}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: nivelProm.color }}>{promedio}</span>
          <span style={es.hStatLabel}>Promedio</span>
        </div>
        <div style={es.hStatBox}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#27ae60' }}>{mejor.toFixed(1)}</span>
          <span style={es.hStatLabel}>Mejor nota</span>
        </div>
        <div style={es.hStatBox}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#e74c3c' }}>{peor.toFixed(1)}</span>
          <span style={es.hStatLabel}>Peor nota</span>
        </div>
        {tendencia !== null && (
          <div style={es.hStatBox}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: parseFloat(tendencia) >= 0 ? '#27ae60' : '#e74c3c' }}>
              {parseFloat(tendencia) >= 0 ? '↑' : '↓'} {Math.abs(tendencia)}
            </span>
            <span style={es.hStatLabel}>Tendencia</span>
          </div>
        )}
        <div style={es.hStatBox}>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#667eea' }}>{historial.length}</span>
          <span style={es.hStatLabel}>Actividades</span>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div style={es.grafico}>
        {historial.map((act, i) => {
          const n     = parseFloat(act.nota);
          const nivel = nivelDetalle(n);
          const pct   = (n / 5) * 100;
          return (
            <div key={i} title={`${act.titulo}\n${act.materia} · P${act.periodo}\n${fechaCorta(act.completada_en)}`}
              style={es.barraCol}>
              <div style={es.barraValor}>{n.toFixed(1)}</div>
              <div style={es.barraFondo}>
                <div style={{ ...es.barraRelleno, height: `${pct}%`, background: nivel.color }} />
              </div>
              <div style={es.barraIdx}>{i + 1}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
        Cada barra es una actividad completada — pasa el cursor para ver el detalle
      </div>

      {/* Lista cronológica */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...historial].reverse().map((act, i) => {
          const nivel = nivelDetalle(parseFloat(act.nota));
          return (
            <div key={i} style={es.historialFila}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#333' }}>{act.titulo}</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                  {act.materia} · Período {act.periodo} · {fechaCorta(act.completada_en)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', color: nivel.color }}>{act.nota}</span>
                <span style={{ ...es.nivelBadge, background: nivel.bg, color: nivel.color }}>{nivel.texto}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nombrePeriodoObs(periodo) {
  return periodo === 'final' ? 'Consolidado del año (Final)' : `Período ${periodo}`;
}

// Observaciones del boletín — el párrafo oficial de cada período, redactado
// por el docente (con apoyo de IA) y visible para la familia
function ListaObservaciones({ observaciones }) {
  if (!observaciones || observaciones.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', padding: '16px 0' }}>
        Aún no hay observaciones de boletín publicadas.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {observaciones.map(o => (
        <div key={o.periodo} style={es.obsCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            <span style={es.obsPeriodo}>{nombrePeriodoObs(o.periodo)}</span>
            {o.nombre_docente && <span style={es.anotacionMeta}>{o.nombre_docente}</span>}
          </div>
          <p style={es.anotacionTexto}>{o.texto}</p>
        </div>
      ))}
    </div>
  );
}

// Anotaciones del observador del estudiante — notas del docente, visibles al acudiente
function ListaAnotaciones({ anotaciones }) {
  if (!anotaciones || anotaciones.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', padding: '24px 0' }}>
        Aún no hay anotaciones registradas para tu hijo/a.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {anotaciones.map(a => {
        const cfg = TIPO_ANOTACION[a.tipo] || TIPO_ANOTACION.neutral;
        return (
          <div key={a.id} style={{ ...es.anotacionCard, borderLeft: `4px solid ${cfg.badge}` }}>
            <span style={{ ...es.tipoBadge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            <p style={es.anotacionTexto}>{a.texto}</p>
            <p style={es.anotacionMeta}>
              {a.nombre_docente} · Grado {a.grado}° {a.nombre_grupo} · {fechaCorta(a.creado_en)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function fechaCitacion(fecha, hora) {
  if (!fecha) return null;
  const txt = new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  return hora ? `${txt} a las ${hora.slice(0, 5)}` : txt;
}

const ESTADO_CITACION = {
  pendiente: { label: 'Pendiente', color: '#e65100', bg: '#fff3e0' },
  realizada: { label: 'Realizada', color: '#2e7d32', bg: '#e8f5e9' },
  cancelada: { label: 'Cancelada', color: '#999',    bg: '#f0f0f0' },
};

// Citaciones a reunión — convocadas por la dirección del colegio o del grupo
function ListaCitaciones({ citaciones }) {
  if (!citaciones || citaciones.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#bbb', fontSize: '13px', padding: '16px 0' }}>
        No tienes citaciones registradas.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {citaciones.map(c => {
        const cfg = ESTADO_CITACION[c.estado] || ESTADO_CITACION.pendiente;
        return (
          <div key={c.id} style={{ ...es.anotacionCard, borderLeft: `4px solid ${cfg.color}` }}>
            <span style={{ ...es.tipoBadge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            <p style={es.anotacionTexto}>{c.motivo}</p>
            {(c.fecha_cita || c.lugar) && (
              <p style={{ ...es.anotacionMeta, color: '#667eea', fontWeight: '700', marginBottom: '2px' }}>
                {fechaCitacion(c.fecha_cita, c.hora_cita)}{c.lugar ? ` · ${c.lugar}` : ''}
              </p>
            )}
            <p style={es.anotacionMeta}>{c.nombre_citador} · {fechaCorta(c.creado_en)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPadre() {
  const { usuario } = useAuth();
  const [hijos,       setHijos]       = useState([]);
  const [hijoIdx,     setHijoIdx]     = useState(0);
  const [tab,         setTab]         = useState('resumen'); // 'resumen' | 'historial'
  const [cargando,    setCargando]    = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    axiosAuth.get('/api/padre/mis-hijos')
      .then(r => setHijos(r.data.data))
      .catch(() => setError('Error al cargar la información. Intenta de nuevo.'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Portal de Padres" />
        <div style={es.contenido}><p style={{ color: '#aaa' }}>Cargando...</p></div>
      </div>
    );
  }

  const hijo = hijos[hijoIdx] || null;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Portal de Padres" />
      <div style={es.contenido}>

        <div style={es.bienvenida}>
          <h2 style={es.bienvenidaTitulo}>Hola, {usuario.nombre}</h2>
          <p style={es.bienvenidaSub}>Progreso académico de tu hijo/a en tiempo real.</p>
        </div>

        {error && <div style={es.error}>{error}</div>}

        {!error && hijos.length === 0 && (
          <div style={es.sinDatos}>
            <IconInbox size={48} style={{ color: '#ccc' }} />
            <p>Tu cuenta aún no está vinculada a un estudiante.</p>
            <p style={{ fontSize: '13px', color: '#aaa' }}>Comunícate con la institución para que hagan la vinculación.</p>
          </div>
        )}

        {hijos.length > 0 && (
          <>
            {/* Selector de hijo — visible solo si hay más de uno */}
            {hijos.length > 1 && (
              <div style={es.selectorWrap}>
                <p style={es.selectorLabel}>Selecciona un hijo/a:</p>
                <div style={es.selectorBtns}>
                  {hijos.map((h, i) => (
                    <button
                      key={h.id}
                      onClick={() => { setHijoIdx(i); setTab('resumen'); }}
                      style={{ ...es.selectorBtn, ...(hijoIdx === i ? es.selectorBtnActivo : {}) }}
                    >
                      <span style={{ ...es.selectorAvatar, background: hijoIdx === i ? '#667eea' : '#e0e0e0', color: hijoIdx === i ? '#fff' : '#888' }}>
                        {h.nombre.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontWeight: hijoIdx === i ? '700' : '500', color: hijoIdx === i ? '#667eea' : '#555' }}>
                        {h.nombre.split(' ')[0]}
                      </span>
                      {h.grado && <span style={{ fontSize: '11px', color: '#aaa' }}>Grado {h.grado}°</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hijo && (
              <div style={es.hijoCard}>

                {/* Banner de citación pendiente — se muestra siempre arriba, sin importar el tab activo */}
                {hijo.citaciones?.some(c => c.estado === 'pendiente') && (() => {
                  const pendiente = hijo.citaciones.find(c => c.estado === 'pendiente');
                  return (
                    <div style={es.citacionBanner}>
                      <IconCalendar size={18} style={{ color: '#e65100', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={es.citacionBannerTitulo}>La institución solicita una reunión</p>
                        <p style={es.citacionBannerTexto}>
                          {pendiente.motivo}
                          {pendiente.fecha_cita && ` — ${fechaCitacion(pendiente.fecha_cita, pendiente.hora_cita)}`}
                          {pendiente.lugar && ` · ${pendiente.lugar}`}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Encabezado */}
                <div style={es.hijoHeader}>
                  <div style={es.hijoAvatar}>{hijo.nombre.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={es.hijoNombre}>{formatearApellidoPrimero(hijo.nombre)}</h3>
                    <p style={es.hijoGrupo}>
                      {hijo.grado ? `Grado ${hijo.grado}°` : ''}
                      {hijo.grupo ? ` — ${hijo.grupo}` : ''}
                      {hijo.colegio ? ` · ${hijo.colegio}` : ''}
                    </p>
                  </div>
                  {hijo.riesgo?.nivel && hijo.riesgo.nivel !== 'bajo' && (
                    <span style={{ ...es.riesgoBadge, background: NIVEL_RIESGO[hijo.riesgo.nivel]?.fondo, color: NIVEL_RIESGO[hijo.riesgo.nivel]?.color }}>
                      <IconAlertTriangle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      Riesgo {NIVEL_RIESGO[hijo.riesgo.nivel]?.label}
                    </span>
                  )}
                </div>

                {/* Tabs: Resumen / Historial / Estadísticas */}
                <div style={es.tabs}>
                  <button onClick={() => setTab('resumen')}
                    style={{ ...es.tab, ...(tab === 'resumen' ? es.tabActivo : {}) }}>
                    <IconBarChart size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Resumen
                  </button>
                  <button onClick={() => setTab('historial')}
                    style={{ ...es.tab, ...(tab === 'historial' ? es.tabHistorialActivo : {}) }}>
                    <IconTrendUp size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Historial
                    {hijo.historial?.length > 0 && (
                      <span style={es.tabBadge}>{hijo.historial.length}</span>
                    )}
                  </button>
                  <button onClick={() => setTab('estadisticas')}
                    style={{ ...es.tab, ...(tab === 'estadisticas' ? es.tabEstActivo : {}) }}>
                    <IconAlertTriangle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Estadísticas
                  </button>
                  <button onClick={() => setTab('anotaciones')}
                    style={{ ...es.tab, ...(tab === 'anotaciones' ? es.tabAnotActivo : {}) }}>
                    <IconEdit size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Seguimiento
                    {(hijo.anotaciones?.length > 0 || hijo.citaciones?.length > 0) && (
                      <span style={es.tabBadge}>{(hijo.anotaciones?.length || 0) + (hijo.citaciones?.length || 0)}</span>
                    )}
                  </button>
                </div>

                {/* TAB: RESUMEN */}
                {tab === 'resumen' && (
                  <>
                    {/* Stats rápidas */}
                    <div style={es.statsRow}>
                      <div style={es.statBox}>
                        <span style={{ fontSize: '24px', fontWeight: '800', color: colorNota(parseFloat(hijo.promedio_global)) }}>
                          {hijo.promedio_global ?? '—'}
                        </span>
                        <span style={es.statLabel}>Promedio general</span>
                        <span style={{ fontSize: '11px', color: colorNota(parseFloat(hijo.promedio_global)), fontWeight: '700' }}>
                          {nivelMEN(parseFloat(hijo.promedio_global))}
                        </span>
                      </div>
                      <div style={es.statBox}>
                        <span style={{ fontSize: '24px', fontWeight: '800', color: '#667eea' }}>
                          {hijo.asistencia?.tasa != null ? `${hijo.asistencia.tasa}%` : '—'}
                        </span>
                        <span style={es.statLabel}>Asistencia</span>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Últimos 30 días</span>
                      </div>
                      <div style={es.statBox}>
                        <span style={{ fontSize: '24px', fontWeight: '800', color: '#555' }}>
                          {hijo.materias?.length ?? 0}
                        </span>
                        <span style={es.statLabel}>Materias</span>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>Con actividades</span>
                      </div>
                    </div>

                    {/* Notas por materia */}
                    {hijo.materias?.length > 0 && (
                      <div style={es.seccion}>
                        <p style={es.seccionTitulo}>Notas por materia</p>
                        <div style={es.materiasGrid}>
                          {hijo.materias.map(m => {
                            const prom = parseFloat(m.promedio);
                            return (
                              <div key={m.nombre} style={es.materiaRow}>
                                <span style={es.materiaNombre}>{m.nombre}</span>
                                <div style={es.barraHorizWrap}>
                                  <div style={{ ...es.barraHorizRelleno, width: `${Math.min(100, ((prom - 1) / 4) * 100)}%`, background: colorNota(prom) }} />
                                </div>
                                <span style={{ ...es.materiaNota, color: colorNota(prom) }}>{m.promedio}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Últimas actividades */}
                    {hijo.recientes?.length > 0 && (
                      <div style={es.seccion}>
                        <p style={es.seccionTitulo}>Actividades recientes</p>
                        <div style={es.recientesList}>
                          {hijo.recientes.map((r, i) => (
                            <div key={i} style={es.recienteRow}>
                              <div style={{ flex: 1 }}>
                                <span style={es.actTitulo}>{r.titulo}</span>
                                <span style={es.actMateria}>{r.materia}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '11px', color: '#bbb' }}>{fechaCorta(r.completada_en)}</span>
                                <span style={{ fontWeight: '800', fontSize: '15px', color: colorNota(parseFloat(r.nota)) }}>
                                  {r.nota}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* TAB: HISTORIAL */}
                {tab === 'historial' && (
                  <div style={es.seccion}>
                    <p style={es.seccionTitulo}>Evolución de notas — todas las actividades</p>
                    <GraficoHistorial historial={hijo.historial} />
                  </div>
                )}

                {/* TAB: ESTADÍSTICAS */}
                {tab === 'estadisticas' && (
                  <>
                    <div style={es.seccion}>
                      <p style={es.seccionTitulo}>Notas por período académico</p>
                      <MatrizPeriodos promediosPeriodo={hijo.promedios_periodo} />
                    </div>
                    <div style={es.seccion}>
                      <p style={es.seccionTitulo}>Asistencia — últimos 30 días</p>
                      <GraficoAsistencia asistenciaDetalle={hijo.asistencia_detalle} />
                    </div>
                  </>
                )}

                {/* TAB: SEGUIMIENTO (observaciones de boletín + anotaciones) */}
                {tab === 'anotaciones' && (
                  <>
                    <div style={es.seccion}>
                      <p style={es.seccionTitulo}>Observaciones del boletín</p>
                      <ListaObservaciones observaciones={hijo.observaciones} />
                    </div>
                    <div style={es.seccion}>
                      <p style={es.seccionTitulo}>Anotaciones del observador del estudiante</p>
                      <ListaAnotaciones anotaciones={hijo.anotaciones} />
                    </div>
                    <div style={es.seccion}>
                      <p style={es.seccionTitulo}>Citaciones a reunión</p>
                      <ListaCitaciones citaciones={hijo.citaciones} />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '28px 24px', maxWidth: '860px', margin: '0 auto' },
  bienvenida:       { marginBottom: '20px' },
  bienvenidaTitulo: { fontSize: '22px', fontWeight: '800', color: '#333', margin: 0 },
  bienvenidaSub:    { fontSize: '14px', color: '#888', margin: '4px 0 0' },
  error:    { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },

  // Selector de hijo
  selectorWrap:  { background: '#fff', borderRadius: '16px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  selectorLabel: { fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' },
  selectorBtns:  { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  selectorBtn:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px 16px', borderRadius: '12px', border: '2px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', minWidth: '80px' },
  selectorBtnActivo: { borderColor: '#667eea', background: '#f0f0ff' },
  selectorAvatar:{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800' },

  hijoCard:   { background: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
  hijoHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' },
  hijoAvatar: { width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hijoNombre: { fontSize: '18px', fontWeight: '800', color: '#333', margin: 0 },
  hijoGrupo:  { fontSize: '13px', color: '#888', margin: '2px 0 0' },
  riesgoBadge:{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', marginLeft: 'auto' },

  tabs:           { display: 'flex', gap: '8px', marginBottom: '20px' },
  tab:            { flex: 1, padding: '10px 16px', borderRadius: '10px', border: '2px solid #e0e0e0', background: '#fafafa', color: '#888', cursor: 'pointer', fontWeight: '600', fontSize: '14px', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' },
  tabActivo:          { borderColor: '#667eea', color: '#667eea', background: '#f0f0ff' },
  tabHistorialActivo: { borderColor: '#43e97b', color: '#1b4332', background: '#f0fff6' },
  tabEstActivo:       { borderColor: '#fb8c00', color: '#bf360c', background: '#fff8f0' },
  tabAnotActivo:      { borderColor: '#5c6bc0', color: '#3949ab', background: '#f0f1ff' },

  // Observaciones de boletín
  obsCard:    { background: '#f8f6ff', border: '1px solid #e4dcfb', borderRadius: '10px', padding: '12px 14px' },
  obsPeriodo: { fontSize: '12px', fontWeight: '800', color: '#5c35c2' },

  // Banner de citación pendiente
  citacionBanner:       { display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' },
  citacionBannerTitulo: { fontSize: '13px', fontWeight: '800', color: '#e65100', margin: 0 },
  citacionBannerTexto:  { fontSize: '12.5px', color: '#8d5524', margin: '3px 0 0', lineHeight: 1.5 },

  // Anotaciones
  anotacionCard:  { background: '#fafafa', borderRadius: '10px', padding: '12px 14px' },
  tipoBadge:      { display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  anotacionTexto: { fontSize: '13px', color: '#333', margin: '8px 0 6px', lineHeight: 1.5 },
  anotacionMeta:  { fontSize: '11px', color: '#aaa', margin: 0 },
  tabBadge:           { background: '#667eea', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '11px' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' },
  statBox:  { background: '#f7f8ff', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  statLabel:{ fontSize: '11px', color: '#888', fontWeight: '600' },

  seccion:      { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' },
  seccionTitulo:{ fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' },

  materiasGrid:    { display: 'flex', flexDirection: 'column', gap: '8px' },
  materiaRow:      { display: 'flex', alignItems: 'center', gap: '10px' },
  materiaNombre:   { flex: '0 0 120px', fontSize: '13px', color: '#555', fontWeight: '600' },
  barraHorizWrap:  { flex: 1, height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' },
  barraHorizRelleno:{ height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  materiaNota:     { flex: '0 0 32px', textAlign: 'right', fontSize: '14px', fontWeight: '800' },

  recientesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  recienteRow:   { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#fafafa', borderRadius: '10px' },
  actTitulo:     { fontSize: '13px', fontWeight: '700', color: '#333', display: 'block' },
  actMateria:    { fontSize: '11px', color: '#aaa', display: 'block', marginTop: '1px' },

  // Historial
  historialStats: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  hStatBox:       { flex: '1 1 70px', background: '#f7f8ff', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  hStatLabel:     { fontSize: '10px', color: '#aaa', fontWeight: '600', textAlign: 'center' },

  grafico:     { display: 'flex', gap: '6px', alignItems: 'flex-end', height: '110px', overflowX: 'auto', padding: '0 2px 4px', background: '#fafafa', borderRadius: '10px', paddingTop: '10px' },
  barraCol:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '32px', flex: '0 0 32px', cursor: 'default' },
  barraValor:  { fontSize: '9px', fontWeight: '700', color: '#666', height: '12px' },
  barraFondo:  { width: '100%', background: '#e8e8e8', borderRadius: '4px 4px 0 0', height: '72px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barraRelleno:{ width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' },
  barraIdx:    { fontSize: '9px', color: '#ccc' },

  historialFila: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#fafafa', borderRadius: '10px' },
  nivelBadge:    { borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' },

  // Matriz de períodos
  thMatriz: { textAlign: 'left', padding: '6px 8px', color: '#999', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '2px solid #f0f0f0' },
};
