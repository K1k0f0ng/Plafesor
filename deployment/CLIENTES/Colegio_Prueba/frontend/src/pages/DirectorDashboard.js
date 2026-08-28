import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import {
  IconBarChart, IconAlertCircle, IconZap, IconFileText, IconTrendUp,
  IconClipboard, IconSchool, IconBookOpen, IconUser, IconEdit,
  IconAlertTriangle, IconInbox, SemaforoDot,
} from '../components/Icons';

const NIVEL_COLOR = { bajo: '#ffcdd2', basico: '#fff9c4', alto: '#c8e6c9', superior: '#bbdefb' };
const NIVEL_TEXTO = { bajo: '#c62828', basico: '#f57f17', alto: '#2e7d32', superior: '#1565c0' };

function semaforo(promedio) {
  if (promedio === null || promedio === undefined) return { color: '#e0e0e0', dot: 'grey' };
  if (promedio < 3.5) return { color: '#ef5350', dot: '#ef5350' };
  if (promedio < 4.0) return { color: '#ffa726', dot: '#ffa726' };
  return { color: '#66bb6a', dot: '#66bb6a' };
}

function pct(parte, total) {
  if (!total) return '—';
  return `${Math.round((parte / total) * 100)}%`;
}

export default function DirectorDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [periodo, setPeriodo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [alertas, setAlertas] = useState([]);
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const url = periodo
        ? `/api/reportes/colegio/${usuario.colegio_id}/resumen?periodo=${periodo}`
        : `/api/reportes/colegio/${usuario.colegio_id}/resumen`;
      const [respResumen, respAlertas] = await Promise.all([
        axiosAuth.get(url),
        axiosAuth.get(`/api/reportes/alertas/colegio/${usuario.colegio_id}`),
      ]);
      setDatos(respResumen.data.data);
      setAlertas(respAlertas.data.data);
    } catch {
      setError('No se pudo cargar el resumen. Verifica tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id, periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const grupos = datos?.grupos || [];
  const totalResultados = g => (g.nivel_bajo || 0) + (g.nivel_basico || 0) + (g.nivel_alto || 0) + (g.nivel_superior || 0);

  const totalEstudiantes = grupos.reduce((s, g) => s + (g.total_estudiantes || 0), 0);
  const totalActividades = grupos.reduce((s, g) => s + (g.total_actividades || 0), 0);
  const promedioGlobal = (() => {
    const conPromedio = grupos.filter(g => g.promedio !== null);
    if (!conPromedio.length) return null;
    return (conPromedio.reduce((s, g) => s + parseFloat(g.promedio), 0) / conPromedio.length).toFixed(1);
  })();

  const acciones = [
    { label: 'Centro de Métricas',      Icono: IconBarChart,    ruta: '/metricas',      bg: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))' },
    { label: 'Motor de Riesgo',         Icono: IconAlertCircle, ruta: '/riesgo',        bg: 'linear-gradient(135deg, #ef5350, #c62828)' },
    { label: 'Copiloto de Rectoría',    Icono: IconZap,         ruta: '/copiloto',      bg: 'linear-gradient(135deg, #1a237e, #283593)' },
    { label: 'Observador Académico',    Icono: IconFileText,    ruta: '/observador',    bg: 'linear-gradient(135deg, #2e7d32, #1b5e20)' },
    { label: 'Comparativas P1·P2·P3',  Icono: IconTrendUp,     ruta: '/comparativas',  bg: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { label: 'Planes de Mejoramiento',  Icono: IconClipboard,   ruta: '/planes',        bg: 'linear-gradient(135deg, #f7971e, #ffd200)' },
    { label: 'Gemelo Digital',          Icono: IconSchool,      ruta: '/gemelo',        bg: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' },
  ];

  return (
    <div style={es.pagina}>
      <Navbar titulo="Panel Director" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.encabezado}>
          <div>
            <h2 style={es.colegio}>{datos?.colegio || 'Mi Colegio'}</h2>
            <p style={es.bienvenida}>Bienvenido, {usuario.nombre}</p>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={es.accionesGrid}>
          {acciones.map(a => {
            const { Icono } = a;
            return (
              <button key={a.ruta} onClick={() => navigate(a.ruta)} style={{ ...es.btnAccion, background: a.bg }}>
                <Icono size={18} style={{ color: '#fff', opacity: 0.9, flexShrink: 0 }} />
                <span>{a.label} →</span>
              </button>
            );
          })}
        </div>

        {/* Filtro por período */}
        <div style={es.filtroRow}>
          {['', '1', '2', '3'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{ ...es.filtroBton, ...(periodo === p ? es.filtroBtonActivo : {}) }}
            >
              {p === '' ? 'Todos los períodos' : `Período ${p}`}
            </button>
          ))}
        </div>

        {/* Resumen global */}
        <div style={es.statsGrid}>
          {[
            { label: 'Grupos activos',      valor: grupos.length,        Icono: IconBookOpen, color: 'var(--color-primario)' },
            { label: 'Estudiantes totales', valor: totalEstudiantes,     Icono: IconUser,     color: 'var(--color-secundario)' },
            { label: 'Actividades',         valor: totalActividades,     Icono: IconEdit,     color: '#f093fb' },
            { label: 'Promedio colegio',    valor: promedioGlobal ?? '—', dot: semaforo(promedioGlobal).dot },
          ].map(s => (
            <div key={s.label} style={es.statCard}>
              {s.Icono
                ? <s.Icono size={26} style={{ color: s.color }} />
                : <SemaforoDot color={s.dot} size={18} />
              }
              <span style={{ ...es.statValor, color: s.Icono ? s.color : semaforo(promedioGlobal).color }}>{cargando ? '...' : s.valor}</span>
              <span style={es.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div style={es.error}>{error}</div>}

        {/* Tabla de grupos */}
        {!cargando && !error && (
          grupos.length === 0 ? (
            <div style={es.sinDatos}>
              <IconInbox size={40} style={{ color: '#ccc' }} />
              <p>No hay grupos registrados en este colegio aún.</p>
            </div>
          ) : (
            <div style={es.tablaWrap}>
              <table style={es.tabla}>
                <thead>
                  <tr>
                    <th style={es.th}></th>
                    <th style={es.th}>Grupo</th>
                    <th style={es.th}>Grado</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Alumnos</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Actividades</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Promedio</th>
                    <th style={{ ...es.th, textAlign: 'center', background: NIVEL_COLOR.bajo }}>
                      <span style={{ color: NIVEL_TEXTO.bajo }}>Bajo</span>
                    </th>
                    <th style={{ ...es.th, textAlign: 'center', background: NIVEL_COLOR.basico }}>
                      <span style={{ color: NIVEL_TEXTO.basico }}>Básico</span>
                    </th>
                    <th style={{ ...es.th, textAlign: 'center', background: NIVEL_COLOR.alto }}>
                      <span style={{ color: NIVEL_TEXTO.alto }}>Alto</span>
                    </th>
                    <th style={{ ...es.th, textAlign: 'center', background: NIVEL_COLOR.superior }}>
                      <span style={{ color: NIVEL_TEXTO.superior }}>Superior</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => {
                    const sem = semaforo(g.promedio);
                    const total = totalResultados(g);
                    return (
                      <tr key={g.grupo_id} style={es.tr}>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <SemaforoDot color={sem.dot} size={10} />
                        </td>
                        <td style={{ ...es.td, fontWeight: '700' }}>{g.nombre_grupo}</td>
                        <td style={es.td}>Grado {g.grado}°</td>
                        <td style={{ ...es.td, textAlign: 'center' }}>{g.total_estudiantes}</td>
                        <td style={{ ...es.td, textAlign: 'center' }}>{g.total_actividades}</td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          {g.promedio !== null ? (
                            <span style={{ fontWeight: '800', fontSize: '16px', color: sem.color }}>
                              {g.promedio}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <span style={es.nivelChip(NIVEL_COLOR.bajo, NIVEL_TEXTO.bajo)}>
                            {pct(g.nivel_bajo, total)}
                          </span>
                        </td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <span style={es.nivelChip(NIVEL_COLOR.basico, NIVEL_TEXTO.basico)}>
                            {pct(g.nivel_basico, total)}
                          </span>
                        </td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <span style={es.nivelChip(NIVEL_COLOR.alto, NIVEL_TEXTO.alto)}>
                            {pct(g.nivel_alto, total)}
                          </span>
                        </td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <span style={es.nivelChip(NIVEL_COLOR.superior, NIVEL_TEXTO.superior)}>
                            {pct(g.nivel_superior, total)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Panel de alertas */}
        {!cargando && alertas.length > 0 && (
          <div style={es.alertaBanner}>
            <button onClick={() => setAlertasAbiertas(a => !a)} style={es.alertaEncabezado}>
              <IconAlertTriangle size={18} style={{ color: '#f57f17', flexShrink: 0 }} />
              <span style={es.alertaTexto}>
                <strong>{alertas.length} {alertas.length === 1 ? 'estudiante en riesgo' : 'estudiantes en riesgo'}</strong>
                <span> — nota menor a 3.5 en 2 o más actividades de la misma materia</span>
              </span>
              <span style={{ fontSize: '12px', color: '#f57f17', fontWeight: '700' }}>{alertasAbiertas ? '▲' : '▼'}</span>
            </button>
            {alertasAbiertas && (
              <div style={es.alertaLista}>
                <div style={es.alertaGridHeader}>
                  <span>Estudiante</span><span>Materia</span><span>Grupo</span>
                  <span style={{ textAlign: 'center' }}>Actividades bajo 3.5</span>
                  <span style={{ textAlign: 'center' }}>Peor nota</span>
                </div>
                {alertas.map((a, i) => (
                  <div key={i} style={{ ...es.alertaGridFila, background: i % 2 === 0 ? '#fff' : '#fffde7' }}>
                    <span style={{ fontWeight: '700', color: '#333' }}>{a.nombre_estudiante}</span>
                    <span style={{ color: '#555' }}>{a.nombre_materia}</span>
                    <span style={{ color: '#888' }}>Grado {a.grado}° {a.nombre_grupo}</span>
                    <span style={{ textAlign: 'center' }}>
                      <span style={es.alertaBadge}>{a.actividades_bajo}</span>
                    </span>
                    <span style={{ textAlign: 'center', fontWeight: '700', color: '#c62828' }}>{a.peor_nota}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leyenda */}
        <div style={es.leyenda}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SemaforoDot color="#ef5350" size={10} /> Promedio &lt; 3.5 — Bajo</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SemaforoDot color="#ffa726" size={10} /> Promedio 3.5–3.9 — Básico</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SemaforoDot color="#66bb6a" size={10} /> Promedio ≥ 4.0 — Alto / Superior</span>
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '28px 24px', maxWidth: '1200px', margin: '0 auto' },
  encabezado: { marginBottom: '24px' },
  colegio: { fontSize: '22px', fontWeight: '800', color: '#333', margin: 0 },
  bienvenida: { fontSize: '14px', color: '#888', margin: '4px 0 0' },
  filtroRow: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' },
  filtroBton: {
    padding: '8px 18px', borderRadius: '20px', border: '2px solid #e0e0e0',
    background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    color: '#666', fontFamily: 'inherit',
  },
  filtroBtonActivo: {
    background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))',
    borderColor: 'var(--color-primario)', color: '#fff',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '16px', marginBottom: '28px' },
  statCard: {
    background: '#fff', borderRadius: '16px', padding: '20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  statValor: { fontSize: '32px', fontWeight: '800' },
  statLabel: { fontSize: '12px', color: '#888', textAlign: 'center' },
  error: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  tablaWrap: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflowX: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '780px' },
  th: {
    padding: '12px 14px', fontSize: '12px', fontWeight: '700', color: '#555',
    borderBottom: '2px solid #f0f0f0', textAlign: 'left', background: '#fafafa',
  },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '12px 14px', fontSize: '14px', color: '#333' },
  nivelChip: (bg, color) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '700', background: bg, color,
  }),
  accionesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' },
  btnAccion: {
    color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 20px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10,
  },
  leyenda: {
    display: 'flex', gap: '24px', flexWrap: 'wrap',
    marginTop: '20px', fontSize: '12px', color: '#888', alignItems: 'center',
  },
  alertaBanner: { background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '12px', marginTop: '24px', overflow: 'hidden' },
  alertaEncabezado: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  alertaTexto: { flex: 1, fontSize: '14px', color: '#e65100' },
  alertaLista: { borderTop: '1px solid #ffe0b2', overflowX: 'auto' },
  alertaGridHeader: {
    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    padding: '8px 18px', fontSize: '12px', fontWeight: '700', color: '#888',
    background: '#fff8e1', gap: '8px',
  },
  alertaGridFila: {
    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    padding: '10px 18px', fontSize: '13px', gap: '8px', alignItems: 'center',
  },
  alertaBadge: { background: '#ffccbc', color: '#bf360c', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' },
};
