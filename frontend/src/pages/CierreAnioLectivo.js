import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconCalendar, IconInbox } from '../components/Icons';

/* Estado por defecto de cada estudiante: si hay grado siguiente, se asume
   que pasa; si no (grado 11, tope del sistema), se asume que egresa. El
   director solo tiene que tocar las excepciones ("repite"). */
function accionPorDefecto(grupo) {
  return grupo.grado_siguiente ? 'promovido' : 'egresa';
}

export default function CierreAnioLectivo() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [anio, setAnio] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [decisiones, setDecisiones] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/anios-lectivos/cierre/resumen');
      const { anio: anioActivo, grupos: gruposResp } = resp.data.data;
      setAnio(anioActivo);
      setGrupos(gruposResp);

      const inicial = {};
      for (const g of gruposResp) {
        const acciones = {};
        for (const est of g.estudiantes) acciones[est.id] = accionPorDefecto(g);
        inicial[g.id] = {
          destinoPromovidosNombre: g.grado_siguiente ? `${g.grado_siguiente}-1` : '',
          destinoRepitentesNombre: `${g.grado}-repite`,
          acciones,
        };
      }
      setDecisiones(inicial);
    } catch {
      setError('No se pudo cargar la información para el cierre de año lectivo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function cambiarAccion(grupoId, estudianteId, accion) {
    setDecisiones(prev => ({
      ...prev,
      [grupoId]: { ...prev[grupoId], acciones: { ...prev[grupoId].acciones, [estudianteId]: accion } },
    }));
  }

  function cambiarNombreDestino(grupoId, campo, valor) {
    setDecisiones(prev => ({ ...prev, [grupoId]: { ...prev[grupoId], [campo]: valor } }));
  }

  const totales = grupos.reduce((acc, g) => {
    const d = decisiones[g.id];
    if (!d) return acc;
    for (const accion of Object.values(d.acciones)) acc[accion] = (acc[accion] || 0) + 1;
    return acc;
  }, {});

  async function handleConfirmar() {
    setEnviando(true);
    setError('');
    try {
      const payload = {
        decisiones: grupos.map(g => {
          const d = decisiones[g.id];
          const hayPromovidos = Object.values(d.acciones).some(a => a === 'promovido');
          const hayRepitentes = Object.values(d.acciones).some(a => a === 'repite');
          return {
            grupo_origen_id: g.id,
            destino_promovidos: hayPromovidos
              ? { modo: 'nuevo', nombre: d.destinoPromovidosNombre, grado: g.grado_siguiente }
              : null,
            destino_repitentes: hayRepitentes
              ? { modo: 'nuevo', nombre: d.destinoRepitentesNombre, grado: g.grado }
              : null,
            estudiantes: g.estudiantes.map(est => ({ estudiante_id: est.id, accion: d.acciones[est.id] })),
          };
        }),
      };
      const resp = await axiosAuth.post('/api/anios-lectivos/cierre', payload);
      setResultado(resp.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cerrar el año lectivo');
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Cierre de año lectivo" />
        <div style={es.contenido}>
          <div style={es.card}>
            <h2 style={es.titulo}>Año lectivo {resultado.anio_cerrado} cerrado</h2>
            <p style={es.subtitulo}>Se creó el año lectivo {resultado.anio_nuevo}.</p>
            <div style={es.resumenGrid}>
              <div style={es.resumenItem}><strong style={es.resumenItemValor}>{resultado.promovidos}</strong><span>Promovidos</span></div>
              <div style={es.resumenItem}><strong style={es.resumenItemValor}>{resultado.repiten}</strong><span>Repiten</span></div>
              <div style={es.resumenItem}><strong style={es.resumenItemValor}>{resultado.egresan}</strong><span>Egresan</span></div>
            </div>
            <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnPrimario}>
              Volver al panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Cierre de año lectivo" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCalendar size={20} style={{ color: '#667eea' }} />
            Cierre de año lectivo {anio ? anio.anio : ''}
          </h2>
          <p style={es.subtitulo}>
            Por defecto todos los estudiantes quedan como "Promovido" (o "Egresa" si su grado es el último del sistema).
            Marca solo las excepciones — los estudiantes que repiten el año.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando información del año lectivo...</div>
        ) : grupos.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={48} style={{ color: '#ccc' }} />
            <p>No hay grupos activos en el año lectivo actual.</p>
          </div>
        ) : (
          <>
            {grupos.map(g => {
              const d = decisiones[g.id];
              if (!d) return null;
              const hayRepitentes = Object.values(d.acciones).some(a => a === 'repite');
              return (
                <div key={g.id} style={es.card}>
                  <div style={es.grupoHead}>
                    <h3 style={es.grupoTitulo}>{g.nombre} — Grado {g.grado}°</h3>
                    <span style={es.grupoFlecha}>
                      → {g.grado_siguiente ? `Grado ${g.grado_siguiente}°` : 'Egresa (no hay grado siguiente en el sistema)'}
                    </span>
                  </div>

                  {g.grado_siguiente && (
                    <div style={es.campoInline}>
                      <label style={es.label}>Grupo destino para promovidos</label>
                      <input
                        style={es.input}
                        value={d.destinoPromovidosNombre}
                        onChange={e => cambiarNombreDestino(g.id, 'destinoPromovidosNombre', e.target.value)}
                        placeholder={`Ej: ${g.grado_siguiente}-1`}
                      />
                    </div>
                  )}

                  <div style={es.listaEstudiantes}>
                    {g.estudiantes.map(est => (
                      <div key={est.id} style={es.filaEstudiante}>
                        <span style={es.nombreEstudiante}>{est.nombre}</span>
                        <div style={es.toggleGrupo}>
                          {g.grado_siguiente && (
                            <button
                              onClick={() => cambiarAccion(g.id, est.id, 'promovido')}
                              style={{ ...es.toggleBtn, ...(d.acciones[est.id] === 'promovido' ? es.toggleBtnActivo : {}) }}
                            >
                              Promovido
                            </button>
                          )}
                          {!g.grado_siguiente && (
                            <button
                              onClick={() => cambiarAccion(g.id, est.id, 'egresa')}
                              style={{ ...es.toggleBtn, ...(d.acciones[est.id] === 'egresa' ? es.toggleBtnActivo : {}) }}
                            >
                              Egresa
                            </button>
                          )}
                          <button
                            onClick={() => cambiarAccion(g.id, est.id, 'repite')}
                            style={{ ...es.toggleBtn, ...(d.acciones[est.id] === 'repite' ? es.toggleBtnRepite : {}) }}
                          >
                            Repite
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hayRepitentes && (
                    <div style={{ ...es.campoInline, marginTop: 14 }}>
                      <label style={es.label}>Grupo destino para quienes repiten grado {g.grado}°</label>
                      <input
                        style={es.input}
                        value={d.destinoRepitentesNombre}
                        onChange={e => cambiarNombreDestino(g.id, 'destinoRepitentesNombre', e.target.value)}
                        placeholder={`Ej: ${g.grado}-repite`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div style={es.card}>
              <h3 style={es.grupoTitulo}>Resumen antes de confirmar</h3>
              <div style={es.resumenGrid}>
                <div style={es.resumenItem}><strong style={es.resumenItemValor}>{totales.promovido || 0}</strong><span>Promovidos</span></div>
                <div style={es.resumenItem}><strong style={es.resumenItemValor}>{totales.repite || 0}</strong><span>Repiten</span></div>
                <div style={es.resumenItem}><strong style={es.resumenItemValor}>{totales.egresa || 0}</strong><span>Egresan</span></div>
              </div>

              <label style={es.checkboxFila}>
                <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
                Entiendo que esta acción cierra el año {anio?.anio} (ya no se podrán registrar notas nuevas en él)
                y crea el año {anio ? anio.anio + 1 : ''} con estos estudiantes ya ubicados en sus grupos nuevos.
              </label>

              <button
                onClick={handleConfirmar}
                disabled={!confirmado || enviando}
                style={{ ...es.btnPrimario, opacity: (!confirmado || enviando) ? 0.5 : 1 }}
              >
                {enviando ? 'Cerrando año lectivo...' : `Confirmar cierre de ${anio?.anio || ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },

  card: { background: '#fff', borderRadius: '16px', padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '16px' },
  grupoHead: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' },
  grupoTitulo: { fontSize: '15px', fontWeight: '800', color: '#1a1a2e', margin: 0 },
  grupoFlecha: { fontSize: '13px', color: '#667eea', fontWeight: '600' },

  campoInline: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px', maxWidth: '260px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#666' },
  input: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', outline: 'none' },

  listaEstudiantes: { display: 'flex', flexDirection: 'column', gap: '6px' },
  filaEstudiante: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f5f5f8' },
  nombreEstudiante: { fontSize: '13.5px', color: '#333' },
  toggleGrupo: { display: 'flex', gap: '6px', flexShrink: 0 },
  toggleBtn: { padding: '5px 12px', borderRadius: '999px', border: '1.5px solid #e0e0e0', background: '#fff', color: '#888', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  toggleBtnActivo: { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderColor: 'transparent', color: '#fff' },
  toggleBtnRepite: { background: '#fff3e0', borderColor: '#ffb74d', color: '#e65100' },

  resumenGrid: { display: 'flex', gap: '28px', margin: '16px 0', flexWrap: 'wrap' },
  resumenItem: { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', color: '#888' },
  resumenItemValor: { fontSize: '24px', fontWeight: '800', color: '#1a1a2e' },
  checkboxFila: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#555', lineHeight: 1.5, marginBottom: '16px', cursor: 'pointer' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
