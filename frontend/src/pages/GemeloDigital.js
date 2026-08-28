import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconArrowLeft, IconRefresh, IconSchool } from '../components/Icons';

const ESTADO = {
  saludable: { color: '#2e7d32', bg: '#e8f5e9', label: 'Saludable', borde: '#81c784' },
  atencion:  { color: '#e65100', bg: '#fff3e0', label: 'Atención',   borde: '#ffb74d' },
  critico:   { color: '#c62828', bg: '#ffebee', label: 'Crítico',    borde: '#ef9a9a' },
};

const TENDENCIA = {
  subiendo: { icono: '↑', color: '#2e7d32', texto: 'Subiendo' },
  estable:  { icono: '→', color: '#666',    texto: 'Estable'  },
  bajando:  { icono: '↓', color: '#c62828', texto: 'Bajando'  },
};

function GaugePuntuacion({ valor, estado }) {
  const color = ESTADO[estado]?.color || '#666';
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (valor / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e8e8" strokeWidth="12" />
        <circle
          cx="60" cy="60" r="52"
          fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>/ 100</div>
      </div>
    </div>
  );
}

function BarraMEN({ label, pct, cantidad, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>{label}</span>
        <span style={{ fontSize: 13, color: '#888' }}>{pct}% ({cantidad})</span>
      </div>
      <div style={{ height: 10, background: '#f0f0f0', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export default function GemeloDigital() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get(`/api/reportes/colegio/${usuario.colegio_id}/gemelo`);
      setDatos(resp.data.data);
    } catch {
      setError('No se pudo cargar el Gemelo Digital. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Gemelo Digital" />
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Cargando estado del colegio...</div>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Gemelo Digital" />
        <div style={{ textAlign: 'center', padding: 60, color: '#c62828' }}>{error || 'Sin datos'}</div>
      </div>
    );
  }

  const estadoInfo  = ESTADO[datos.estado]    || ESTADO.atencion;
  const tendInfo    = TENDENCIA[datos.tendencia] || TENDENCIA.estable;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Gemelo Digital" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.header}>
          <div>
            <button onClick={() => navigate('/dashboard-director')} style={es.btnVolver}>
            <IconArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Volver
          </button>
            <h2 style={es.titulo}><IconSchool size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#667eea' }} />Gemelo Digital del Colegio</h2>
            <p style={es.subtitulo}>{datos.colegio} — Vista en tiempo real</p>
          </div>
          <button onClick={cargar} style={es.btnRefresh}>
            <IconRefresh size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Actualizar
          </button>
        </div>

        {/* Salud general */}
        <div style={{ ...es.card, borderLeft: `6px solid ${estadoInfo.borde}`, marginBottom: 20 }}>
          <div style={es.saludGrid}>
            {/* Gauge */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Salud Académica</div>
              <GaugePuntuacion valor={datos.puntuacion} estado={datos.estado} />
              <div style={{ ...es.estadoBadge, background: estadoInfo.bg, color: estadoInfo.color, borderColor: estadoInfo.borde, marginTop: 12 }}>
                {estadoInfo.label}
              </div>
            </div>

            {/* KPIs */}
            <div style={es.kpiGrid}>
              <div style={es.kpi}>
                <div style={es.kpiValor}>{datos.promedioInstitucional?.toFixed(1) ?? '—'}</div>
                <div style={es.kpiLabel}>Promedio institucional</div>
              </div>
              <div style={es.kpi}>
                <div style={{ ...es.kpiValor, color: tendInfo.color }}>{tendInfo.icono} {tendInfo.texto}</div>
                <div style={es.kpiLabel}>Tendencia semanal</div>
              </div>
              <div style={es.kpi}>
                <div style={es.kpiValor}>{datos.totalEstudiantes}</div>
                <div style={es.kpiLabel}>Estudiantes activos</div>
              </div>
              <div style={es.kpi}>
                <div style={{ ...es.kpiValor, color: datos.tasaAsistencia !== null && datos.tasaAsistencia < 85 ? '#c62828' : '#333' }}>
                  {datos.tasaAsistencia !== null ? `${datos.tasaAsistencia}%` : '—'}
                </div>
                <div style={es.kpiLabel}>Asistencia (30 días)</div>
              </div>
              <div style={es.kpi}>
                <div style={{ ...es.kpiValor, color: datos.riesgo.critico > 0 ? '#c62828' : '#333' }}>
                  {datos.riesgo.totalEnRiesgo}
                </div>
                <div style={es.kpiLabel}>En riesgo alto/crítico</div>
              </div>
              <div style={es.kpi}>
                <div style={es.kpiValor}>{datos.planesActivos}</div>
                <div style={es.kpiLabel}>Planes activos</div>
              </div>
            </div>
          </div>
        </div>

        <div style={es.dobleColumna}>

          {/* Mapa de grados */}
          <div style={{ flex: 1.5 }}>
            <h3 style={es.seccionTitulo}>Mapa de Grados</h3>
            {datos.grados.length === 0 ? (
              <div style={es.sinDatos}>Sin grupos registrados</div>
            ) : (
              datos.grados.map(({ grado, grupos }) => (
                <div key={grado} style={es.gradoBloque}>
                  <div style={es.gradoHeader}>Grado {grado}°</div>
                  <div style={es.gruposGrid}>
                    {grupos.map(g => {
                      const ei = ESTADO[g.estado] || ESTADO.critico;
                      return (
                        <div key={g.grupo_id} style={{ ...es.grupoCard, borderColor: ei.borde, background: ei.bg }}>
                          <div style={es.grupoNombre}>{g.grado}° {g.grupo}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: ei.color, margin: '4px 0' }}>
                            {g.promedio !== null ? g.promedio.toFixed(1) : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#888' }}>{g.total_estudiantes} est.</div>
                          {g.en_riesgo > 0 && (
                            <div style={es.enRiesgo}>{g.en_riesgo} en riesgo</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ flex: 1, minWidth: 240 }}>

            {/* Riesgos */}
            <h3 style={es.seccionTitulo}>Estudiantes por Riesgo</h3>
            <div style={es.card}>
              {[
                { nivel: 'Crítico',  valor: datos.riesgo.critico, color: '#c62828', bg: '#ffebee' },
                { nivel: 'Alto',     valor: datos.riesgo.alto,    color: '#e65100', bg: '#fff3e0' },
                { nivel: 'Medio',    valor: datos.riesgo.medio,   color: '#f57f17', bg: '#fffde7' },
                { nivel: 'Bajo',     valor: datos.riesgo.bajo,    color: '#2e7d32', bg: '#e8f5e9' },
              ].map(({ nivel, valor, color, bg }) => (
                <div key={nivel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, marginBottom: 8, background: bg }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color }}>{nivel}</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color }}>{valor}</span>
                </div>
              ))}
            </div>

            {/* Distribución MEN */}
            <h3 style={{ ...es.seccionTitulo, marginTop: 20 }}>Distribución MEN</h3>
            <div style={es.card}>
              <BarraMEN label="Superior (4.6–5.0)" pct={datos.distribucionMEN.superior.pct} cantidad={datos.distribucionMEN.superior.cantidad} color="#1565c0" />
              <BarraMEN label="Alto (4.0–4.5)"     pct={datos.distribucionMEN.alto.pct}     cantidad={datos.distribucionMEN.alto.cantidad}     color="#2e7d32" />
              <BarraMEN label="Básico (3.5–3.9)"   pct={datos.distribucionMEN.basico.pct}   cantidad={datos.distribucionMEN.basico.cantidad}   color="#e65100" />
              <BarraMEN label="Bajo (<3.5)"         pct={datos.distribucionMEN.bajo.pct}     cantidad={datos.distribucionMEN.bajo.cantidad}     color="#c62828" />
            </div>
          </div>
        </div>

        {/* Recomendaciones */}
        <h3 style={{ ...es.seccionTitulo, marginTop: 20 }}>Recomendaciones</h3>
        <div style={es.card}>
          {datos.recomendaciones.map((rec, i) => (
            <div key={i} style={es.recomendacion}>
              <span style={es.recNumero}>{i + 1}</span>
              <span style={{ fontSize: 14, color: '#333' }}>{rec}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1050px', margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, fontFamily: 'inherit', marginBottom: 6 },
  titulo:    { fontSize: 22, fontWeight: 800, color: '#333', margin: '0 0 4px' },
  subtitulo: { fontSize: 13, color: '#888', margin: 0 },
  btnRefresh:{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#667eea', fontFamily: 'inherit' },
  card:      { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 0 },
  saludGrid: { display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' },
  estadoBadge: { display: 'inline-block', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 700, border: '2px solid' },
  kpiGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flex: 1 },
  kpi:       { textAlign: 'center' },
  kpiValor:  { fontSize: 26, fontWeight: 900, color: '#333' },
  kpiLabel:  { fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 },
  dobleColumna: { display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' },
  seccionTitulo: { fontSize: 15, fontWeight: 800, color: '#333', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  gradoBloque: { marginBottom: 16 },
  gradoHeader: { fontSize: 13, fontWeight: 700, color: '#667eea', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' },
  gruposGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  grupoCard:  { border: '2px solid', borderRadius: 12, padding: '12px 16px', textAlign: 'center', minWidth: 100, flex: '0 0 auto' },
  grupoNombre:{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 2 },
  enRiesgo:  { marginTop: 6, background: 'rgba(198,40,40,0.12)', color: '#c62828', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  sinDatos:  { background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  recomendacion: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' },
  recNumero: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
};
