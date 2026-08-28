import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import {
  SemaforoDot, IconBarChart, IconInbox, IconClipboard,
  IconCalendar, IconBookOpen, IconTrendUp, IconUser, IconMap,
} from '../components/Icons';

function colorPromedio(p) {
  if (p === null || p === undefined) return { bg: '#f5f5f5', color: '#bbb' };
  if (p < 3.5) return { bg: '#ffcdd2', color: '#c62828' };
  if (p < 4.0) return { bg: '#fff9c4', color: '#f57f17' };
  return { bg: '#c8e6c9', color: '#2e7d32' };
}

function semaforoColor(p) {
  if (p === null || p === undefined) return '#e0e0e0';
  if (p < 3.5) return '#ef5350';
  if (p < 4.0) return '#ffa726';
  return '#66bb6a';
}

function formatFecha(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function MetricasInstitucional() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [periodo, setPeriodo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const colegioId = usuario.colegio_id;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const url = periodo
        ? `/api/reportes/colegio/${colegioId}/metricas?periodo=${periodo}`
        : `/api/reportes/colegio/${colegioId}/metricas`;
      const resp = await axiosAuth.get(url);
      setDatos(resp.data.data);
    } catch {
      setError('No se pudo cargar la información. Verifica tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [colegioId, periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const resumen    = datos?.resumen    || {};
  const materias   = datos?.materias   || [];
  const docentes   = datos?.docentes   || [];
  const tendencia  = datos?.tendencia  || [];
  const mapaCalor  = datos?.mapa_calor || [];
  const asistencia = datos?.asistencia || {};

  // Construir grupos y materias únicos para el mapa de calor
  const gruposUnicos = [...new Map(
    mapaCalor.map(m => [m.grupo_id, { id: m.grupo_id, nombre: m.nombre_grupo, grado: m.grado }])
  ).values()].sort((a, b) => a.grado - b.grado || a.nombre.localeCompare(b.nombre));

  const materiasUnicas = [...new Map(
    mapaCalor.map(m => [m.materia_id, { id: m.materia_id, nombre: m.nombre_materia }])
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  function getCeldaMapa(grupoId, materiaId) {
    return mapaCalor.find(m => m.grupo_id === grupoId && m.materia_id === materiaId) || null;
  }

  const total = resumen.total || 0;
  const pctNivel = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div style={es.pagina}>
      <Navbar titulo="Centro de Métricas" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.encabezado}>
          <button onClick={() => navigate('/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}><IconBarChart size={20} style={{ color: '#667eea' }} />Centro de Métricas — {datos?.colegio || ''}</h2>
        </div>

        {/* Filtro período */}
        <div style={es.filtroRow}>
          {['', '1', '2', '3'].map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              style={{ ...es.filtroBtn, ...(periodo === p ? es.filtroBtnActivo : {}) }}>
              {p === '' ? 'Todos los períodos' : `Período ${p}`}
            </button>
          ))}
        </div>

        {error && <div style={es.errorBox}>{error}</div>}

        {cargando ? (
          <div style={es.cargando}>Calculando métricas institucionales...</div>
        ) : !datos || total === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={52} style={{ color: '#ccc' }} />
            <p>Aún no hay resultados de actividades registrados para calcular métricas.</p>
          </div>
        ) : (
          <>
            {/* ── CARDS DE RESUMEN ── */}
            <div style={es.statsGrid}>

              <div style={es.statCard}>
                <IconBarChart size={28} style={{ color: colorPromedio(resumen.promedio).color }} />
                <span style={es.statValor}>{resumen.promedio ?? '—'}</span>
                <span style={es.statLabel}>Promedio institucional</span>
                <span style={{ ...es.statSub, color: colorPromedio(resumen.promedio).color }}>
                  {resumen.promedio >= 4 ? 'Desempeño Alto' : resumen.promedio >= 3 ? 'Desempeño Básico' : 'Desempeño Bajo'}
                </span>
              </div>

              <div style={es.statCard}>
                <IconClipboard size={28} style={{ color: '#667eea' }} />
                <span style={es.statValor}>{resumen.total?.toLocaleString() ?? '0'}</span>
                <span style={es.statLabel}>Resultados registrados</span>
                <div style={es.barraDistribucion}>
                  {[
                    { pct: pctNivel(resumen.nivel_bajo),      color: '#ef5350' },
                    { pct: pctNivel(resumen.nivel_basico),    color: '#ffa726' },
                    { pct: pctNivel(resumen.nivel_alto),      color: '#66bb6a' },
                    { pct: pctNivel(resumen.nivel_superior),  color: '#42a5f5' },
                  ].map((seg, i) => (
                    seg.pct > 0 && <div key={i} style={{ width: `${seg.pct}%`, background: seg.color, height: '100%' }} />
                  ))}
                </div>
                <span style={{ ...es.statSub, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span><SemaforoDot color="#ef5350" size={8} /> {pctNivel(resumen.nivel_bajo)}%</span>
                  <span><SemaforoDot color="#ffa726" size={8} /> {pctNivel(resumen.nivel_basico)}%</span>
                  <span><SemaforoDot color="#66bb6a" size={8} /> {pctNivel(resumen.nivel_alto)}%</span>
                  <span><SemaforoDot color="#42a5f5" size={8} /> {pctNivel(resumen.nivel_superior)}%</span>
                </span>
              </div>

              <div style={es.statCard}>
                <IconCalendar size={28} style={{ color: '#667eea' }} />
                <span style={es.statValor}>
                  {asistencia.tasa != null ? `${asistencia.tasa}%` : '—'}
                </span>
                <span style={es.statLabel}>Asistencia (últimos 30 días)</span>
                <span style={es.statSub}>
                  {asistencia.asistieron ?? 0} presentes · {asistencia.ausentes ?? 0} ausentes
                </span>
              </div>

              <div style={es.statCard}>
                <IconBookOpen size={28} style={{ color: '#667eea' }} />
                <span style={es.statValor}>{materias.length}</span>
                <span style={es.statLabel}>Materias con actividad</span>
                <span style={{ ...es.statSub, color: '#c62828' }}>
                  {materias.filter(m => m.promedio < 3).length} por debajo del mínimo
                </span>
              </div>
            </div>

            {/* ── TENDENCIA SEMANAL ── */}
            {tendencia.length > 1 && (
              <div style={es.seccionCard}>
                <h3 style={{ ...es.seccionTitulo, display: 'flex', alignItems: 'center', gap: 6 }}><IconTrendUp size={16} style={{ color: '#667eea' }} />Tendencia semanal</h3>
                <div style={es.barChart}>
                  {tendencia.map((sem, i) => {
                    const col = colorPromedio(sem.promedio);
                    const alturaPct = ((sem.promedio - 1) / 4) * 100;
                    return (
                      <div key={i} style={es.barWrap}>
                        <span style={es.barValor}>{sem.promedio}</span>
                        <div style={es.barFondo}>
                          <div style={{ ...es.barRelleno, height: `${alturaPct}%`, background: col.bg, borderTop: `3px solid ${col.color}` }} />
                        </div>
                        <span style={es.barFecha}>{formatFecha(sem.fecha_inicio)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── RANKINGS ── */}
            <div style={es.dosColumnas}>

              {/* Materias */}
              <div style={es.seccionCard}>
                <h3 style={{ ...es.seccionTitulo, display: 'flex', alignItems: 'center', gap: 6 }}><IconBookOpen size={16} style={{ color: '#667eea' }} />Materias — de mayor a menor riesgo</h3>
                {materias.map((m, i) => {
                  const col = colorPromedio(m.promedio);
                  const barPct = ((m.promedio || 0) / 5) * 100;
                  return (
                    <div key={m.materia_id} style={es.rankFila}>
                      <span style={es.rankPos}><SemaforoDot color={semaforoColor(m.promedio)} size={12} /></span>
                      <div style={es.rankInfo}>
                        <span style={es.rankNombre}>{m.nombre}</span>
                        <div style={es.rankBarra}>
                          <div style={{ ...es.rankBarraRelleno, width: `${barPct}%`, background: col.color }} />
                        </div>
                      </div>
                      <span style={{ ...es.rankValor, color: col.color }}>{m.promedio ?? '—'}</span>
                      <span style={es.rankSub}>{m.tasa_aprobacion ?? 0}% aprob.</span>
                    </div>
                  );
                })}
              </div>

              {/* Docentes */}
              <div style={es.seccionCard}>
                <h3 style={{ ...es.seccionTitulo, display: 'flex', alignItems: 'center', gap: 6 }}><IconUser size={16} style={{ color: '#667eea' }} />Docentes — por impacto académico</h3>
                {docentes.map((d, i) => {
                  const col = colorPromedio(d.promedio);
                  const barPct = ((d.promedio || 0) / 5) * 100;
                  return (
                    <div key={d.docente_id} style={es.rankFila}>
                      <span style={{ ...es.rankPos, fontWeight: 700, color: '#667eea', fontSize: 13 }}>{i + 1}.</span>
                      <div style={es.rankInfo}>
                        <span style={es.rankNombre}>{d.nombre}</span>
                        <div style={es.rankBarra}>
                          <div style={{ ...es.rankBarraRelleno, width: `${barPct}%`, background: col.color }} />
                        </div>
                      </div>
                      <span style={{ ...es.rankValor, color: col.color }}>{d.promedio ?? '—'}</span>
                      <span style={es.rankSub}>{d.total_actividades} activ.</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── MAPA DE CALOR ── */}
            {gruposUnicos.length > 0 && materiasUnicas.length > 0 && (
              <div style={es.seccionCard}>
                <h3 style={{ ...es.seccionTitulo, display: 'flex', alignItems: 'center', gap: 6 }}><IconMap size={16} style={{ color: '#667eea' }} />Mapa de calor — Grupos × Materias</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={es.mapaTabla}>
                    <thead>
                      <tr>
                        <th style={es.mapaTh}>Grupo</th>
                        {materiasUnicas.map(m => (
                          <th key={m.id} style={es.mapaTh}>{m.nombre}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gruposUnicos.map(g => (
                        <tr key={g.id}>
                          <td style={es.mapaTdGrupo}>
                            <SemaforoDot color={semaforoColor(
                              mapaCalor.filter(c => c.grupo_id === g.id).reduce((s, c, _, arr) =>
                                s + c.promedio / arr.length, 0
                              ) || null
                            )} size={10} style={{ marginRight: 5 }} /> Grado {g.grado}° {g.nombre}
                          </td>
                          {materiasUnicas.map(m => {
                            const celda = getCeldaMapa(g.id, m.id);
                            const col = colorPromedio(celda?.promedio ?? null);
                            return (
                              <td key={m.id} style={{ ...es.mapaTd, background: col.bg, color: col.color }}>
                                {celda ? celda.promedio : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={es.leyenda}>
                  <span style={{ color: '#c62828', display: 'flex', alignItems: 'center', gap: 5 }}><SemaforoDot color="#ef5350" size={10} />Bajo (&lt;3.5)</span>
                  <span style={{ color: '#f57f17', display: 'flex', alignItems: 'center', gap: 5 }}><SemaforoDot color="#ffa726" size={10} />Básico (3.5–3.9)</span>
                  <span style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 5 }}><SemaforoDot color="#66bb6a" size={10} />Alto/Superior (≥4.0)</span>
                  <span style={{ color: '#bbb', display: 'flex', alignItems: 'center', gap: 5 }}><SemaforoDot color="#e0e0e0" size={10} />Sin datos</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  encabezado: { marginBottom: '8px' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#333', margin: '4px 0 16px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  filtroRow: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' },
  filtroBtn: { padding: '8px 18px', borderRadius: '20px', border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#666', fontFamily: 'inherit' },
  filtroBtnActivo: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderColor: '#667eea', color: '#fff' },
  errorBox: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' },
  statIcono: { fontSize: '28px' },
  statValor: { fontSize: '34px', fontWeight: '800', color: '#333' },
  statLabel: { fontSize: '12px', color: '#888' },
  statSub: { fontSize: '11px', color: '#aaa', marginTop: '2px' },
  barraDistribucion: { display: 'flex', width: '100%', height: '6px', borderRadius: '4px', overflow: 'hidden', background: '#f0f0f0', marginTop: '4px' },

  seccionCard: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px' },
  seccionTitulo: { fontSize: '15px', fontWeight: '700', color: '#444', margin: '0 0 16px' },

  barChart: { display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px', padding: '0 4px' },
  barWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 },
  barValor: { fontSize: '11px', fontWeight: '700', color: '#555' },
  barFondo: { width: '100%', background: '#f5f5f5', borderRadius: '4px 4px 0 0', height: '80px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barRelleno: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' },
  barFecha: { fontSize: '10px', color: '#999' },

  dosColumnas: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '0' },

  rankFila: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  rankPos: { fontSize: '18px', flexShrink: 0, width: '26px', textAlign: 'center' },
  rankInfo: { flex: 1, minWidth: 0 },
  rankNombre: { fontSize: '13px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rankBarra: { height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' },
  rankBarraRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.3s' },
  rankValor: { fontSize: '16px', fontWeight: '800', flexShrink: 0, width: '36px', textAlign: 'right' },
  rankSub: { fontSize: '11px', color: '#aaa', flexShrink: 0, width: '64px', textAlign: 'right' },

  mapaTabla: { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
  mapaTh: { padding: '8px 12px', fontSize: '12px', fontWeight: '700', color: '#555', background: '#fafafa', borderBottom: '2px solid #f0f0f0', textAlign: 'center', whiteSpace: 'nowrap' },
  mapaTdGrupo: { padding: '10px 14px', fontSize: '13px', fontWeight: '700', color: '#333', whiteSpace: 'nowrap', borderBottom: '1px solid #f5f5f5', background: '#fafafa' },
  mapaTd: { padding: '10px 14px', fontSize: '14px', fontWeight: '800', textAlign: 'center', borderBottom: '1px solid #f5f5f5', borderLeft: '1px solid #f0f0f0' },
  leyenda: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '14px', fontSize: '12px' },
};
