import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBarChart } from '../components/Icons';

const PERIODOS_DEFAULT = ['1', '2', '3'];
const P_LABEL  = { '1': 'Período 1', '2': 'Período 2', '3': 'Período 3', '4': 'Período 4' };
const P_COLOR  = { '1': '#667eea', '2': '#f093fb', '3': '#43e97b', '4': '#fa709a' };

function nivelMEN(nota) {
  if (!nota) return { label: '—', color: '#bbb' };
  if (nota >= 4.6) return { label: 'Superior', color: '#1565c0' };
  if (nota >= 4.0) return { label: 'Alto',     color: '#2e7d32' };
  if (nota >= 3.5) return { label: 'Básico',   color: '#f57f17' };
  return               { label: 'Bajo',      color: '#c62828' };
}

function flecha(a, b) {
  if (!a || !b) return null;
  const diff = parseFloat(b) - parseFloat(a);
  if (Math.abs(diff) < 0.05) return { icono: '→', color: '#888', diff: 0 };
  if (diff > 0) return { icono: '↑', color: '#27ae60', diff };
  return { icono: '↓', color: '#e74c3c', diff };
}

function BarraComparativa({ datos, periodos }) {
  const max = 5;
  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', height: '120px', padding: '0 8px' }}>
      {periodos.map(p => {
        const item = datos.find(d => String(d.periodo) === p);
        const val  = item ? parseFloat(item.promedio) : null;
        const pct  = val ? (val / max) * 100 : 0;
        const nivel = nivelMEN(val);
        return (
          <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: nivel.color }}>
              {val ? val.toFixed(1) : '—'}
            </div>
            <div style={{ width: '100%', background: '#f0f0f0', borderRadius: '8px 8px 0 0', height: '80px', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', background: P_COLOR[p],
                height: `${pct}%`, borderRadius: '8px 8px 0 0',
                minHeight: val ? '4px' : '0',
                transition: 'height 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600' }}>{P_LABEL[p]}</div>
          </div>
        );
      })}
    </div>
  );
}

function TablaComparativa({ filas, campoId, campoNombre, etiquetaNombre, periodos }) {
  if (!filas || filas.length === 0) return (
    <div style={{ textAlign: 'center', color: '#bbb', padding: '24px', fontSize: '14px' }}>
      Sin datos para comparar
    </div>
  );

  // Agrupar por id
  const ids = [...new Set(filas.map(f => f[campoId]))];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={es.tabla}>
        <thead>
          <tr>
            <th style={es.th}>{etiquetaNombre}</th>
            {periodos.map(p => (
              <th key={p} style={{ ...es.th, textAlign: 'center', color: P_COLOR[p] }}>{P_LABEL[p]}</th>
            ))}
            <th style={{ ...es.th, textAlign: 'center' }}>Tendencia</th>
          </tr>
        </thead>
        <tbody>
          {ids.map(id => {
            const fila = periodos.map(p =>
              filas.find(f => String(f[campoId]) === String(id) && String(f.periodo) === p)
            );
            const nombre    = filas.find(f => String(f[campoId]) === String(id))?.[campoNombre] || '—';
            const valores   = fila.map(f => (f?.promedio ? parseFloat(f.promedio) : null));
            const valoresConDatos = valores.filter(v => v !== null);
            const primero   = valoresConDatos[0] ?? null;
            const ultimo    = valoresConDatos.length > 1 ? valoresConDatos[valoresConDatos.length - 1] : null;
            const tendencia = flecha(primero, ultimo);
            const grado     = fila.find(Boolean)?.grado;

            return (
              <tr key={id} style={es.tr}>
                <td style={{ ...es.td, fontWeight: '700' }}>
                  {grado ? `Grado ${grado}° ` : ''}{nombre}
                </td>
                {valores.map((val, i) => {
                  const nivel = nivelMEN(val);
                  const arr   = i > 0 ? flecha(valores[i - 1], val) : null;
                  return (
                    <td key={i} style={{ ...es.td, textAlign: 'center' }}>
                      {val !== null ? (
                        <span>
                          <span style={{ fontWeight: '800', fontSize: '15px', color: nivel.color }}>{val.toFixed(1)}</span>
                          {arr && <span style={{ fontSize: '11px', color: arr.color, marginLeft: '4px' }}>{arr.icono}</span>}
                        </span>
                      ) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                  );
                })}
                <td style={{ ...es.td, textAlign: 'center' }}>
                  {tendencia ? (
                    <span style={{ fontWeight: '700', color: tendencia.color, fontSize: '16px' }}>
                      {tendencia.icono}
                      {tendencia.diff !== 0 && (
                        <span style={{ fontSize: '11px', marginLeft: '2px' }}>
                          {tendencia.diff > 0 ? '+' : ''}{tendencia.diff.toFixed(1)}
                        </span>
                      )}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Comparativas() {
  const { usuario } = useAuth();
  const colegioId   = usuario.colegio_id;

  const [datos,    setDatos]    = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState('');
  const [tab,      setTab]      = useState('grupos');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await axiosAuth.get(`/api/reportes/colegio/${colegioId}/comparativas`);
      setDatos(r.data.data);
    } catch {
      setError('No se pudieron cargar las comparativas.');
    } finally {
      setCargando(false);
    }
  }, [colegioId]);

  useEffect(() => { cargar(); }, [cargar]);

  const inst = datos?.institucional || [];

  // Períodos a mostrar: los configurados por el colegio (si existen), o los que
  // ya tengan datos, o el default de 3 mientras carga. Soporta hasta 4 períodos.
  const periodosConfig = (datos?.periodos || []).map(p => String(p.numero));
  const periodosConDatos = [...new Set(inst.map(d => String(d.periodo)))];
  const PERIODOS = (periodosConfig.length > 0 ? periodosConfig : periodosConDatos.length > 0 ? periodosConDatos : PERIODOS_DEFAULT)
    .filter(p => P_LABEL[p])
    .sort();

  // Calcular tendencia institucional general (primer período con datos → último)
  const promedioP = p => {
    const item = inst.find(d => String(d.periodo) === p);
    return item ? parseFloat(item.promedio) : null;
  };
  const promediosOrdenados = PERIODOS.map(promedioP).filter(v => v !== null);
  const tendenciaGlobal = flecha(promediosOrdenados[0], promediosOrdenados[promediosOrdenados.length - 1]);

  // Info de fechas de períodos configurados
  const periodoInfo = p => datos?.periodos?.find(d => String(d.numero) === p);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Comparativas por Período" />
      <div style={es.contenido}>

        {cargando && <div style={es.cargando}>Calculando comparativas...</div>}
        {error    && <div style={es.error}>{error}</div>}

        {!cargando && !error && datos && (
          <>
            {/* Cards de resumen por período */}
            <div style={es.cardsGrid}>
              {PERIODOS.map((p, i) => {
                const val  = promedioP(p);
                const prev = i > 0 ? promedioP(PERIODOS[i - 1]) : null;
                const arr  = flecha(prev, val);
                const nivel = nivelMEN(val);
                const info = periodoInfo(p);
                const item = inst.find(d => String(d.periodo) === p);
                return (
                  <div key={p} style={{ ...es.card, borderTop: `4px solid ${P_COLOR[p]}` }}>
                    <div style={es.cardPeriodo}>{P_LABEL[p]}</div>
                    {info && (
                      <div style={es.cardFechas}>
                        {new Date(info.fecha_inicio).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(info.fecha_fin).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    <div style={{ ...es.cardPromedio, color: nivel.color }}>
                      {val !== null ? val.toFixed(2) : '—'}
                    </div>
                    <div style={es.cardNivel}>{nivel.label}</div>
                    {item && (
                      <div style={es.cardStats}>
                        {item.estudiantes} estudiantes · {item.actividades} actividades
                      </div>
                    )}
                    {arr && i > 0 && val !== null && (
                      <div style={{ ...es.cardTendencia, color: arr.color }}>
                        {arr.icono} {arr.diff > 0 ? '+' : ''}{arr.diff.toFixed(2)} vs {P_LABEL[PERIODOS[i - 1]]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Gráfico de barras institucional */}
            <div style={es.seccion}>
              <div style={es.seccionEncabezado}>
                <h3 style={es.seccionTitulo}>Evolución institucional</h3>
                {tendenciaGlobal && (
                  <span style={{ ...es.tendenciaGlobal, color: tendenciaGlobal.color }}>
                    {tendenciaGlobal.icono} Tendencia general{' '}
                    {tendenciaGlobal.diff > 0 ? `+${tendenciaGlobal.diff.toFixed(2)}` : tendenciaGlobal.diff.toFixed(2)}
                  </span>
                )}
              </div>
              <div style={es.graficoWrap}>
                <BarraComparativa datos={inst} periodos={PERIODOS} />
              </div>
              <div style={es.leyenda}>
                {PERIODOS.map(p => (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: P_COLOR[p], display: 'inline-block' }} />
                    {P_LABEL[p]}
                  </span>
                ))}
                <span style={{ fontSize: '12px', color: '#aaa' }}>Escala MEN: 1.0 – 5.0</span>
              </div>
            </div>

            {/* Tabs: Grupos / Materias */}
            <div style={es.tabs}>
              {[
                { key: 'grupos',   label: 'Por grupo' },
                { key: 'materias', label: 'Por materia' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{ ...es.tab, ...(tab === t.key ? es.tabActivo : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={es.seccion}>
              {tab === 'grupos' && (
                <>
                  <h3 style={es.seccionTitulo}>Promedio por grupo entre períodos</h3>
                  <TablaComparativa
                    filas={datos.por_grupo}
                    campoId="grupo_id"
                    campoNombre="grupo"
                    etiquetaNombre="Grupo"
                    periodos={PERIODOS}
                  />
                </>
              )}
              {tab === 'materias' && (
                <>
                  <h3 style={es.seccionTitulo}>Promedio por materia entre períodos</h3>
                  <TablaComparativa
                    filas={datos.por_materia}
                    campoId="materia_id"
                    campoNombre="materia"
                    etiquetaNombre="Materia"
                    periodos={PERIODOS}
                  />
                </>
              )}
            </div>

            {/* Aviso si no hay períodos configurados */}
            {(!datos.periodos || datos.periodos.length === 0) && (
              <div style={es.aviso}>
                Las comparativas funcionan con cualquier dato existente. Para ver fechas reales de cada período, configúralos en <strong>Períodos Académicos</strong> desde el panel del administrador.
              </div>
            )}
          </>
        )}

        {!cargando && !error && datos && inst.length === 0 && (
          <div style={es.vacio}>
            <IconBarChart size={48} style={{ color: '#ccc', marginBottom: '12px' }} />
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '6px' }}>Sin datos para comparar</div>
            <div style={{ fontSize: '14px', color: '#888' }}>
              Las comparativas aparecen cuando los estudiantes completan actividades en al menos dos períodos distintos.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' },
  cargando:  { textAlign: 'center', color: '#888', padding: '60px', fontSize: '15px' },
  error:     { background: '#fef2f2', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' },

  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '28px' },
  card: {
    background: '#fff', borderRadius: '16px', padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  cardPeriodo:   { fontSize: '13px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardFechas:    { fontSize: '12px', color: '#aaa' },
  cardPromedio:  { fontSize: '42px', fontWeight: '900', lineHeight: 1.1 },
  cardNivel:     { fontSize: '13px', fontWeight: '600', color: '#999' },
  cardStats:     { fontSize: '12px', color: '#bbb', marginTop: '4px' },
  cardTendencia: { fontSize: '13px', fontWeight: '700', marginTop: '4px' },

  seccion:         { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: '20px' },
  seccionEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' },
  seccionTitulo:   { fontSize: '16px', fontWeight: '700', color: '#333', margin: 0 },
  tendenciaGlobal: { fontSize: '14px', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', background: '#f8f9fa' },
  graficoWrap:     { padding: '8px 0 16px' },
  leyenda:         { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' },

  tabs:    { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab:     { padding: '8px 20px', borderRadius: '20px', border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#666', fontFamily: 'inherit' },
  tabActivo: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderColor: '#667eea', color: '#fff' },

  tabla:  { width: '100%', borderCollapse: 'collapse', minWidth: '500px' },
  th:     { padding: '10px 14px', fontSize: '12px', fontWeight: '700', color: '#666', borderBottom: '2px solid #f0f0f0', textAlign: 'left', background: '#fafafa' },
  tr:     { borderBottom: '1px solid #f5f5f5' },
  td:     { padding: '11px 14px', fontSize: '14px', color: '#333' },

  aviso: { background: '#fff9e6', border: '1px solid #ffe58f', borderRadius: '12px', padding: '14px 18px', fontSize: '13px', color: '#7d6608', marginTop: '16px' },
  vacio: { background: '#fff', borderRadius: '16px', padding: '60px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
};
