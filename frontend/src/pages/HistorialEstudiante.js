import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBarChart, IconArrowLeft, IconBookOpen, IconTrendUp } from '../components/Icons';
import { FichaMedicaLectura } from '../components/FichaMedica';

const NIVEL_COLOR = { Bajo: '#ef5350', Básico: '#ffa726', Alto: '#66bb6a', Superior: '#42a5f5' };
const NIVEL_BG    = { Bajo: '#ffebee', Básico: '#fff8e1', Alto: '#e8f5e9', Superior: '#e3f2fd' };

function nivelMEN(nota) {
  if (nota === null || nota === undefined) return null;
  if (nota < 3.5) return 'Bajo';
  if (nota < 4.0) return 'Básico';
  if (nota <= 4.5) return 'Alto';
  return 'Superior';
}

function BarraNota({ valor, max = 5 }) {
  const pct = Math.min((valor / max) * 100, 100);
  const nivel = nivelMEN(valor);
  const color = NIVEL_COLOR[nivel] || '#ccc';
  return (
    <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function HistorialEstudiante() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();
  const { id }      = useParams();
  const estudianteId = id || usuario.id;

  const [datos,    setDatos]    = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState('');

  const puedeVerFichaMedica = ['admin', 'docente', 'director', 'padre'].includes(usuario.rol);
  const [mostrarFichaMedica, setMostrarFichaMedica] = useState(false);
  const [fichaMedicaDatos, setFichaMedicaDatos] = useState(null);
  const [cargandoFichaMedica, setCargandoFichaMedica] = useState(false);

  async function toggleFichaMedica() {
    if (mostrarFichaMedica) { setMostrarFichaMedica(false); return; }
    setMostrarFichaMedica(true);
    if (fichaMedicaDatos) return;
    setCargandoFichaMedica(true);
    try {
      const r = await axiosAuth.get(`/api/estudiantes/${estudianteId}/ficha-medica`);
      setFichaMedicaDatos(r.data.data || {});
    } catch {
      setFichaMedicaDatos({});
    } finally {
      setCargandoFichaMedica(false);
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get(`/api/estudiantes/${estudianteId}/historial`);
      setDatos(resp.data.data);
    } catch {
      setError('No se pudo cargar el historial. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [estudianteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const volverRuta = usuario.rol === 'estudiante'
    ? '/dashboard-estudiante'
    : usuario.rol === 'docente'
      ? '/dashboard-docente'
      : '/dashboard-director';

  if (cargando) return (
    <div style={es.pagina}>
      <Navbar titulo="Historial Académico" />
      <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Cargando historial...</div>
    </div>
  );

  if (error || !datos) return (
    <div style={es.pagina}>
      <Navbar titulo="Historial Académico" />
      <div style={{ textAlign: 'center', padding: 60, color: '#c62828' }}>{error || 'Sin datos'}</div>
    </div>
  );

  const { estudiante, grupo, grado, colegio, promedioGlobal, totalActividades, porMateria, porPeriodo, recientes, tendencia } = datos;
  const nivelGlobal = nivelMEN(promedioGlobal);
  const mejorMateria = porMateria.length > 0 ? porMateria[0] : null;
  const peorMateria  = porMateria.length > 1 ? porMateria[porMateria.length - 1] : null;

  // Barra de tendencia: normalizar entre el min y max del período
  const maxTend = Math.max(...tendencia.map(t => parseFloat(t.promedio) || 0), 5);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Historial Académico" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.header}>
          <div>
            <button onClick={() => navigate(volverRuta)} style={es.btnVolver}>
              <IconArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Volver
            </button>
            <h2 style={es.titulo}>{estudiante}</h2>
            <p style={es.subtitulo}>{grado ? `Grado ${grado}° · ` : ''}{grupo} · {colegio}</p>
          </div>
          {puedeVerFichaMedica && (
            <button onClick={toggleFichaMedica} style={es.btnFichaMedica}>
              {mostrarFichaMedica ? 'Ocultar ficha médica' : 'Ver ficha médica'}
            </button>
          )}
        </div>

        {puedeVerFichaMedica && mostrarFichaMedica && (
          <div style={{ ...es.card, marginBottom: 20 }}>
            <h3 style={es.seccion}>Ficha médica</h3>
            {cargandoFichaMedica ? (
              <p style={{ color: '#888', fontSize: 14 }}>Cargando...</p>
            ) : (
              <FichaMedicaLectura datos={fichaMedicaDatos} />
            )}
          </div>
        )}

        {/* KPIs superiores */}
        <div style={es.kpiGrid}>
          <div style={es.kpiCard}>
            <div style={es.kpiValor}>{promedioGlobal ?? '—'}</div>
            <div style={es.kpiLabel}>Promedio general</div>
            {nivelGlobal && (
              <span style={{ ...es.nivelBadge, background: NIVEL_BG[nivelGlobal], color: NIVEL_COLOR[nivelGlobal] }}>
                {nivelGlobal}
              </span>
            )}
          </div>
          <div style={es.kpiCard}>
            <div style={es.kpiValor}>{totalActividades}</div>
            <div style={es.kpiLabel}>Actividades completadas</div>
          </div>
          <div style={es.kpiCard}>
            <div style={es.kpiValor}>{porMateria.length}</div>
            <div style={es.kpiLabel}>Materias evaluadas</div>
          </div>
          {mejorMateria && (
            <div style={{ ...es.kpiCard, borderTop: '4px solid #66bb6a' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#333', marginBottom: 2 }}>Mejor materia</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2e7d32' }}>{mejorMateria.materia}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#2e7d32' }}>{mejorMateria.promedio}</div>
            </div>
          )}
          {peorMateria && (
            <div style={{ ...es.kpiCard, borderTop: '4px solid #ef5350' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#333', marginBottom: 2 }}>A reforzar</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#c62828' }}>{peorMateria.materia}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#c62828' }}>{peorMateria.promedio}</div>
            </div>
          )}
        </div>

        <div style={es.dobleCol}>

          {/* Por materia */}
          <div style={{ flex: 1.4 }}>
            <h3 style={es.seccion}><IconBookOpen size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#667eea' }} />Rendimiento por materia</h3>
            {porMateria.length === 0 ? (
              <div style={es.sinDatos}>Sin actividades calificadas</div>
            ) : (
              <div style={es.card}>
                {porMateria.map((m, i) => {
                  const nivel = nivelMEN(parseFloat(m.promedio));
                  const total = (parseInt(m.bajo) || 0) + (parseInt(m.basico) || 0) + (parseInt(m.alto) || 0) + (parseInt(m.superior) || 0);
                  return (
                    <div key={m.materia_id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: i < porMateria.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{m.materia}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: NIVEL_COLOR[nivel] || '#333' }}>{m.promedio}</span>
                          {nivel && <span style={{ ...es.nivelBadge, background: NIVEL_BG[nivel], color: NIVEL_COLOR[nivel] }}>{nivel}</span>}
                        </div>
                      </div>
                      <BarraNota valor={parseFloat(m.promedio)} />
                      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={es.distChip}>{total} actividades</span>
                        {parseInt(m.bajo) > 0 && <span style={{ ...es.distChip, background: '#ffebee', color: '#c62828' }}>Bajo: {m.bajo}</span>}
                        {parseInt(m.basico) > 0 && <span style={{ ...es.distChip, background: '#fff8e1', color: '#e65100' }}>Básico: {m.basico}</span>}
                        {parseInt(m.alto) > 0 && <span style={{ ...es.distChip, background: '#e8f5e9', color: '#2e7d32' }}>Alto: {m.alto}</span>}
                        {parseInt(m.superior) > 0 && <span style={{ ...es.distChip, background: '#e3f2fd', color: '#1565c0' }}>Superior: {m.superior}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Por período */}
            {porPeriodo.length > 0 && (
              <>
                <h3 style={es.seccion}><IconBarChart size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#667eea' }} />Promedio por período</h3>
                <div style={{ ...es.card, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {porPeriodo.map(p => {
                    const nivel = nivelMEN(parseFloat(p.promedio));
                    return (
                      <div key={p.periodo} style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 }}>PERÍODO {p.periodo}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: NIVEL_COLOR[nivel] || '#333' }}>{p.promedio}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{p.total} actividades</div>
                        {nivel && <span style={{ ...es.nivelBadge, marginTop: 4 }}>{nivel}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ flex: 1, minWidth: 260 }}>

            {/* Tendencia semanal */}
            {tendencia.length > 1 && (
              <>
                <h3 style={es.seccion}><IconTrendUp size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#667eea' }} />Tendencia semanal</h3>
                <div style={es.card}>
                  {tendencia.map((t, i) => {
                    const prom = parseFloat(t.promedio) || 0;
                    const pct  = Math.min((prom / maxTend) * 100, 100);
                    const nivel = nivelMEN(prom);
                    const color = NIVEL_COLOR[nivel] || '#ccc';
                    const fecha = new Date(t.fecha_inicio).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: '#888' }}>{fecha}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{prom}</span>
                        </div>
                        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Actividades recientes */}
            <h3 style={{ ...es.seccion, marginTop: tendencia.length > 1 ? 20 : 0 }}>Actividades recientes</h3>
            {recientes.length === 0 ? (
              <div style={es.sinDatos}>Sin actividades completadas</div>
            ) : (
              <div style={es.card}>
                {recientes.map((r, i) => {
                  const nivel = nivelMEN(parseFloat(r.nota));
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: i < recientes.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      <div style={{ flex: 1, marginRight: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', lineHeight: 1.3 }}>{r.titulo}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{r.materia} · P{r.periodo}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: NIVEL_COLOR[nivel] || '#333' }}>{r.nota}</div>
                        {nivel && <span style={{ ...es.nivelBadge, background: NIVEL_BG[nivel], color: NIVEL_COLOR[nivel] }}>{nivel}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  header:    { marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  btnFichaMedica: { background: '#fff', border: '1px solid #ddd', color: '#555', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, fontFamily: 'inherit', marginBottom: 6, display: 'flex', alignItems: 'center' },
  titulo:    { fontSize: 22, fontWeight: 800, color: '#333', margin: '0 0 4px' },
  subtitulo: { fontSize: 13, color: '#888', margin: 0 },
  kpiGrid:   { display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  kpiCard:   { background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flex: 1, minWidth: 120, borderTop: '4px solid #667eea' },
  kpiValor:  { fontSize: 28, fontWeight: 900, color: '#333', lineHeight: 1 },
  kpiLabel:  { fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 },
  nivelBadge:{ display: 'inline-block', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, marginTop: 4 },
  dobleCol:  { display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' },
  seccion:   { fontSize: 14, fontWeight: 800, color: '#333', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  card:      { background: '#fff', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 },
  sinDatos:  { background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 },
  distChip:  { background: '#f5f5f5', color: '#666', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600 },
};
