import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutDirector from '../components/LayoutDirector';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { formatearApellidoPrimero } from '../utils/ordenNombre';
import {
  IconBarChart, IconAlertCircle, IconZap, IconFileText, IconTrendUp,
  IconClipboard, IconSchool, IconBookOpen, IconUser, IconEdit,
  IconAlertTriangle, IconInbox, SemaforoDot, IconAccessibility,
  IconBot, IconRefresh, IconStar, IconCalendar,
} from '../components/Icons';

const ROL_ETIQUETA = {
  admin:      'Administrador',
  director:   'Director del Colegio',
  docente:    'Docente',
  estudiante: 'Estudiante',
  padre:      'Acudiente',
};

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

/* Nivel MEN a partir del promedio (misma escala que el resumen del colegio) */
function nivelMen(promedio) {
  if (promedio === null || promedio === undefined || promedio === '') return 'Sin datos';
  const p = parseFloat(promedio);
  if (Number.isNaN(p)) return 'Sin datos';
  if (p < 3.5) return 'Bajo';
  if (p < 4.0) return 'Básico';
  if (p <= 4.5) return 'Alto';
  return 'Superior';
}

function fechaLargaHoy() {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* Texto y color de un comparativo real contra el mes anterior. Si no hay
   histórico todavía (colegio nuevo o primer mes usando la función), no se
   inventa nada: el llamador cae de vuelta a la nota descriptiva de siempre. */
function notaComparativo(delta, { positivoEsBueno = true } = {}) {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) return { texto: 'Sin cambios vs. mes anterior', color: '#6b7280' };
  const esBueno = positivoEsBueno ? delta > 0 : delta < 0;
  const flecha = delta > 0 ? '↑' : '↓';
  return {
    texto: `${flecha} ${Math.abs(delta)} vs. mes anterior`,
    color: esBueno ? '#16a34a' : '#dc2626',
  };
}

function horaCorta(fecha) {
  if (!fecha) return '—';
  return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/* Acceso rápido en tarjeta de color, con conteo cuando aplica */
function TarjetaAccion({ accion, onClick }) {
  const { Icono } = accion;
  return (
    <button onClick={onClick} style={{ ...es.btnAccion, background: accion.bg }}>
      <span style={es.btnAccionIcono}>
        <Icono size={17} style={{ color: '#fff' }} />
      </span>
      <span style={es.btnAccionTexto}>
        <span style={es.btnAccionLabel}>{accion.label} →</span>
        <span style={es.btnAccionDesc}>{accion.desc}</span>
      </span>
      {accion.badge > 0 && (
        <span style={es.btnAccionBadge}>{accion.badge > 9 ? '9+' : accion.badge}</span>
      )}
    </button>
  );
}

/* Curva de apoyo de cada tarjeta: la serie real por grupo, no un adorno */
function Sparkline({ serie, color }) {
  const datos = (serie && serie.length > 1) ? serie.map(v => Number(v) || 0) : [0, 0];
  const max = Math.max(...datos);
  const min = Math.min(...datos);
  const rango = (max - min) || 1;
  const paso = 100 / (datos.length - 1);
  const linea = datos
    .map((v, i) => `${(i * paso).toFixed(2)},${(28 - ((v - min) / rango) * 24).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      style={{ width: '72px', height: '34px', flexShrink: 0 }}
      aria-hidden="true"
    >
      <polygon points={`0,32 ${linea} 100,32`} fill={color} opacity="0.12" />
      <polyline
        points={linea}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
  const [briefing, setBriefing] = useState(null);
  const [cargandoBriefing, setCargandoBriefing] = useState(true);
  const [actualizandoBriefing, setActualizandoBriefing] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

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
      setUltimaActualizacion(new Date());
    } catch {
      setError('No se pudo cargar el resumen. Verifica tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id, periodo]);

  const cargarBriefing = useCallback(async (forzar = false) => {
    if (forzar) setActualizandoBriefing(true); else setCargandoBriefing(true);
    try {
      const url = `/api/briefing/colegio/${usuario.colegio_id}${forzar ? '?forzar=1' : ''}`;
      const resp = await axiosAuth.get(url);
      setBriefing(resp.data.data);
    } catch {
      setBriefing(null);
    } finally {
      setCargandoBriefing(false);
      setActualizandoBriefing(false);
    }
  }, [usuario.colegio_id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarBriefing(); }, [cargarBriefing]);

  const grupos = datos?.grupos || [];
  const totalResultados = g => (g.nivel_bajo || 0) + (g.nivel_basico || 0) + (g.nivel_alto || 0) + (g.nivel_superior || 0);

  const totalEstudiantes = grupos.reduce((s, g) => s + (g.total_estudiantes || 0), 0);
  const totalActividades = grupos.reduce((s, g) => s + (g.total_actividades || 0), 0);
  const estudiantesEnRiesgo = new Set(alertas.map(a => a.estudiante_id)).size;
  const promedioGlobal = (() => {
    const conPromedio = grupos.filter(g => g.promedio !== null);
    if (!conPromedio.length) return null;
    return (conPromedio.reduce((s, g) => s + parseFloat(g.promedio), 0) / conPromedio.length).toFixed(1);
  })();

  const gradosUnicos = new Set(grupos.map(g => g.grado)).size;
  const promedioPorGrupo = grupos.length ? Math.round(totalEstudiantes / grupos.length) : 0;
  const actividadesPorGrupo = grupos.length ? Math.round(totalActividades / grupos.length) : 0;

  // Comparativo real contra el mes anterior (null hasta el segundo mes de uso)
  const cmp = datos?.comparativoMesAnterior;
  const cmpGrupos      = cmp ? notaComparativo(cmp.grupos) : null;
  const cmpEstudiantes = cmp ? notaComparativo(cmp.estudiantes) : null;
  const cmpActividades = cmp ? notaComparativo(cmp.actividades) : null;
  const cmpPromedio    = cmp ? notaComparativo(cmp.promedio) : null;

  /* Cada tarjeta lleva como curva la serie real de sus grupos, no un adorno */
  const stats = [
    {
      label: 'Grupos activos', valor: grupos.length, Icono: IconBookOpen, color: '#3b82f6',
      nota: cmpGrupos?.texto || `${gradosUnicos} ${gradosUnicos === 1 ? 'grado' : 'grados'} en total`,
      notaColor: cmpGrupos?.color || '#16a34a',
      serie: grupos.map(g => g.total_estudiantes),
    },
    {
      label: 'Estudiantes totales', valor: totalEstudiantes, Icono: IconUser, color: '#8b5cf6',
      nota: cmpEstudiantes?.texto || `Promedio de ${promedioPorGrupo} por grupo`,
      notaColor: cmpEstudiantes?.color || '#16a34a',
      serie: grupos.map(g => g.total_estudiantes),
    },
    {
      label: 'Actividades', valor: totalActividades, Icono: IconEdit, color: '#ec4899',
      nota: cmpActividades?.texto || `${actividadesPorGrupo} por grupo en promedio`,
      notaColor: cmpActividades?.color || '#16a34a',
      serie: grupos.map(g => g.total_actividades),
    },
    {
      label: 'Promedio colegio', valor: promedioGlobal ?? '—', Icono: IconStar, color: '#f59e0b',
      nota: cmpPromedio?.texto || `Escala MEN: ${nivelMen(promedioGlobal)}`,
      notaColor: cmpPromedio?.color || '#16a34a',
      serie: grupos.map(g => g.promedio),
    },
  ];

  const acciones = [
    { label: 'Centro de Métricas',        desc: 'Vista general del rendimiento', Icono: IconBarChart,      ruta: '/metricas',     bg: 'linear-gradient(135deg, #8b7cf6, #6d28d9)' },
    { label: 'Motor de Riesgo',           desc: 'Estudiantes en alerta',         Icono: IconAlertCircle,   ruta: '/riesgo',       bg: 'linear-gradient(135deg, #f0645c, #c62828)', badge: estudiantesEnRiesgo },
    { label: 'Copiloto de Rectoría',      desc: 'Decisiones con IA',             Icono: IconZap,           ruta: '/copiloto',     bg: 'linear-gradient(135deg, #2f6df6, #1e40af)' },
    { label: 'Observador Académico',      desc: 'Genera y gestiona informes',    Icono: IconFileText,      ruta: '/observador',   bg: 'linear-gradient(135deg, #2f9e44, #1b5e20)' },
    { label: 'Comparativas P1·P2·P3',     desc: 'Rendimiento por período',       Icono: IconTrendUp,       ruta: '/comparativas', bg: 'linear-gradient(135deg, #f472b6, #db2777)' },
    { label: 'Planes de Mejoramiento',    desc: 'Seguimiento y progreso',        Icono: IconClipboard,     ruta: '/planes',       bg: 'linear-gradient(135deg, #f59f0b, #d97706)', ancho: true },
    { label: 'PIAR (Ajustes Razonables)', desc: 'Inclusión educativa',           Icono: IconAccessibility, ruta: '/piar',         bg: 'linear-gradient(135deg, #14b8a6, #0f766e)', ancho: true },
    { label: 'Gemelo Digital',            desc: 'Simula y proyecta',             Icono: IconSchool,        ruta: '/gemelo',       bg: 'linear-gradient(135deg, #1e293b, #0f172a)', ancho: true },
  ];

  return (
    <LayoutDirector colegio={datos?.colegio}>

      {/* Encabezado */}
      <div style={es.encabezado}>
        <div>
          <h1 style={es.saludoNombre}>{usuario.nombre}</h1>
          <p style={es.saludoRol}>Bienvenido, {ROL_ETIQUETA[usuario.rol] || usuario.rol}</p>
        </div>
        <div style={es.fechaBloque}>
          <IconCalendar size={18} style={{ color: '#7b8598', flexShrink: 0 }} />
          <div>
            <span style={es.fecha}>{fechaLargaHoy()}</span>
            <span style={es.actualizado}>
              Última actualización: {cargando ? 'cargando…' : horaCorta(ultimaActualizacion)}
            </span>
          </div>
        </div>
      </div>

      {/* Aviso del motor de riesgo + resumen ejecutivo del día */}
      <div style={es.banner}>
        <div style={es.bannerOnda} aria-hidden="true">
          <svg viewBox="0 0 240 90" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <polyline points="0,68 30,46 60,58 90,26 120,44 150,16 180,34 210,10 240,26" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            <polyline points="0,80 30,64 60,74 90,48 120,60 150,38 180,52 210,30 240,44" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          </svg>
        </div>

        <span style={es.bannerIcono}>
          <IconBot size={20} style={{ color: '#fff' }} />
        </span>

        <div style={es.bannerTexto}>
          <strong style={es.bannerTitulo}>
            {estudiantesEnRiesgo > 0
              ? `Playfesor ha identificado ${estudiantesEnRiesgo} ${estudiantesEnRiesgo === 1 ? 'estudiante' : 'estudiantes'} con posible riesgo académico`
              : 'El motor de riesgo no reporta estudiantes en alerta'}
          </strong>
          <span style={es.bannerSub}>
            {cargandoBriefing
              ? 'Preparando el resumen del día…'
              : (briefing?.texto || 'Revise al detalle en el Motor de Riesgo o consulte el informe completo.')}
          </span>
        </div>

        <button onClick={() => navigate('/riesgo')} style={es.bannerBtn}>Ver estudiantes →</button>

        <button
          onClick={() => cargarBriefing(true)}
          disabled={actualizandoBriefing || cargandoBriefing}
          style={{ ...es.bannerRefresh, opacity: (actualizandoBriefing || cargandoBriefing) ? 0.5 : 1 }}
          title="Actualizar resumen"
        >
          <IconRefresh size={14} style={{ color: '#fff' }} />
        </button>
      </div>

      {/* Accesos rápidos */}
      <div style={es.accionesGrid}>
        {acciones.filter(a => !a.ancho).map(a => (
          <TarjetaAccion key={a.ruta} accion={a} onClick={() => navigate(a.ruta)} />
        ))}
      </div>
      <div style={es.accionesGridAncho}>
        {acciones.filter(a => a.ancho).map(a => (
          <TarjetaAccion key={a.ruta} accion={a} onClick={() => navigate(a.ruta)} />
        ))}
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
        {stats.map(s => {
          const { Icono } = s;
          return (
            <div key={s.label} style={es.statCard}>
              <span style={{ ...es.statIconoWrap, background: `${s.color}1a`, color: s.color }}>
                <Icono size={20} />
              </span>
              <div style={es.statContenido}>
                <span style={{ ...es.statValor, color: s.color }}>{cargando ? '···' : s.valor}</span>
                <span style={es.statLabel}>{s.label}</span>
                <span style={{ ...es.statNota, color: s.notaColor }}>{cargando ? '' : s.nota}</span>
              </div>
              <Sparkline serie={s.serie} color={s.color} />
            </div>
          );
        })}
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
            <div style={es.tablaCard}>
              <div style={es.tablaCardHead}>
                <h3 style={es.tablaTitulo}>Rendimiento por grupo</h3>
                <button onClick={() => navigate('/metricas')} style={es.tablaLink}>
                  Ver todos los grupos →
                </button>
              </div>
              <div style={es.tablaScroll}>
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
            </div>
          )
        )}

        {/* Panel de alertas */}
        {!cargando && alertas.length > 0 && (
          <div style={es.alertaBanner}>
            <button onClick={() => setAlertasAbiertas(a => !a)} style={es.alertaEncabezado}>
              <IconAlertTriangle size={18} style={{ color: '#f57f17', flexShrink: 0 }} />
              <span style={es.alertaTexto}>
                <strong>{estudiantesEnRiesgo} {estudiantesEnRiesgo === 1 ? 'estudiante en riesgo' : 'estudiantes en riesgo'}</strong>
                <span> — nota menor a 3.5 en 2 o más actividades de la misma materia ({alertas.length} {alertas.length === 1 ? 'caso' : 'casos'})</span>
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
                  <div key={i} style={{ ...es.alertaGridFila, background: i % 2 === 0 ? '#fff' : '#fffaf3' }}>
                    <span style={{ fontWeight: '700', color: '#333' }}>{formatearApellidoPrimero(a.nombre_estudiante)}</span>
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
    </LayoutDirector>
  );
}

const es = {
  encabezado: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: '20px', flexWrap: 'wrap', marginBottom: '22px',
  },
  saludoNombre: { fontSize: '30px', fontWeight: '800', color: '#111827', margin: 0, letterSpacing: '-0.6px' },
  saludoRol: { fontSize: '15px', color: '#6b7280', margin: '4px 0 0' },
  fechaBloque: { display: 'flex', alignItems: 'center', gap: '10px' },
  fecha: { display: 'block', fontSize: '14px', fontWeight: '700', color: '#374151' },
  actualizado: { display: 'block', fontSize: '12px', color: '#9ca3af', marginTop: '2px' },

  /* Aviso de riesgo + resumen del día */
  banner: {
    position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', gap: '16px',
    background: 'linear-gradient(115deg, #1e3a8a 0%, #2554c7 48%, #3b82f6 100%)',
    borderRadius: '16px', padding: '20px 22px', marginBottom: '22px',
    boxShadow: '0 10px 30px rgba(30,58,138,0.22)',
  },
  bannerOnda: { position: 'absolute', right: '180px', top: 0, bottom: 0, width: '230px', opacity: 0.55, pointerEvents: 'none' },
  bannerIcono: {
    position: 'relative', width: '42px', height: '42px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.16)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bannerTexto: { position: 'relative', flex: 1, minWidth: 0 },
  bannerTitulo: { display: 'block', color: '#fff', fontSize: '16px', fontWeight: '800', lineHeight: 1.35 },
  bannerSub: { display: 'block', color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '4px', lineHeight: 1.5 },
  bannerBtn: {
    position: 'relative', flexShrink: 0, background: 'rgba(255,255,255,0.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.45)', borderRadius: '999px', padding: '10px 20px',
    fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
  },
  bannerRefresh: {
    position: 'relative', flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
    border: 'none', background: 'rgba(255,255,255,0.16)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  filtroRow: { display: 'flex', gap: '9px', marginBottom: '20px', flexWrap: 'wrap' },
  filtroBton: {
    padding: '9px 20px', borderRadius: '999px', border: '1px solid #e2e6ef',
    background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    color: '#4b5563', fontFamily: 'inherit',
  },
  filtroBtonActivo: {
    background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
    borderColor: 'transparent', color: '#fff',
  },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '26px' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '14px',
    background: '#fff', borderRadius: '16px', padding: '18px 20px',
    border: '1px solid #eef1f7', boxShadow: '0 2px 12px rgba(20,30,70,0.06)',
  },
  statIconoWrap: {
    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statContenido: { flex: 1, minWidth: 0 },
  statValor: { display: 'block', fontSize: '26px', fontWeight: '800', color: '#111827', lineHeight: 1.1 },
  statLabel: { display: 'block', fontSize: '12.5px', color: '#6b7280', marginTop: '2px' },
  statNota: { display: 'block', fontSize: '11px', color: '#16a34a', marginTop: '6px' },

  error: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(20,30,70,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  tablaCard: {
    background: '#fff', borderRadius: '16px', border: '1px solid #eef1f7',
    boxShadow: '0 2px 12px rgba(20,30,70,0.06)', marginBottom: '22px', overflow: 'hidden',
  },
  tablaCardHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '14px', padding: '16px 20px', borderBottom: '1px solid #f1f4f9',
  },
  tablaTitulo: { margin: 0, fontSize: '15px', fontWeight: '800', color: '#111827' },
  tablaLink: {
    background: 'none', border: 'none', padding: 0, fontSize: '12.5px', fontWeight: '700',
    color: '#4f46e5', cursor: 'pointer', fontFamily: 'inherit',
  },
  tablaScroll: { overflowX: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '820px' },
  th: {
    padding: '11px 14px', fontSize: '11.5px', fontWeight: '700', color: '#6b7280',
    borderBottom: '1px solid #eef1f7', textAlign: 'left', background: '#fafbfe',
  },
  tr: { borderBottom: '1px solid #f5f7fb' },
  td: { padding: '12px 14px', fontSize: '13.5px', color: '#374151' },
  nivelChip: (bg, color) => ({
    display: 'inline-block', minWidth: '54px', padding: '4px 10px', borderRadius: '7px',
    fontSize: '12px', fontWeight: '700', background: bg, color, textAlign: 'center',
  }),

  accionesGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px', marginBottom: '12px' },
  accionesGridAncho: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '26px' },
  btnAccion: {
    position: 'relative', display: 'flex', alignItems: 'center', gap: '10px',
    color: '#fff', border: 'none', borderRadius: '14px', padding: '16px',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minHeight: '76px',
    boxShadow: '0 6px 16px rgba(20,30,70,0.10)',
  },
  btnAccionIcono: {
    width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  btnAccionTexto: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  btnAccionLabel: { fontSize: '13.5px', fontWeight: '800', lineHeight: 1.25 },
  btnAccionDesc: { fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 },
  btnAccionBadge: {
    position: 'absolute', top: '12px', right: '12px', minWidth: '22px', height: '22px',
    borderRadius: '999px', background: '#fff', color: '#dc2626', fontSize: '11.5px',
    fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
  },
  leyenda: {
    display: 'flex', gap: '24px', flexWrap: 'wrap',
    marginTop: '4px', fontSize: '12px', color: '#7b8598', alignItems: 'center',
  },
  alertaBanner: {
    background: '#fff', border: '1px solid #ffe3c2', borderRadius: '16px',
    marginBottom: '22px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(20,30,70,0.06)',
  },
  alertaEncabezado: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  alertaTexto: { flex: 1, fontSize: '13.5px', color: '#b45309' },
  alertaLista: { borderTop: '1px solid #ffe9d1', overflowX: 'auto' },
  alertaGridHeader: {
    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    padding: '9px 18px', fontSize: '11.5px', fontWeight: '700', color: '#a2855f',
    background: '#fff9f0', gap: '8px',
  },
  alertaGridFila: {
    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
    padding: '10px 18px', fontSize: '13px', gap: '8px', alignItems: 'center',
  },
  alertaBadge: { background: '#ffe0cc', color: '#bf360c', borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' },
};
