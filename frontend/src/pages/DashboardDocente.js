import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import {
  IconCalendar, IconCheck, IconClock, IconAlertTriangle, IconClipboard,
  IconEdit, IconCheckSquare, IconBookOpen, IconDownload, IconInbox, IconZap, IconGrid,
  IconAccessibility,
} from '../components/Icons';

const NIVEL_COLOR = { Bajo: '#ffcdd2', Básico: '#fff9c4', Alto: '#c8e6c9', Superior: '#bbdefb', Pendiente: '#f5f5f5' };
const NIVEL_TEXTO = { Bajo: '#c62828', Básico: '#f57f17', Alto: '#2e7d32', Superior: '#1565c0', Pendiente: '#888' };

export default function DashboardDocente() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [asignaciones, setAsignaciones] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [reporte, setReporte] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [alertas, setAlertas] = useState([]);
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [planesAbiertos, setPlanesAbiertos] = useState(false);
  const [resumenHoy, setResumenHoy] = useState([]);
  const [clasesHoy, setClasesHoy] = useState([]);

  const estudiantesEnRiesgo = new Set(alertas.map(a => a.estudiante_id)).size;

  useEffect(() => {
    async function cargar() {
      try {
        const [respAsig, respAlertas, respHoy, respPlanes, respHorario] = await Promise.all([
          axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`),
          axiosAuth.get(`/api/reportes/alertas/docente/${usuario.id}`),
          axiosAuth.get(`/api/asistencias/hoy/docente/${usuario.id}`),
          axiosAuth.get('/api/planes/docente'),
          axiosAuth.get('/api/horarios/hoy'),
        ]);
        setAsignaciones(respAsig.data.data);
        setAlertas(respAlertas.data.data);
        setResumenHoy(respHoy.data.data || []);
        setPlanes(respPlanes.data.data || []);
        setClasesHoy(respHorario.data.data || []);
      } catch {
        // Silencioso — se mostrará lista vacía
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [usuario.id]);

  async function verEstudiantes(asig) {
    if (seleccionada?.id === asig.id) {
      setSeleccionada(null);
      setReporte([]);
      return;
    }
    setSeleccionada(asig);
    setCargandoReporte(true);
    try {
      const resp = await axiosAuth.get(`/api/reportes/grupo/${asig.grupo_id}/materia/${asig.materia_id}`);
      setReporte(resp.data.data);
    } catch {
      setReporte([]);
    } finally {
      setCargandoReporte(false);
    }
  }

  function nivelMEN(nota) {
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4.0) return 'Alto';
    if (nota >= 3.5) return 'Básico';
    return 'Bajo';
  }

  function exportarExcel() {
    // Columnas únicas de actividades
    const actividadesVistas = new Set();
    const actividades = [];
    reporte.forEach(r => {
      if (!actividadesVistas.has(r.actividad_id)) {
        actividadesVistas.add(r.actividad_id);
        actividades.push({ id: r.actividad_id, titulo: r.titulo, periodo: r.periodo });
      }
    });

    // Agrupar notas por estudiante
    const estudiantesMap = {};
    reporte.forEach(r => {
      if (!estudiantesMap[r.estudiante_id]) {
        estudiantesMap[r.estudiante_id] = { nombre: r.nombre_estudiante };
      }
      estudiantesMap[r.estudiante_id][r.actividad_id] = r.nota;
    });

    // Construir filas pivoteadas
    const filas = Object.values(estudiantesMap).map(est => {
      const fila = { Estudiante: est.nombre };
      const notasValidas = [];
      actividades.forEach(act => {
        const nota = est[act.id];
        fila[`${act.titulo} (P${act.periodo})`] = nota !== null && nota !== undefined ? nota : 'Pendiente';
        if (nota !== null && nota !== undefined) notasValidas.push(parseFloat(nota));
      });
      // Regla de tres: suma de notas obtenidas ÷ total de actividades asignadas
      // (no ÷ solo las entregadas) — mismo criterio que el boletín y el libro de notas.
      const promedio = actividades.length > 0
        ? parseFloat((notasValidas.reduce((a, b) => a + b, 0) / actividades.length).toFixed(1))
        : null;
      fila['Promedio'] = promedio !== null ? promedio : '—';
      fila['Nivel'] = promedio !== null ? nivelMEN(promedio) : 'Pendiente';
      return fila;
    });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

    const periodos = [...new Set(reporte.map(r => r.periodo))].sort().join('-');
    const nombreArchivo = `Reporte_${seleccionada.nombre_grupo}_${seleccionada.nombre_materia}_P${periodos}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Panel Docente" />
      <div style={es.contenido}>

        {/* Banner: Hoy */}
        {(() => {
          const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
          const hoyStr = hoy.charAt(0).toUpperCase() + hoy.slice(1);

          // Mapa de asistencia por grupo_id
          const asistenciaMap = {};
          resumenHoy.forEach(g => { asistenciaMap[g.grupo_id] = g; });

          // Si hay horario configurado para hoy → mostrarlo enriquecido
          if (clasesHoy.length > 0) {
            const pendientes = clasesHoy.filter(c => !asistenciaMap[c.grupo_id]?.lista_pasada).length;
            return (
              <div style={es.hoyCard}>
                <div style={es.hoyEncabezado}>
                  <span style={es.hoyFecha}>
                    <IconCalendar size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#667eea' }} />
                    {hoyStr}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {pendientes > 0 && (
                      <span style={es.hoyPendienteBadge}>{pendientes} lista{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''}</span>
                    )}
                    <button onClick={() => navigate('/mi-horario')} style={es.btnVerHorario}>
                      Editar horario →
                    </button>
                  </div>
                </div>
                <div style={es.hoyGrupos}>
                  {clasesHoy.map(c => {
                    const asistencia = asistenciaMap[c.grupo_id];
                    const listaPasada = asistencia?.lista_pasada;
                    const hora = c.hora_inicio ? c.hora_inicio.slice(0, 5) + ' – ' + c.hora_fin.slice(0, 5) : '';
                    return (
                      <div key={c.id} style={es.hoyFila}>
                        <span style={{ ...es.hoyEstado, color: listaPasada ? '#2e7d32' : '#e65100' }}>
                          {listaPasada ? <IconCheck size={18} /> : <IconClock size={18} />}
                        </span>
                        {hora && <span style={es.hoyHora}>{hora}</span>}
                        <span style={es.hoyGrupoNombre}>
                          Grado {c.grado}° — {c.nombre_grupo}
                        </span>
                        <span style={es.hoyMateria}>{c.nombre_materia}</span>
                        {!listaPasada ? (
                          <button onClick={() => navigate('/pasar-lista')} style={es.hoyBtnLista}>
                            Pasar lista →
                          </button>
                        ) : (
                          <span style={es.hoyRegistrada}>Lista registrada</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Sin horario configurado → mostrar vista de asistencia clásica (si hay grupos hoy)
          if (resumenHoy.length > 0) {
            const pendientes = resumenHoy.filter(g => !g.lista_pasada).length;
            return (
              <div style={es.hoyCard}>
                <div style={es.hoyEncabezado}>
                  <span style={es.hoyFecha}>
                    <IconCalendar size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: '#667eea' }} />
                    {hoyStr}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {pendientes > 0 && (
                      <span style={es.hoyPendienteBadge}>{pendientes} lista{pendientes !== 1 ? 's' : ''} pendiente{pendientes !== 1 ? 's' : ''}</span>
                    )}
                    <button onClick={() => navigate('/mi-horario')} style={es.btnVerHorario}>
                      Configurar horario →
                    </button>
                  </div>
                </div>
                <div style={es.hoyGrupos}>
                  {resumenHoy.map(g => (
                    <div key={g.grupo_id} style={es.hoyFila}>
                      <span style={{ ...es.hoyEstado, color: g.lista_pasada ? '#2e7d32' : '#e65100' }}>
                        {g.lista_pasada ? <IconCheck size={18} /> : <IconClock size={18} />}
                      </span>
                      <span style={es.hoyGrupoNombre}>Grado {g.grado}° — {g.nombre_grupo}</span>
                      {!g.lista_pasada ? (
                        <button onClick={() => navigate('/pasar-lista')} style={es.hoyBtnLista}>
                          Pasar lista →
                        </button>
                      ) : (
                        <span style={es.hoyRegistrada}>Lista registrada</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Banner de alertas */}
        {alertas.length > 0 && (
          <div style={es.alertaBanner}>
            <button onClick={() => setAlertasAbiertas(a => !a)} style={es.alertaEncabezado}>
              <IconAlertTriangle size={18} style={{ color: '#f57f17', flexShrink: 0 }} />
              <span style={es.alertaTexto}>
                <strong>{estudiantesEnRiesgo} {estudiantesEnRiesgo === 1 ? 'estudiante en riesgo' : 'estudiantes en riesgo'}</strong>
                <span> — nota menor a 3.5 en 2 o más actividades de la misma materia ({alertas.length} {alertas.length === 1 ? 'caso' : 'casos'})</span>
              </span>
              <span style={es.alertaFlecha}>{alertasAbiertas ? '▲' : '▼'}</span>
            </button>
            {alertasAbiertas && (
              <div style={es.alertaLista}>
                {alertas.map((a, i) => (
                  <div key={i} style={es.alertaFila}>
                    <span style={es.alertaNombre}>{a.nombre_estudiante}</span>
                    <span style={es.alertaDetalle}>
                      {a.nombre_materia} · Grado {a.grado}° {a.nombre_grupo}
                    </span>
                    <span style={es.alertaBadge}>{a.actividades_bajo} actividades bajo 3.5</span>
                    <span style={es.alertaNota}>Peor nota: {a.peor_nota}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Planes de mejoramiento de los estudiantes */}
        {planes.length > 0 && (
          <div style={es.planBanner}>
            <button onClick={() => setPlanesAbiertos(a => !a)} style={es.planEncabezado}>
              <IconClipboard size={18} style={{ color: '#e65100', flexShrink: 0 }} />
              <span style={es.planTextoHeader}>
                <strong>{planes.length} {planes.length === 1 ? 'estudiante tiene' : 'estudiantes tienen'} plan de mejoramiento activo</strong>
                <span> — revisa los diagnósticos y haz seguimiento</span>
              </span>
              <span style={es.planFlecha}>{planesAbiertos ? '▲' : '▼'}</span>
            </button>
            {planesAbiertos && (
              <div style={es.planLista}>
                {planes.map((p, i) => (
                  <div key={p.id} style={es.planFila}>
                    <span style={es.planNombre}>{p.estudiante}</span>
                    <span style={es.planDetalle}>{p.materia} · Grado {p.grado}° {p.grupo} · P{p.periodo}</span>
                    <span style={es.planDiag}>{p.diagnostico}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones rápidas */}
        <div style={es.accionesGrid}>
          <button onClick={() => navigate('/crear-actividad')} style={es.btnAccion}>
            <IconEdit size={26} style={{ color: '#667eea' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Crear actividad</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Nueva actividad para tus grupos</span>
          </button>
          <button onClick={() => navigate('/mis-actividades')} style={es.btnAccion}>
            <IconClipboard size={26} style={{ color: '#667eea' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Mis actividades</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Ver estadísticas y gestionar</span>
          </button>
          <button onClick={() => navigate('/pasar-lista')} style={es.btnAccion}>
            <IconCheckSquare size={26} style={{ color: '#667eea' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Pasar lista</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Registrar asistencia del día</span>
          </button>
          <button onClick={() => navigate('/copiloto-docente')} style={{ ...es.btnAccion, background: 'linear-gradient(135deg, #667eea11, #764ba211)', border: '2px solid #e8eaf6' }}>
            <IconZap size={26} style={{ color: '#667eea' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Copiloto IA</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Analiza tus grupos con IA</span>
          </button>
          <button onClick={() => navigate('/banco-actividades')} style={{ ...es.btnAccion, background: 'linear-gradient(135deg, #f093fb11, #f5576c11)', border: '2px solid #fce4ec' }}>
            <IconGrid size={26} style={{ color: '#e91e63' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Banco de actividades</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Usa actividades de tus colegas</span>
          </button>
          <button onClick={() => navigate('/mi-horario')} style={{ ...es.btnAccion, background: 'linear-gradient(135deg, #43e97b11, #38f9d711)', border: '2px solid #e0f7fa' }}>
            <IconCalendar size={26} style={{ color: '#00897b' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>Mi horario</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Configura tus clases por día</span>
          </button>
          <button onClick={() => navigate('/piar')} style={{ ...es.btnAccion, background: 'linear-gradient(135deg, #26a69a11, #00695c11)', border: '2px solid #e0f2f1' }}>
            <IconAccessibility size={26} style={{ color: '#00695c' }} />
            <span style={{ fontWeight: '700', fontSize: '15px' }}>PIAR</span>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Ajustes razonables (Decreto 1421)</span>
          </button>
        </div>

        {/* Grupos y materias asignados */}
        <h3 style={es.seccionTitulo}>Mis grupos y materias</h3>

        {cargando ? (
          <p style={es.textoGris}>Cargando...</p>
        ) : asignaciones.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={40} style={{ color: '#ccc' }} />
            <p>No tienes grupos asignados aún. Contacta al administrador.</p>
          </div>
        ) : (
          <>
            <div style={es.materiasGrid}>
              {asignaciones.map(asig => (
                <button
                  key={asig.id}
                  onClick={() => verEstudiantes(asig)}
                  style={{ ...es.materiaCard, ...(seleccionada?.id === asig.id ? es.materiaCardActiva : {}) }}
                >
                  <IconBookOpen size={22} style={{ color: '#667eea' }} />
                  <span style={es.materiaNombre}>{asig.nombre_materia}</span>
                  <span style={es.materiaGrupoInfo}>Grado {asig.grado}° — {asig.nombre_grupo}</span>
                  <span style={es.materiaCodigo}>{asig.codigo}</span>
                  <span style={es.materiaVer}>{seleccionada?.id === asig.id ? 'Cerrar ▲' : 'Ver estudiantes ▼'}</span>
                </button>
              ))}
            </div>

            {/* Panel de estudiantes */}
            {seleccionada && (
              <div style={es.panel}>
                <div style={es.panelEncabezado}>
                  <h5 style={es.panelTitulo}>
                    Progreso de estudiantes — {seleccionada.nombre_materia} en {seleccionada.grado}° {seleccionada.nombre_grupo}
                  </h5>
                  {!cargandoReporte && reporte.length > 0 && (
                    <button onClick={exportarExcel} style={es.btnExcel}>
                      <IconDownload size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Exportar Excel
                    </button>
                  )}
                </div>
                {cargandoReporte ? (
                  <p style={es.textoGris}>Cargando datos...</p>
                ) : reporte.length === 0 ? (
                  <p style={es.textoGris}>No hay actividades asignadas o estudiantes en este grupo.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={es.tabla}>
                      <thead>
                        <tr>
                          <th style={es.th}>Estudiante</th>
                          <th style={es.th}>Actividad</th>
                          <th style={es.th}>Periodo</th>
                          <th style={es.th}>Nota</th>
                          <th style={es.th}>Desempeño</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporte.map((r, i) => (
                          <tr key={i} style={es.tr}>
                            <td style={es.td}>{r.nombre_estudiante}</td>
                            <td style={es.td}>{r.titulo}</td>
                            <td style={es.td}>Periodo {r.periodo}</td>
                            <td style={{ ...es.td, fontWeight: '700', color: '#667eea' }}>
                              {r.nota !== null ? r.nota : '—'}
                            </td>
                            <td style={es.td}>
                              <span style={{
                                padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                background: NIVEL_COLOR[r.nivel_desempeno] || '#f5f5f5',
                                color: NIVEL_TEXTO[r.nivel_desempeno] || '#888'
                              }}>
                                {r.nivel_desempeno}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  alertaBanner: { background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' },
  alertaEncabezado: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  alertaTexto: { flex: 1, fontSize: '14px', color: '#e65100' },
  alertaFlecha: { fontSize: '12px', color: '#f57f17', fontWeight: '700' },
  alertaLista: { borderTop: '1px solid #ffe0b2', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  alertaFila: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '8px 12px', background: '#fff', borderRadius: '8px' },
  alertaNombre: { fontWeight: '700', fontSize: '14px', color: '#333', minWidth: '160px' },
  alertaDetalle: { fontSize: '13px', color: '#888', flex: 1 },
  alertaBadge: { background: '#ffccbc', color: '#bf360c', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '600' },
  alertaNota: { fontSize: '13px', fontWeight: '700', color: '#c62828' },
  accionesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' },
  btnAccion: {
    background: '#fff', border: 'none', borderRadius: '16px', padding: '24px',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
    cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    borderTop: '4px solid #667eea', fontFamily: 'inherit',
  },
  seccionTitulo: { fontSize: '17px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  materiasGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '0' },
  materiaCard: {
    background: '#fff', border: '2px solid #e8e8e8', borderRadius: '12px',
    padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: '4px',
    fontFamily: 'inherit',
  },
  materiaCardActiva: { borderColor: '#667eea', background: '#f0f0ff' },
  materiaNombre: { fontWeight: '700', fontSize: '15px', color: '#333' },
  materiaGrupoInfo: { fontSize: '12px', color: '#667eea', fontWeight: '600' },
  materiaCodigo: { fontSize: '12px', color: '#888' },
  materiaVer: { fontSize: '12px', color: '#667eea', marginTop: '4px' },
  panel: { background: '#fff', borderRadius: '12px', padding: '20px', marginTop: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  panelEncabezado: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  panelTitulo: { fontSize: '14px', fontWeight: '700', color: '#555', margin: 0 },
  btnExcel: {
    background: 'linear-gradient(135deg, #43a047, #2e7d32)', color: '#fff',
    border: 'none', borderRadius: '8px', padding: '8px 16px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
  },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },

  // Hoy
  hoyCard: { background: '#fff', borderRadius: '14px', padding: '18px 20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: '4px solid #667eea' },
  hoyEncabezado: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  hoyFecha: { fontSize: '14px', fontWeight: '700', color: '#333' },
  hoyPendienteBadge: { background: '#fff3e0', color: '#e65100', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' },
  hoyGrupos: { display: 'flex', flexDirection: 'column', gap: '8px' },
  hoyFila: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: '#fafafa' },
  hoyEstado: { fontSize: '18px', flexShrink: 0 },
  hoyGrupoNombre: { flex: 1, fontSize: '14px', fontWeight: '600', color: '#333' },
  hoyBtnLista: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  hoyRegistrada: { fontSize: '12px', color: '#aaa', fontStyle: 'italic' },
  hoyHora: { fontSize: '12px', color: '#888', fontWeight: 700, background: '#f0f0f0', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' },
  hoyMateria: { fontSize: '13px', color: '#667eea', fontWeight: 600, flex: 1 },
  btnVerHorario: { background: 'none', border: '1px solid #667eea', color: '#667eea', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  textoGris: { color: '#888', fontSize: '14px' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: '#666', borderBottom: '2px solid #f0f0f0' },
  tr: { borderBottom: '1px solid #f5f5f5' },
  td: { padding: '10px 12px', fontSize: '14px', color: '#333' },

  // Planes de mejoramiento
  planBanner: { background: '#fff8e1', border: '2px solid #ffe082', borderRadius: '12px', marginBottom: '20px', overflow: 'hidden' },
  planEncabezado: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  planIcono: { fontSize: '20px', flexShrink: 0 },
  planTextoHeader: { flex: 1, fontSize: '14px', color: '#555' },
  planFlecha: { fontSize: '12px', color: '#e65100', fontWeight: '700' },
  planLista: { borderTop: '1px solid #ffe082', padding: '8px 0' },
  planFila: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 18px', borderBottom: '1px solid #fff3cd' },
  planNombre: { fontSize: '14px', fontWeight: '700', color: '#333', minWidth: 140 },
  planDetalle: { fontSize: '13px', color: '#888' },
  planDiag: { fontSize: '12px', color: '#e65100', background: '#fff3e0', borderRadius: 6, padding: '3px 8px', fontWeight: 600 },
};
