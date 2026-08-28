import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconTrendUp, IconInbox, IconArrowLeft } from '../components/Icons';

const ETIQUETA_TIPO = {
  opcion_multiple:    'Opción múltiple',
  verdadero_falso:    'Verdadero / Falso',
  ordenar_pasos:      'Ordenar pasos',
  completar_espacios: 'Completar espacios',
  relacionar_columnas:'Relacionar columnas',
};

function nivelNota(nota) {
  if (nota === null || nota === undefined) return null;
  if (nota < 3) return { texto: 'Bajo', color: '#c62828', bg: '#ffcdd2' };
  if (nota < 4) return { texto: 'Básico', color: '#f57f17', bg: '#fff9c4' };
  if (nota <= 4.5) return { texto: 'Alto', color: '#2e7d32', bg: '#c8e6c9' };
  return { texto: 'Superior', color: '#1565c0', bg: '#bbdefb' };
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '—';
  const d = new Date(fechaStr);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Historial({ actividades }) {
  const completadas = [...actividades]
    .filter(a => a.nota !== null)
    .sort((a, b) => new Date(a.completada_en) - new Date(b.completada_en));

  if (completadas.length === 0) {
    return (
      <div style={es.sinDatos}>
        <IconTrendUp size={40} style={{ color: '#ccc' }} />
        <p>Aún no has completado actividades en esta materia.</p>
        <p style={{ fontSize: '13px', color: '#aaa' }}>Tu historial aparecerá aquí cuando entregues la primera.</p>
      </div>
    );
  }

  const notas    = completadas.map(a => parseFloat(a.nota));
  const promedio = (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(2);
  const mejor    = Math.max(...notas);
  const peor     = Math.min(...notas);
  const tendencia = notas.length >= 2
    ? (notas[notas.length - 1] - notas[0]).toFixed(2)
    : null;

  const nivelProm = nivelNota(parseFloat(promedio));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Stats */}
      <div style={es.statsRow}>
        <div style={es.statBox}>
          <span style={{ fontSize: '22px', fontWeight: '900', color: nivelProm?.color }}>{promedio}</span>
          <span style={es.statLabel}>Promedio</span>
        </div>
        <div style={es.statBox}>
          <span style={{ fontSize: '22px', fontWeight: '900', color: '#27ae60' }}>{mejor.toFixed(1)}</span>
          <span style={es.statLabel}>Mejor nota</span>
        </div>
        <div style={es.statBox}>
          <span style={{ fontSize: '22px', fontWeight: '900', color: '#e74c3c' }}>{peor.toFixed(1)}</span>
          <span style={es.statLabel}>Peor nota</span>
        </div>
        <div style={es.statBox}>
          {tendencia !== null ? (
            <span style={{ fontSize: '22px', fontWeight: '900', color: parseFloat(tendencia) >= 0 ? '#27ae60' : '#e74c3c' }}>
              {parseFloat(tendencia) >= 0 ? '↑' : '↓'} {Math.abs(tendencia)}
            </span>
          ) : <span style={{ fontSize: '22px' }}>—</span>}
          <span style={es.statLabel}>Tendencia</span>
        </div>
        <div style={es.statBox}>
          <span style={{ fontSize: '22px', fontWeight: '900', color: '#667eea' }}>{completadas.length}</span>
          <span style={es.statLabel}>Entregadas</span>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div style={es.graficoCard}>
        <div style={es.graficoTitulo}>Evolución de notas</div>
        <div style={es.grafico}>
          {completadas.map((act, i) => {
            const n     = parseFloat(act.nota);
            const nivel = nivelNota(n);
            const pct   = (n / 5) * 100;
            return (
              <div key={act.id} style={es.barraCol}>
                <div style={es.barraValor}>{n.toFixed(1)}</div>
                <div style={es.barraFondo}>
                  <div style={{ ...es.barraRelleno, height: `${pct}%`, background: nivel?.color || '#667eea' }} />
                </div>
                <div style={es.barraIdx}>{i + 1}</div>
              </div>
            );
          })}
        </div>
        {/* Línea de promedio mínimo aprobatorio */}
        <div style={es.leyendaGrafico}>
          <span style={{ color: '#f57f17', fontSize: '12px' }}>— Mínimo aprobatorio: 3.5</span>
          <span style={{ color: '#888', fontSize: '12px' }}>Cada barra = una actividad entregada</span>
        </div>
      </div>

      {/* Lista cronológica */}
      <div style={es.listaActividades}>
        {completadas.map((act, i) => {
          const nivel = nivelNota(act.nota);
          return (
            <div key={act.id} style={es.historialItem}>
              <div style={es.historialNum}>{i + 1}</div>
              <div style={es.historialInfo}>
                <div style={es.historialTitulo}>{act.titulo}</div>
                <div style={es.historialMeta}>
                  <span style={es.badgeGris}>Período {act.periodo}</span>
                  <span style={es.badgeGris}>{formatFecha(act.completada_en)}</span>
                  <span style={es.badgeGris}>{ETIQUETA_TIPO[act.tipo]}</span>
                </div>
              </div>
              <div style={es.historialNota}>
                <span style={{ fontSize: '22px', fontWeight: '800', color: nivel?.color }}>{act.nota}</span>
                <span style={{ ...es.nivelBadge, background: nivel?.bg, color: nivel?.color }}>{nivel?.texto}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MateriaEstudiante() {
  const { materiaId } = useParams();
  const navigate = useNavigate();
  const [actividades, setActividades] = useState([]);
  const [nombreMateria, setNombreMateria] = useState('');
  const [periodoActivo, setPeriodoActivo] = useState('1');
  const [vista, setVista] = useState('periodo'); // 'periodo' | 'historial'
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const resp = await axiosAuth.get('/api/actividades/estudiante');
        const todas = resp.data.data;
        const deMiMateria = todas.filter(a => String(a.materia_id) === String(materiaId));
        if (deMiMateria.length > 0) setNombreMateria(deMiMateria[0].nombre_materia);
        setActividades(deMiMateria);
      } catch {
        // Silencioso
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [materiaId]);

  const actividadesPeriodo = actividades.filter(a => String(a.periodo) === periodoActivo);

  return (
    <div style={es.pagina}>
      <Navbar titulo={nombreMateria || 'Materia'} />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard-estudiante')} style={es.btnVolver}>
          <IconArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Volver a mis materias
        </button>

        {/* Tabs: períodos + historial */}
        <div style={es.tabs}>
          {['1', '2', '3'].map(p => (
            <button key={p}
              onClick={() => { setVista('periodo'); setPeriodoActivo(p); }}
              style={{ ...es.tab, ...(vista === 'periodo' && periodoActivo === p ? es.tabActivo : {}) }}>
              Periodo {p}
              {(() => {
                const acts = actividades.filter(a => String(a.periodo) === p);
                const comp = acts.filter(a => a.nota !== null).length;
                return acts.length > 0 ? <span style={es.tabBadge}>{comp}/{acts.length}</span> : null;
              })()}
            </button>
          ))}
          <button
            onClick={() => setVista('historial')}
            style={{ ...es.tab, ...(vista === 'historial' ? es.tabHistorialActivo : {}), minWidth: '110px' }}>
            <IconTrendUp size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Historial
          </button>
        </div>

        {/* Contenido según vista */}
        {cargando ? (
          <p style={es.textoGris}>Cargando...</p>
        ) : vista === 'historial' ? (
          <Historial actividades={actividades} />
        ) : actividadesPeriodo.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={40} style={{ color: '#ccc' }} />
            <p>No hay actividades asignadas en el Periodo {periodoActivo}.</p>
          </div>
        ) : (
          <div style={es.listaActividades}>
            {actividadesPeriodo.map(act => {
              const nivel = nivelNota(act.nota);
              const completada = act.nota !== null;
              return (
                <button key={act.id} onClick={() => navigate(`/actividad/${act.id}`)}
                  style={{ ...es.actCard, ...(completada ? es.actCardCompletada : {}) }}>
                  <div style={es.actIzquierda}>
                    <div style={es.actEstado}>
                      {completada
                        ? <span style={es.iconoCheck}>✓</span>
                        : <span style={es.iconoPendiente}>○</span>}
                    </div>
                    <div>
                      <div style={es.actTitulo}>{act.titulo}</div>
                      <div style={es.actMeta}>
                        <span style={es.badge}>{ETIQUETA_TIPO[act.tipo]}</span>
                        <span style={es.badgeGris}>⏱ {act.tiempo_limite_minutos} min</span>
                        <span style={es.badgeGris}>{act.intentos_permitidos} intentos</span>
                      </div>
                    </div>
                  </div>
                  <div style={es.actDerecha}>
                    {completada && nivel ? (
                      <>
                        <span style={{ fontSize: '28px', fontWeight: '800', color: nivel.color }}>{act.nota}</span>
                        <span style={{ ...es.nivelBadge, background: nivel.bg, color: nivel.color }}>{nivel.texto}</span>
                      </>
                    ) : (
                      <span style={es.btnIniciar}>Iniciar →</span>
                    )}
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
  contenido: { padding: '24px', maxWidth: '800px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '24px', padding: 0, fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px' },
  tab: { flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #e0e0e0', background: '#fff', color: '#888', cursor: 'pointer', fontWeight: '600', fontSize: '14px', fontFamily: 'inherit', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' },
  tabActivo: { borderColor: '#667eea', color: '#667eea', background: '#f0f0ff' },
  tabBadge: { background: '#667eea', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '11px' },
  listaActividades: { display: 'flex', flexDirection: 'column', gap: '12px' },
  actCard: {
    background: '#fff', border: '2px solid #e8e8e8', borderRadius: '14px', padding: '18px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  actCardCompletada: { borderColor: '#c8e6c9' },
  actIzquierda: { display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 },
  actEstado: { flexShrink: 0, marginTop: '2px' },
  iconoCheck: { width: '24px', height: '24px', background: '#43e97b', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700' },
  iconoPendiente: { width: '24px', height: '24px', border: '2px solid #ccc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '16px' },
  actTitulo: { fontSize: '15px', fontWeight: '700', color: '#333', marginBottom: '6px' },
  actMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  badge: { background: '#f0f0ff', color: '#667eea', borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' },
  badgeGris: { background: '#f5f5f5', color: '#888', borderRadius: '20px', padding: '2px 8px', fontSize: '12px' },
  actDerecha: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 },
  nivelBadge: { borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' },
  btnIniciar: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabHistorialActivo: { borderColor: '#43e97b', color: '#1b4332', background: '#f0fff6' },

  // Historial
  statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  statBox: {
    flex: '1 1 80px', minWidth: '80px', background: '#fff', borderRadius: '14px',
    padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  statLabel: { fontSize: '11px', color: '#aaa', textAlign: 'center', fontWeight: '600' },

  graficoCard: { background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  graficoTitulo: { fontSize: '14px', fontWeight: '700', color: '#555', marginBottom: '16px' },
  grafico: { display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px', overflowX: 'auto', paddingBottom: '4px' },
  barraCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '36px', flex: '0 0 36px' },
  barraValor: { fontSize: '10px', fontWeight: '700', color: '#555', height: '14px' },
  barraFondo: { width: '100%', background: '#f0f0f0', borderRadius: '6px 6px 0 0', height: '80px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barraRelleno: { width: '100%', borderRadius: '6px 6px 0 0', transition: 'height 0.4s ease' },
  barraIdx: { fontSize: '10px', color: '#bbb' },
  leyendaGrafico: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f0f0f0' },

  historialItem: {
    background: '#fff', borderRadius: '14px', padding: '16px 18px',
    display: 'flex', alignItems: 'center', gap: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  historialNum: { width: '28px', height: '28px', borderRadius: '50%', background: '#f0f0ff', color: '#667eea', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historialInfo: { flex: 1 },
  historialTitulo: { fontSize: '14px', fontWeight: '700', color: '#333', marginBottom: '4px' },
  historialMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  historialNota: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 },
};
