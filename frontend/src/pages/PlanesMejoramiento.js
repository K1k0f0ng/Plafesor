import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { SemaforoDot, IconClipboard, IconBot, IconBookOpen, IconUsers, IconClock, IconInbox } from '../components/Icons';

const NIVEL_BADGE = {
  critico: { bg: '#ffcdd2', color: '#c62828', dot: '#c62828', label: 'Crítico' },
  alto:    { bg: '#ffe0b2', color: '#e65100', dot: '#e65100', label: 'Alto'    },
  medio:   { bg: '#fff9c4', color: '#f57f17', dot: '#f57f17', label: 'Medio'   },
  bajo:    { bg: '#c8e6c9', color: '#2e7d32', dot: '#2e7d32', label: 'Bajo'    },
};

const ESTADO_BADGE = {
  activo:    { bg: '#e3f2fd', color: '#1565c0', label: 'Activo' },
  superado:  { bg: '#e8f5e9', color: '#2e7d32', label: '✓ Superado' },
  archivado: { bg: '#f5f5f5', color: '#757575', label: 'Archivado' },
};

export default function PlanesMejoramiento() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState('activo');
  const [expandido, setExpandido] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get(
        `/api/planes/colegio/${usuario.colegio_id}?estado=${estadoFiltro}`
      );
      setPlanes(resp.data.data);
    } catch {
      setError('No se pudieron cargar los planes.');
    } finally {
      setCargando(false);
    }
  }, [usuario.colegio_id, estadoFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  async function generarTodos() {
    setGenerando(true);
    setMensaje('');
    setError('');
    try {
      const resp = await axiosAuth.post(`/api/planes/generar-colegio/${usuario.colegio_id}`);
      const n = resp.data.data?.generados ?? 0;
      setMensaje(n === 0
        ? 'Todos los estudiantes en riesgo ya tienen un plan activo reciente.'
        : `${n} plan(es) nuevo(s) generado(s) con IA.`
      );
      await cargar();
    } catch {
      setError('Error al generar los planes. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  }

  async function cambiarEstado(id, nuevoEstado) {
    try {
      await axiosAuth.put(`/api/planes/${id}/estado`, { estado: nuevoEstado });
      await cargar();
    } catch {
      setError('Error al actualizar el estado.');
    }
  }

  const conteos = { activo: 0, superado: 0, archivado: 0 };
  planes.forEach(p => { if (conteos[p.estado] !== undefined) conteos[p.estado]++; });

  return (
    <div style={es.pagina}>
      <Navbar titulo="Planes de Mejoramiento" />
      <div style={es.contenido}>

        {/* Encabezado */}
        <div style={es.header}>
          <div>
            <button onClick={() => navigate('/dashboard-director')} style={es.btnVolver}>← Volver</button>
            <h2 style={es.titulo}><IconClipboard size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#667eea' }} />Planes de Mejoramiento</h2>
            <p style={es.subtitulo}>Generados automáticamente para estudiantes en riesgo alto o crítico</p>
          </div>
          <button onClick={generarTodos} disabled={generando} style={es.btnGenerar}>
            {generando ? 'Generando...' : <><IconBot size={14} style={{ marginRight: 6 }} />Generar planes para críticos</>}
          </button>
        </div>

        {/* Mensajes */}
        {mensaje && <div style={es.exito}>{mensaje}</div>}
        {error   && <div style={es.errorBox}>{error}</div>}

        {/* Filtros */}
        <div style={es.filtros}>
          {['activo', 'superado', 'archivado'].map(e => (
            <button key={e} onClick={() => setEstadoFiltro(e)}
              style={{ ...es.filtroBton, ...(estadoFiltro === e ? es.filtroBtonActivo : {}) }}>
              {ESTADO_BADGE[e].label}
              <span style={es.filtroCount}>{conteos[e]}</span>
            </button>
          ))}
        </div>

        {/* Lista de planes */}
        {cargando ? (
          <div style={es.sinDatos}>Cargando planes...</div>
        ) : planes.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={40} style={{ color: '#ccc' }} />
            <p>No hay planes con estado "{estadoFiltro}".</p>
            {estadoFiltro === 'activo' && (
              <p style={{ color: '#999', fontSize: 13 }}>
                Los planes se generan automáticamente cada noche para estudiantes en riesgo alto o crítico,
                o puedes usar el botón "Generar planes para críticos".
              </p>
            )}
          </div>
        ) : (
          <div style={es.lista}>
            {planes.map(plan => {
              const nivel = NIVEL_BADGE[plan.nivel] || NIVEL_BADGE.bajo;
              const abierto = expandido === plan.id;

              return (
                <div key={plan.id} style={es.card}>
                  {/* Cabecera de la card */}
                  <div style={es.cardHeader}>
                    <div style={es.cardInfo}>
                      <span style={es.nombreEstudiante}>{plan.estudiante}</span>
                      <span style={es.badgePeriodo}>Período {plan.periodo}</span>
                      {plan.nivel && (
                        <span style={{ ...es.badge, background: nivel.bg, color: nivel.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <SemaforoDot color={nivel.dot} size={8} />{nivel.label} · {plan.score}pts
                        </span>
                      )}
                    </div>
                    <div style={es.cardMeta}>
                      <span style={es.metaItem}><IconBookOpen size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{plan.materia}</span>
                      <span style={es.metaItem}><IconUsers size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{plan.grado}° {plan.grupo}</span>
                      <span style={es.metaItem}>
                        <IconClock size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{new Date(plan.generado_en).toLocaleDateString('es-CO')}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <div style={es.diagnostico}>
                    <span style={es.diagLabel}>Diagnóstico:</span> {plan.diagnostico}
                  </div>

                  {/* Plan expandible */}
                  <button onClick={() => setExpandido(abierto ? null : plan.id)} style={es.btnExpandir}>
                    {abierto ? '▲ Ocultar plan completo' : '▼ Ver plan de mejoramiento'}
                  </button>

                  {abierto && plan.plan_texto && (
                    <div style={es.planTexto}>
                      {plan.plan_texto.split('\n').map((linea, i) => {
                        const esTitulo = /^[A-ZÁÉÍÓÚÑ\s]+:/.test(linea.trim()) && linea.trim().length < 40;
                        return (
                          <p key={i} style={esTitulo ? es.planSeccion : es.planLinea}>
                            {linea || ' '}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* Acciones */}
                  {estadoFiltro === 'activo' && (
                    <div style={es.acciones}>
                      <button onClick={() => cambiarEstado(plan.id, 'superado')} style={es.btnSuperado}>
                        ✓ Marcar como superado
                      </button>
                      <button onClick={() => cambiarEstado(plan.id, 'archivado')} style={es.btnArchivar}>
                        Archivar
                      </button>
                    </div>
                  )}
                  {estadoFiltro === 'superado' && (
                    <div style={es.acciones}>
                      <button onClick={() => cambiarEstado(plan.id, 'activo')} style={es.btnReactivar}>
                        Reactivar
                      </button>
                    </div>
                  )}
                  {estadoFiltro === 'archivado' && (
                    <div style={es.acciones}>
                      <button onClick={() => cambiarEstado(plan.id, 'activo')} style={es.btnReactivar}>
                        Reactivar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina:    { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, fontFamily: 'inherit', marginBottom: 6 },
  titulo:    { fontSize: 22, fontWeight: 800, color: '#333', margin: '0 0 4px' },
  subtitulo: { fontSize: 13, color: '#888', margin: 0 },
  btnGenerar: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: 12,
    padding: '12px 20px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center',
  },
  exito:    { background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  filtros:      { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  filtroBton:   { padding: '8px 18px', borderRadius: 20, border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#666', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 },
  filtroBtonActivo: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderColor: '#667eea', color: '#fff' },
  filtroCount: { background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 },
  sinDatos:  { background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  lista:     { display: 'flex', flexDirection: 'column', gap: 16 },
  card:      { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  cardHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  cardInfo:  { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nombreEstudiante: { fontSize: 16, fontWeight: 800, color: '#333' },
  badgePeriodo: { background: '#f0f0ff', color: '#667eea', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  badge:     { borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  cardMeta:  { display: 'flex', gap: 14, flexWrap: 'wrap' },
  metaItem:  { fontSize: 13, color: '#666' },
  diagnostico: { background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#444', marginBottom: 10 },
  diagLabel: { fontWeight: 700, color: '#667eea' },
  btnExpandir: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 0', fontFamily: 'inherit', textAlign: 'left' },
  planTexto: { background: '#f8f9fa', borderRadius: 10, padding: 16, marginTop: 10, borderLeft: '4px solid #667eea' },
  planSeccion: { fontWeight: 800, color: '#333', fontSize: 13, margin: '12px 0 4px', letterSpacing: '0.3px' },
  planLinea:   { fontSize: 13, color: '#555', margin: '2px 0', lineHeight: 1.6 },
  acciones:  { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  btnSuperado:  { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnArchivar:  { background: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnReactivar: { background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
