import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconClipboard, IconInbox } from '../components/Icons';

const ESTADOS = [
  { valor: 'presente',    etiqueta: 'Presente',    color: '#2e7d32', fondo: '#e8f5e9' },
  { valor: 'ausente',     etiqueta: 'Ausente',     color: '#c62828', fondo: '#ffebee' },
  { valor: 'tardanza',    etiqueta: 'Tardanza',    color: '#e65100', fondo: '#fff3e0' },
  { valor: 'justificado', etiqueta: 'Justificado', color: '#1565c0', fondo: '#e3f2fd' },
];

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

export default function PasarLista() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState('');
  const [fecha, setFecha] = useState(fechaHoy());
  const [estudiantes, setEstudiantes] = useState([]);
  const [yaRegistrada, setYaRegistrada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');
  const [notificando, setNotificando] = useState(false);
  const [resultadoNotif, setResultadoNotif] = useState(null);

  // Cargar grupos únicos del docente
  useEffect(() => {
    axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`)
      .then(resp => {
        const vistos = new Set();
        const unicos = resp.data.data.filter(a => {
          if (vistos.has(a.grupo_id)) return false;
          vistos.add(a.grupo_id);
          return true;
        });
        setGrupos(unicos);
      })
      .catch(() => setError('No se pudieron cargar los grupos'));
  }, [usuario.id]);

  // Cargar estudiantes cuando cambia grupo o fecha
  useEffect(() => {
    if (!grupoId || !fecha) return;
    setCargando(true);
    setExito(false);
    setError('');
    axiosAuth.get(`/api/asistencias/grupo/${grupoId}?fecha=${fecha}`)
      .then(resp => {
        const datos = resp.data.data;
        const tieneRegistros = datos.some(e => e.estado !== 'pendiente');
        setYaRegistrada(tieneRegistros);
        setEstudiantes(
          datos.map(e => ({ ...e, estado: e.estado === 'pendiente' ? 'presente' : e.estado }))
        );
      })
      .catch(() => setError('Error al cargar los estudiantes'))
      .finally(() => setCargando(false));
  }, [grupoId, fecha]);

  function cambiarEstado(estudianteId, nuevoEstado) {
    setEstudiantes(prev =>
      prev.map(e => e.estudiante_id === estudianteId ? { ...e, estado: nuevoEstado } : e)
    );
    setExito(false);
  }

  function marcarTodosPresentes() {
    setEstudiantes(prev => prev.map(e => ({ ...e, estado: 'presente' })));
    setExito(false);
  }

  async function guardar() {
    if (!grupoId || !fecha || estudiantes.length === 0) return;
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.post('/api/asistencias', {
        grupo_id: parseInt(grupoId),
        fecha,
        registros: estudiantes.map(e => ({ estudiante_id: e.estudiante_id, estado: e.estado })),
      });
      setExito(true);
      setYaRegistrada(true);
      setResultadoNotif(null);
    } catch {
      setError('Error al guardar la asistencia');
    } finally {
      setGuardando(false);
    }
  }

  async function notificarAusentes() {
    setNotificando(true);
    setResultadoNotif(null);
    try {
      const resp = await axiosAuth.post('/api/whatsapp/notificar-ausentes', {
        grupo_id: parseInt(grupoId),
        fecha,
      });
      setResultadoNotif(resp.data.data);
    } catch {
      setResultadoNotif({ error: true });
    } finally {
      setNotificando(false);
    }
  }

  const conteos = ESTADOS.reduce((acc, est) => {
    acc[est.valor] = estudiantes.filter(e => e.estado === est.valor).length;
    return acc;
  }, {});

  const grupoSeleccionado = grupos.find(g => String(g.grupo_id) === String(grupoId));

  return (
    <div style={es.pagina}>
      <Navbar titulo="Pasar lista" />
      <div style={es.contenido}>

        <button onClick={() => navigate('/dashboard-docente')} style={es.btnVolver}>
          ← Volver al panel
        </button>

        {/* Selectores */}
        <div style={es.selectores}>
          <div style={es.campo}>
            <label style={es.label}>Grupo</label>
            <select value={grupoId} onChange={e => setGrupoId(e.target.value)} style={es.select}>
              <option value="">— Selecciona un grupo —</option>
              {grupos.map(g => (
                <option key={g.grupo_id} value={g.grupo_id}>
                  Grado {g.grado}° — {g.nombre_grupo}
                </option>
              ))}
            </select>
          </div>
          <div style={es.campoFecha}>
            <label style={es.label}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={es.select}
            />
          </div>
        </div>

        {/* Estado: ya registrada */}
        {yaRegistrada && (
          <div style={es.yaRegistradaBanner}>
            Esta lista ya fue guardada — puedes editarla y volver a guardar
          </div>
        )}

        {/* Error */}
        {error && <div style={es.errorBox}>{error}</div>}

        {/* Placeholder sin grupo */}
        {!grupoId && (
          <div style={es.placeholder}>
            <IconClipboard size={52} style={{ color: '#ccc' }} />
            <p style={{ color: '#888', margin: 0 }}>Selecciona un grupo para comenzar</p>
          </div>
        )}

        {/* Cargando */}
        {grupoId && cargando && (
          <p style={es.textoGris}>Cargando estudiantes...</p>
        )}

        {/* Lista */}
        {grupoId && !cargando && estudiantes.length === 0 && (
          <div style={es.placeholder}>
            <IconInbox size={52} style={{ color: '#ccc' }} />
            <p style={{ color: '#888', margin: 0 }}>No hay estudiantes en este grupo</p>
          </div>
        )}

        {grupoId && !cargando && estudiantes.length > 0 && (
          <>
            {/* Resumen + botón todos presentes */}
            <div style={es.resumenRow}>
              {ESTADOS.map(est => (
                <div key={est.valor} style={{ ...es.chip, background: est.fondo, color: est.color }}>
                  <span style={es.chipNum}>{conteos[est.valor]}</span>
                  <span style={es.chipLabel}>{est.etiqueta}</span>
                </div>
              ))}
              <button onClick={marcarTodosPresentes} style={es.btnTodos}>
                Todos presentes
              </button>
            </div>

            {/* Tabla de estudiantes */}
            <div style={es.card}>
              <div style={es.cardHeader}>
                <span style={es.headerNombre}>
                  {grupoSeleccionado ? `Grado ${grupoSeleccionado.grado}° — ${grupoSeleccionado.nombre_grupo}` : ''}
                </span>
                <span style={es.headerCuenta}>{estudiantes.length} estudiantes</span>
              </div>

              {estudiantes.map((est, idx) => (
                <div key={est.estudiante_id} style={{ ...es.fila, background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <span style={es.nombre}>{est.nombre}</span>
                  <div style={es.botones}>
                    {ESTADOS.map(e => (
                      <button
                        key={e.valor}
                        onClick={() => cambiarEstado(est.estudiante_id, e.valor)}
                        style={{
                          ...es.btnEstado,
                          background: est.estado === e.valor ? e.color : '#f0f0f0',
                          color: est.estado === e.valor ? '#fff' : '#888',
                          fontWeight: est.estado === e.valor ? '700' : '500',
                        }}
                      >
                        {e.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div style={es.footer}>
                {exito && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <span style={es.exitoMsg}>Lista guardada correctamente</span>
                    {conteos.ausente > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={notificarAusentes}
                          disabled={notificando}
                          style={es.btnNotificar}
                        >
                          {notificando ? 'Enviando...' : `Notificar padres de ausentes (${conteos.ausente})`}
                        </button>
                        {resultadoNotif && !resultadoNotif.error && (
                          <span style={es.resultadoNotif}>
                            {resultadoNotif.enviados} enviado{resultadoNotif.enviados !== 1 ? 's' : ''}
                            {resultadoNotif.sin_telefono > 0 && ` · ${resultadoNotif.sin_telefono} sin teléfono`}
                          </span>
                        )}
                        {resultadoNotif?.error && (
                          <span style={{ fontSize: '13px', color: '#c62828' }}>Error al enviar. Verifica la configuración de WhatsApp.</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={guardar} disabled={guardando} style={es.btnGuardar}>
                  {guardando ? 'Guardando...' : 'Guardar lista'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '860px', margin: '0 auto' },
  btnVolver: {
    background: 'none', border: 'none', color: '#667eea',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    padding: '0 0 20px', fontFamily: 'inherit', display: 'block',
  },
  selectores: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
  campo: { flex: 2, minWidth: '220px' },
  campoFecha: { flex: 1, minWidth: '160px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '6px' },
  select: {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '2px solid #e0e0e0', fontSize: '14px',
    fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
  },
  yaRegistradaBanner: {
    background: '#e8f5e9', color: '#2e7d32', borderRadius: '10px',
    padding: '10px 16px', fontSize: '13px', fontWeight: '600',
    marginBottom: '16px',
  },
  errorBox: {
    background: '#fff0f0', color: '#c62828', borderRadius: '10px',
    padding: '12px 16px', marginBottom: '16px', fontSize: '14px',
  },
  placeholder: {
    background: '#fff', borderRadius: '16px', padding: '60px',
    textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
  textoGris: { color: '#888', fontSize: '14px' },
  resumenRow: {
    display: 'flex', gap: '10px', alignItems: 'center',
    flexWrap: 'wrap', marginBottom: '16px',
  },
  chip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '10px 16px', borderRadius: '12px', minWidth: '76px',
  },
  chipNum: { fontSize: '22px', fontWeight: '800', lineHeight: 1 },
  chipLabel: { fontSize: '11px', fontWeight: '600', marginTop: '2px' },
  btnTodos: {
    background: '#e8f5e9', color: '#2e7d32', border: 'none',
    borderRadius: '10px', padding: '10px 16px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto',
  },
  card: {
    background: '#fff', borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', background: '#fafafa',
    borderBottom: '2px solid #f0f0f0',
  },
  headerNombre: { fontSize: '14px', fontWeight: '700', color: '#444' },
  headerCuenta: { fontSize: '13px', color: '#888' },
  fila: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 20px', borderBottom: '1px solid #f0f0f0',
    gap: '12px', flexWrap: 'wrap',
  },
  nombre: { fontSize: '14px', fontWeight: '600', color: '#333', flex: 1, minWidth: '140px' },
  botones: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  btnEstado: {
    border: 'none', borderRadius: '8px', padding: '6px 11px',
    fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.12s',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '16px', padding: '16px 20px',
    borderTop: '2px solid #f0f0f0', flexWrap: 'wrap',
  },
  exitoMsg: { fontSize: '14px', color: '#2e7d32', fontWeight: '600' },
  btnGuardar: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '12px 28px', fontSize: '14px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnNotificar: {
    background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7',
    borderRadius: '10px', padding: '8px 16px', fontSize: '13px',
    fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
  },
  resultadoNotif: { fontSize: '13px', color: '#2e7d32', fontWeight: '600' },
};
