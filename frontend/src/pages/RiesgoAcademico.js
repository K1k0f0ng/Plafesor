import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { SemaforoDot, IconRefresh, IconClock, IconClipboard, IconAlertCircle } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const NIVEL = {
  bajo:    { color: '#e8f5e9', texto: '#2e7d32', badge: '#4caf50', label: 'Bajo'    },
  medio:   { color: '#fff8e1', texto: '#f57f17', badge: '#ff9800', label: 'Medio'   },
  alto:    { color: '#fff3e0', texto: '#e65100', badge: '#ff5722', label: 'Alto'    },
  critico: { color: '#ffebee', texto: '#c62828', badge: '#f44336', label: 'Crítico' },
};

function MiniBar({ valor, color }) {
  const pct = Math.min(100, Math.max(0, valor || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
      <div style={{ width: '56px', height: '7px', background: '#ececec', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px' }} />
      </div>
      <span style={{ fontSize: '11px', color: '#999', minWidth: '22px' }}>{pct}</span>
    </div>
  );
}

function BarraFactor({ label, valor, color }) {
  const pct = Math.min(100, Math.max(0, valor || 0));
  return (
    <div style={es.factorFila}>
      <span style={es.factorLabel}>{label}</span>
      <div style={es.factorBarra}>
        <div style={{ ...es.factorRelleno, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ ...es.factorValor, color }}>{pct}</span>
    </div>
  );
}

export default function RiesgoAcademico() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [datos,          setDatos]          = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [calculando,     setCalculando]     = useState(false);
  const [error,          setError]          = useState('');
  const [filtroNivel,    setFiltroNivel]    = useState('');
  const [ultimoCalculo,  setUltimoCalculo]  = useState(null);

  // Panel de intervención
  const [seleccionado,   setSeleccionado]   = useState(null);
  const [notificando,    setNotificando]    = useState(false);
  const [resultadoNotif, setResultadoNotif] = useState(null);
  const [generandoPMI,   setGenerandoPMI]   = useState(false);
  const [pmiTexto,       setPmiTexto]       = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const resp  = await axiosAuth.get(`/api/riesgo/colegio/${usuario.colegio_id}`);
      const filas = resp.data?.data ?? [];
      setDatos(filas);
      if (filas.length > 0) setUltimoCalculo(filas[0].calculado_en);
    } catch (err) {
      const detalle = err.response?.data?.detalle || err.response?.data?.error || err.message || '';
      setError(`No se pudieron cargar las predicciones.${detalle ? ' — ' + detalle : ''}`);
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const calcular = async () => {
    setCalculando(true); setError('');
    try {
      await axiosAuth.post(`/api/riesgo/colegio/${usuario.colegio_id}/calcular`);
      await cargar();
    } catch (err) {
      const detalle = err.response?.data?.detalle || err.response?.data?.error || err.message || '';
      setError(`Error al calcular.${detalle ? ' — ' + detalle : ' Verifica que haya actividades y resultados.'}`);
    } finally {
      setCalculando(false);
    }
  };

  function abrirPanel(fila) {
    setSeleccionado(fila);
    setResultadoNotif(null);
  }

  function cerrarPanel() {
    setSeleccionado(null);
    setResultadoNotif(null);
    setPmiTexto(null);
  }

  async function generarPMI() {
    if (!seleccionado) return;
    setGenerandoPMI(true); setPmiTexto(null);
    try {
      const resp = await axiosAuth.post('/api/riesgo/generar-pmi', {
        estudiante_id: seleccionado.estudiante_id,
        materia_id:   seleccionado.materia_id,
        grupo_id:     seleccionado.grupo_id,
        score:        seleccionado.score,
        nivel:        seleccionado.nivel,
        factores:     seleccionado.factores,
      });
      setPmiTexto(resp.data.data.pmi);
    } catch {
      setPmiTexto('Error al generar el PMI. Intenta de nuevo.');
    } finally {
      setGenerandoPMI(false);
    }
  }

  function copiarPMI() {
    if (!pmiTexto || !seleccionado) return;
    const encabezado = `PLAN DE MEJORAMIENTO INDIVIDUAL\nEstudiante: ${formatearApellidoPrimero(seleccionado.nombre_estudiante)}\nMateria: ${seleccionado.nombre_materia} — Grado ${seleccionado.grado}° ${seleccionado.nombre_grupo}\nFecha: ${new Date().toLocaleDateString('es-CO')}\n\n`;
    navigator.clipboard.writeText(encabezado + pmiTexto);
  }

  async function notificarPadre() {
    if (!seleccionado) return;
    setNotificando(true); setResultadoNotif(null);
    try {
      await axiosAuth.post('/api/riesgo/notificar-padre', {
        estudiante_id: seleccionado.estudiante_id,
        materia_id:   seleccionado.materia_id,
        grupo_id:     seleccionado.grupo_id,
        score:        seleccionado.score,
        nivel:        seleccionado.nivel,
      });
      setResultadoNotif({ ok: true, texto: 'Mensaje enviado correctamente al padre/madre' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al enviar la notificación';
      setResultadoNotif({ ok: false, texto: msg });
    } finally {
      setNotificando(false);
    }
  }

  const datosFiltrados = filtroNivel ? datos.filter(d => d.nivel === filtroNivel) : datos;
  const conteos = {
    critico: datos.filter(d => d.nivel === 'critico').length,
    alto:    datos.filter(d => d.nivel === 'alto').length,
    medio:   datos.filter(d => d.nivel === 'medio').length,
    bajo:    datos.filter(d => d.nivel === 'bajo').length,
  };

  return (
    <div style={es.pagina}>
      <Navbar titulo="Motor de Riesgo Académico" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.encabezado}>
          <div>
            <h2 style={es.titulo}>Motor de Riesgo Académico</h2>
            <p style={es.subtitulo}>Haz clic en cualquier estudiante para ver el detalle e intervenir</p>
          </div>
          <button onClick={calcular} disabled={calculando} style={es.btnCalcular}>
            {calculando ? 'Calculando...' : <><IconRefresh size={14} style={{ marginRight: 6 }} />Recalcular ahora</>}
          </button>
        </div>

        {ultimoCalculo && (
          <p style={es.ultimoCal}>
            Último cálculo: {new Date(ultimoCalculo).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}

        {/* Cards de nivel (filtros) */}
        <div style={es.nivelesGrid}>
          {['critico', 'alto', 'medio', 'bajo'].map(nivel => {
            const cfg = NIVEL[nivel];
            const activo = filtroNivel === nivel;
            return (
              <button
                key={nivel}
                onClick={() => setFiltroNivel(activo ? '' : nivel)}
                style={{
                  ...es.nivelCard,
                  background: cfg.color,
                  border: `2px solid ${activo ? cfg.badge : 'transparent'}`,
                  boxShadow: activo ? `0 0 0 3px ${cfg.badge}33` : '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <SemaforoDot color={cfg.badge} size={20} />
                <span style={{ fontSize: '34px', fontWeight: '800', color: cfg.texto }}>{conteos[nivel]}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: cfg.texto }}>{cfg.label}</span>
                {activo && <span style={{ fontSize: '10px', color: cfg.badge }}>▼ filtrado</span>}
              </button>
            );
          })}
        </div>

        {error && <div style={es.error}>{error}</div>}

        {!cargando && datos.length === 0 ? (
          <div style={es.sinDatos}>
            <IconAlertCircle size={52} style={{ color: '#ccc' }} />
            <p style={{ fontWeight: '700', color: '#555' }}>No hay predicciones todavía</p>
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              Presiona "Recalcular ahora" para analizar el riesgo de todos los estudiantes.
            </p>
          </div>
        ) : (
          <>
            {filtroNivel && (
              <div style={es.filtroBanner}>
                Mostrando nivel <strong>{NIVEL[filtroNivel]?.label}</strong> — {datosFiltrados.length} registro{datosFiltrados.length !== 1 ? 's' : ''}
                <button onClick={() => setFiltroNivel('')} style={es.btnLimpiar}>× Limpiar</button>
              </div>
            )}

            <div style={es.tablaWrap}>
              <table style={es.tabla}>
                <thead>
                  <tr>
                    <th style={es.th}>Nivel</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Score</th>
                    <th style={es.th}>Estudiante</th>
                    <th style={es.th}>Materia</th>
                    <th style={es.th}>Grupo</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Nota</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Asist.</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#aaa' }}>Cargando...</td></tr>
                  ) : datosFiltrados.map((d, i) => {
                    const cfg      = NIVEL[d.nivel] || NIVEL.bajo;
                    const factores = typeof d.factores === 'string' ? JSON.parse(d.factores) : (d.factores || {});
                    const activo   = seleccionado?.estudiante_id === d.estudiante_id && seleccionado?.materia_id === d.materia_id;
                    return (
                      <tr
                        key={i}
                        onClick={() => abrirPanel(d)}
                        style={{
                          ...es.tr,
                          background: activo ? 'rgba(102,126,234,0.08)' : (i % 2 === 0 ? '#fff' : '#fafafa'),
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { if (!activo) e.currentTarget.style.background = '#f5f5ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = activo ? 'rgba(102,126,234,0.08)' : (i % 2 === 0 ? '#fff' : '#fafafa'); }}
                      >
                        <td style={es.td}>
                          <span style={{ ...es.nivelBadge, background: cfg.badge }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ ...es.td, textAlign: 'center' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: cfg.texto }}>{d.score}</span>
                        </td>
                        <td style={{ ...es.td, fontWeight: '700', color: '#222' }}>{formatearApellidoPrimero(d.nombre_estudiante)}</td>
                        <td style={es.td}>{d.nombre_materia}</td>
                        <td style={{ ...es.td, color: '#888' }}>G{d.grado}° {d.nombre_grupo}</td>
                        <td style={es.td}><MiniBar valor={factores.nota}       color="#ef5350" /></td>
                        <td style={es.td}><MiniBar valor={factores.asistencia} color="#ff9800" /></td>
                        <td style={es.td}><MiniBar valor={factores.pendientes} color="#5c6bc0" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={es.leyenda}>
          <span>Haz clic en una fila para ver el detalle e intervenir</span>
          <span style={{ color: '#ef5350' }}>■ Nota (40%)</span>
          <span style={{ color: '#ff9800' }}>■ Inasistencia (30%)</span>
          <span style={{ color: '#5c6bc0' }}>■ Pendientes (30%)</span>
        </div>
      </div>

      {/* ── Panel de Intervención ── */}
      {seleccionado && (() => {
        const cfg      = NIVEL[seleccionado.nivel] || NIVEL.bajo;
        const factores = typeof seleccionado.factores === 'string'
          ? JSON.parse(seleccionado.factores)
          : (seleccionado.factores || {});
        const inicial  = formatearApellidoPrimero(seleccionado.nombre_estudiante)?.charAt(0)?.toUpperCase() || '?';

        return (
          <>
            {/* Overlay */}
            <div onClick={cerrarPanel} style={es.overlay} />

            {/* Panel lateral derecho */}
            <div style={es.panel}>

              {/* Header del panel */}
              <div style={es.panelHeader}>
                <span style={es.panelTituloLabel}>Panel de Intervención</span>
                <button onClick={cerrarPanel} style={es.panelCerrar}>×</button>
              </div>

              {/* Estudiante */}
              <div style={es.panelEstudiante}>
                <div style={{ ...es.panelAvatar, background: cfg.badge }}>
                  {inicial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={es.panelNombre}>{formatearApellidoPrimero(seleccionado.nombre_estudiante)}</p>
                  <p style={es.panelSub}>
                    {seleccionado.nombre_materia} · G{seleccionado.grado}° {seleccionado.nombre_grupo}
                  </p>
                </div>
              </div>

              {/* Score + badge */}
              <div style={{ ...es.scoreBox, background: cfg.color }}>
                <span style={{ ...es.scoreNum, color: cfg.texto }}>{seleccionado.score}</span>
                <span style={es.scoreSub}>Puntaje de riesgo / 100</span>
                <span style={{ ...es.scoreBadge, background: cfg.badge }}>
                  Riesgo {cfg.label}
                </span>
              </div>

              {/* Factores */}
              <div style={es.panelSeccion}>
                <p style={es.panelSecTitulo}>Análisis de factores</p>
                <BarraFactor label="Notas (40%)"         valor={factores.nota}       color="#ef5350" />
                <BarraFactor label="Inasistencias (30%)" valor={factores.asistencia} color="#ff9800" />
                <BarraFactor label="Pendientes (30%)"    valor={factores.pendientes} color="#5c6bc0" />
              </div>

              {/* Acciones */}
              <div style={es.panelSeccion}>
                <p style={es.panelSecTitulo}>Acciones</p>

                {resultadoNotif && (
                  <div style={{
                    ...es.resultadoNotif,
                    background: resultadoNotif.ok ? '#e8f5e9' : '#ffebee',
                    color:      resultadoNotif.ok ? '#2e7d32' : '#c62828',
                    borderColor:resultadoNotif.ok ? '#c8e6c9' : '#ffcdd2',
                  }}>
                    {resultadoNotif.texto}
                  </div>
                )}

                <button
                  onClick={notificarPadre}
                  disabled={notificando}
                  style={es.btnNotificar}
                >
                  {notificando ? 'Enviando mensaje...' : 'Notificar al padre por WhatsApp'}
                </button>

                <p style={es.panelAyuda}>
                  Se enviará un mensaje al número registrado en el perfil del estudiante informando sobre el nivel de riesgo académico.
                </p>
              </div>

              {/* PMI con IA */}
              <div style={es.panelSeccion}>
                <p style={es.panelSecTitulo}>Plan de Mejoramiento Individual</p>

                {!pmiTexto ? (
                  <button
                    onClick={generarPMI}
                    disabled={generandoPMI}
                    style={es.btnPMI}
                  >
                    {generandoPMI ? 'Generando PMI con IA...' : <><IconClipboard size={14} style={{ marginRight: 6 }} />Generar PMI con IA</>}
                  </button>
                ) : (
                  <div>
                    <div style={es.pmiBox}>
                      <pre style={es.pmiTexto}>{pmiTexto}</pre>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={copiarPMI} style={es.btnCopiarPMI}>
                        <IconClipboard size={13} style={{ marginRight: 5 }} />Copiar PMI
                      </button>
                      <button onClick={generarPMI} disabled={generandoPMI} style={es.btnRegenerarPMI}>
                        <IconRefresh size={13} style={{ marginRight: 5 }} />Regenerar
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ ...es.panelAyuda, marginTop: '8px' }}>
                  Genera un plan formal con diagnóstico, acciones docente, recomendaciones para padres y metas a 4 semanas.
                </p>
              </div>

            </div>
          </>
        );
      })()}
    </div>
  );
}

const es = {
  pagina:     { minHeight: '100vh', background: '#f0f2f5' },
  contenido:  { padding: '28px 24px', maxWidth: '1200px', margin: '0 auto' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '16px' },
  titulo:     { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: 0 },
  subtitulo:  { fontSize: '13px', color: '#888', margin: '4px 0 0' },
  btnCalcular: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '11px 22px', fontSize: '14px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  ultimoCal:  { fontSize: '12px', color: '#aaa', margin: '0 0 20px' },
  nivelesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' },
  nivelCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '18px 12px', borderRadius: '14px', cursor: 'pointer',
    transition: 'transform 0.1s', border: '2px solid transparent',
    background: 'none', fontFamily: 'inherit',
  },
  error:     { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  sinDatos:  { background: '#fff', borderRadius: '16px', padding: '60px 24px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  filtroBanner: {
    background: '#f3f0ff', border: '1px solid #c5b8f7', borderRadius: '10px',
    padding: '10px 16px', marginBottom: '14px', fontSize: '13px', color: '#5c35c2',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  btnLimpiar: { background: 'none', border: '1px solid #9b7ce6', borderRadius: '8px', color: '#7c50d4', cursor: 'pointer', padding: '2px 10px', fontSize: '12px', fontFamily: 'inherit' },
  tablaWrap: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflowX: 'auto' },
  tabla:     { width: '100%', borderCollapse: 'collapse', minWidth: '820px' },
  th:        { padding: '12px 14px', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f0f0f0', background: '#fafafa', textAlign: 'left' },
  tr:        { borderBottom: '1px solid #f5f5f5', transition: 'background 0.1s' },
  td:        { padding: '11px 14px', fontSize: '13px', color: '#333' },
  nivelBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', color: '#fff', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' },
  leyenda:   { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px', fontSize: '12px', color: '#aaa' },

  // Panel de intervención
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.25)',
    zIndex: 150,
    backdropFilter: 'blur(2px)',
  },
  panel: {
    position: 'fixed', right: 0, top: 0,
    width: '380px', height: '100vh',
    background: '#fff',
    boxShadow: '-6px 0 32px rgba(0,0,0,0.14)',
    zIndex: 200,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid #f0f0f5',
    position: 'sticky', top: 0, background: '#fff', zIndex: 1,
  },
  panelTituloLabel: { fontSize: '14px', fontWeight: '700', color: '#333' },
  panelCerrar: {
    background: 'none', border: 'none', fontSize: '22px', color: '#aaa',
    cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: 'inherit',
  },
  panelEstudiante: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px 20px 16px',
  },
  panelAvatar: {
    width: '48px', height: '48px', borderRadius: '50%',
    color: '#fff', fontSize: '20px', fontWeight: '800',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  panelNombre: { fontSize: '16px', fontWeight: '800', color: '#1a1a2e', margin: 0 },
  panelSub:    { fontSize: '13px', color: '#888', margin: '3px 0 0' },
  scoreBox: {
    margin: '0 20px 0',
    borderRadius: '14px', padding: '20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  scoreNum:   { fontSize: '52px', fontWeight: '900', lineHeight: 1 },
  scoreSub:   { fontSize: '12px', color: '#888' },
  scoreBadge: {
    marginTop: '8px', padding: '4px 14px', borderRadius: '20px',
    color: '#fff', fontSize: '13px', fontWeight: '700',
  },
  panelSeccion: {
    padding: '20px', borderTop: '1px solid #f5f5f5',
  },
  panelSecTitulo: {
    fontSize: '11px', fontWeight: '700', color: '#bbb',
    textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px',
  },

  // Barras de factores en el panel
  factorFila:    { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  factorLabel:   { fontSize: '12px', color: '#555', flex: '0 0 140px' },
  factorBarra:   { flex: 1, height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' },
  factorRelleno: { height: '100%', borderRadius: '4px', transition: 'width 0.4s' },
  factorValor:   { fontSize: '13px', fontWeight: '700', flex: '0 0 28px', textAlign: 'right' },

  // Acciones
  resultadoNotif: {
    borderRadius: '10px', padding: '10px 14px',
    fontSize: '13px', fontWeight: '600', marginBottom: '14px',
    border: '1px solid transparent',
  },
  btnNotificar: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #25d366, #128c7e)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: '10px',
  },
  panelAyuda: { fontSize: '11px', color: '#bbb', lineHeight: '1.5', margin: 0 },

  // PMI
  btnPMI: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: '10px',
  },
  pmiBox: {
    background: '#f8f9fa', border: '1px solid #eeeff3',
    borderRadius: '10px', padding: '14px', maxHeight: '320px',
    overflowY: 'auto',
  },
  pmiTexto: {
    fontSize: '12px', color: '#333', lineHeight: '1.7',
    whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
  },
  btnCopiarPMI: {
    flex: 1, padding: '9px', background: '#f0f0ff',
    color: '#667eea', border: '1px solid #c5b8f7',
    borderRadius: '8px', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btnRegenerarPMI: {
    padding: '9px 14px', background: 'none',
    color: '#999', border: '1px solid #e0e0e0',
    borderRadius: '8px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
