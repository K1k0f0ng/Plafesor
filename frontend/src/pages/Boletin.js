import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconDownload } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

function nombrePeriodo(periodo) {
  return periodo === 'final' ? 'Final (Consolidado)' : `Período ${periodo}`;
}

const NIVEL_COLOR = {
  'Superior':      { bg: '#e3f2fd', text: '#1565c0', borde: '#90caf9' },
  'Alto':          { bg: '#e8f5e9', text: '#2e7d32', borde: '#a5d6a7' },
  'Básico':        { bg: '#fffde7', text: '#f57f17', borde: '#ffe082' },
  'Bajo':          { bg: '#ffebee', text: '#c62828', borde: '#ef9a9a' },
  'Sin calificar': { bg: '#f5f5f5', text: '#9e9e9e', borde: '#e0e0e0' },
};

function ChipNivel({ nivel }) {
  const c = NIVEL_COLOR[nivel] || NIVEL_COLOR['Sin calificar'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: '700',
      background: c.bg, color: c.text, border: `1px solid ${c.borde}`,
    }}>
      {nivel}
    </span>
  );
}

function formatFecha() {
  return new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Componente reutilizable: renderiza el contenido de UN boletín
function RenderBoletin({ b }) {
  return (
    <div style={es.boletin}>
      {/* Encabezado */}
      <div style={es.encabezado}>
        <div style={es.logoCirculo}><img src="/logo-icon.png" alt="Playfesor" style={{ width: '32px', height: '32px' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={es.nombreColegio}>{b.colegio.nombre}</div>
          <div style={es.subtitleColegio}>Boletín de Desempeño Académico · Año 2026</div>
        </div>
        <div style={es.periodoChip}>{nombrePeriodo(b.periodo)}</div>
      </div>

      {b.advertencia && (
        <div style={es.avisoNoDisponible}>{b.advertencia}</div>
      )}

      {/* Datos del estudiante */}
      <div style={es.datosEstudiante}>
        <div style={es.datoItem}>
          <span style={es.datoLabel}>Estudiante</span>
          <span style={es.datoValor}>{formatearApellidoPrimero(b.estudiante.nombre)}</span>
        </div>
        <div style={es.datoItem}>
          <span style={es.datoLabel}>Grado</span>
          <span style={es.datoValor}>{b.grupo.grado}</span>
        </div>
        <div style={es.datoItem}>
          <span style={es.datoLabel}>Grupo</span>
          <span style={es.datoValor}>{b.grupo.nombre}</span>
        </div>
        <div style={es.datoItem}>
          <span style={es.datoLabel}>Fecha</span>
          <span style={es.datoValor}>{formatFecha()}</span>
        </div>
      </div>

      {/* Tabla de materias */}
      <div style={{ marginBottom: '18px' }}>
        <div style={es.seccionTitulo}>Desempeño por Área</div>
        <table style={es.tablaImpresa}>
          <thead>
            <tr style={{ background: '#f8f9ff' }}>
              <th style={es.thImpreso}>Área / Asignatura</th>
              <th style={{ ...es.thImpreso, textAlign: 'center', width: '70px' }}>Nota</th>
              <th style={{ ...es.thImpreso, textAlign: 'center', width: '110px' }}>Desempeño</th>
              <th style={es.thImpreso}>Docente</th>
              <th style={{ ...es.thImpreso, textAlign: 'center', width: '100px' }}>Actividades</th>
            </tr>
          </thead>
          <tbody>
            {b.materias.map(m => (
              <tr key={m.materia_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={es.tdImpreso}>{m.materia_nombre}</td>
                <td style={{ ...es.tdImpreso, textAlign: 'center', fontWeight: '700', fontSize: '15px' }}>
                  {m.nota_promedio ?? (m.pendiente_configuracion ? (
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#e65100' }} title="El docente aún no terminó de configurar los porcentajes de las actividades de este período">
                      Pendiente
                    </span>
                  ) : '—')}
                </td>
                <td style={{ ...es.tdImpreso, textAlign: 'center' }}>
                  <ChipNivel nivel={m.nivel} />
                </td>
                <td style={{ ...es.tdImpreso, color: '#666', fontSize: '12px' }}>
                  {m.docente_nombre || '—'}
                </td>
                <td style={{ ...es.tdImpreso, textAlign: 'center', color: '#888', fontSize: '12px' }}>
                  {m.actividades_calificadas}/{m.total_actividades}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#f8f9ff', borderTop: '2px solid #667eea' }}>
              <td style={{ ...es.tdImpreso, fontWeight: '800', color: '#1a1a2e' }}>PROMEDIO GENERAL</td>
              <td style={{ ...es.tdImpreso, textAlign: 'center', fontWeight: '800', fontSize: '17px', color: '#667eea' }}>
                {b.promedio_general ?? '—'}
              </td>
              <td style={{ ...es.tdImpreso, textAlign: 'center' }}>
                {b.promedio_general != null && <ChipNivel nivel={b.nivel_general} />}
              </td>
              <td style={es.tdImpreso} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Asistencia */}
      <div style={{ marginBottom: '18px' }}>
        <div style={es.seccionTitulo}>Asistencia</div>
        <div style={es.asistenciaGrid}>
          {[
            { num: b.asistencia.presentes,   label: 'Presentes',   color: '#2e7d32' },
            { num: b.asistencia.ausentes,    label: 'Ausencias',   color: '#c62828' },
            { num: b.asistencia.tardanzas,   label: 'Tardanzas',   color: '#f57f17' },
            { num: b.asistencia.justificados,label: 'Justificados',color: '#1565c0' },
            { num: b.asistencia.tasa_asistencia != null ? `${b.asistencia.tasa_asistencia}%` : '—',
              label: 'Tasa', color: '#667eea', destacado: true },
          ].map(({ num, label, color, destacado }) => (
            <div key={label} style={{ ...es.asistenciaCard, ...(destacado ? { background: '#f3f4ff', border: '2px solid #667eea' } : {}) }}>
              <div style={{ ...es.asistenciaNum, color }}>{num}</div>
              <div style={es.asistenciaLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Escala MEN */}
      <div style={es.escalaMEN}>
        <span style={es.escalaTitle}>Escala MEN:</span>
        {[['Superior','≥ 4.6'],['Alto','≥ 4.0'],['Básico','≥ 3.5'],['Bajo','< 3.5']].map(([n, rango]) => {
          const c = NIVEL_COLOR[n];
          return (
            <span key={n} style={{ ...es.escalaItem, background: c.bg, color: c.text, border: `1px solid ${c.borde}` }}>
              {n} {rango}
            </span>
          );
        })}
      </div>

      {/* Observaciones */}
      <div style={es.observaciones}>
        <div style={{ fontWeight: '700', fontSize: '11px', color: '#555', marginBottom: '4px' }}>
          Observaciones del período:
        </div>
        {b.observacion?.texto ? (
          <p style={es.textoObs}>{b.observacion.texto}</p>
        ) : (
          <>
            <div style={es.lineaObs} /><div style={es.lineaObs} /><div style={es.lineaObs} />
          </>
        )}
      </div>

      {/* Firmas */}
      <div style={es.firmasGrid}>
        {['Director(a) de Grupo', 'Rector(a)', 'Firma del Acudiente'].map(label => (
          <div key={label} style={es.firmaBox}>
            <div style={es.firmaLinea} />
            <div style={es.firmaLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pie */}
      <div style={es.pie}>
        Documento generado por Playfesor · {b.colegio.nombre} · {formatFecha()}
      </div>
    </div>
  );
}

export default function Boletin() {
  const { usuario } = useAuth();
  const [paso, setPaso]                   = useState(1);
  const [grupos, setGrupos]               = useState([]);
  const [gruposCargados, setGruposCargados] = useState(false);
  const [grupoId, setGrupoId]             = useState('');
  const [periodos, setPeriodos]           = useState([]);
  const [periodo, setPeriodo]             = useState('');
  const [estudiantes, setEstudiantes]     = useState([]);
  const [boletin, setBoletin]             = useState(null);
  const [boletinesMasivos, setBoletinesMasivos] = useState([]);
  const [cargando, setCargando]           = useState(false);
  const [cargandoMasivo, setCargandoMasivo] = useState(false);
  const [descargando, setDescargando]     = useState(false);
  const [error, setError]                 = useState('');

  // Observación de período (IA)
  const [obsTexto, setObsTexto]           = useState('');
  const [obsRequiereAtencion, setObsRequiereAtencion] = useState(false);
  const [generandoObs, setGenerandoObs]   = useState(false);
  const [guardandoObs, setGuardandoObs]   = useState(false);
  const [notificandoObs, setNotificandoObs] = useState(false);
  const [mensajeObs, setMensajeObs]       = useState('');
  const [errorObs, setErrorObs]           = useState('');

  useEffect(() => {
    axiosAuth.get('/api/boletin/mis-grupos')
      .then(r => {
        const data = r.data.data || [];
        setGrupos(data);
        // Un docente solo puede generar el boletín del grupo que dirige — si
        // solo tiene ese grupo disponible, se lo precargamos para no obligarlo
        // a elegir entre una sola opción.
        if (usuario?.rol === 'docente' && data.length === 1) {
          setGrupoId(String(data[0].id));
        }
        setGruposCargados(true);
      })
      .catch(() => { setError('No se pudieron cargar los grupos'); setGruposCargados(true); });
  }, [usuario]);

  useEffect(() => {
    if (!usuario?.colegio_id) return;
    axiosAuth.get(`/api/periodos/colegio/${usuario.colegio_id}`)
      .then(r => setPeriodos(r.data.data || []))
      .catch(() => setPeriodos([]));
  }, [usuario]);

  // CSS de impresión para boletín individual
  useEffect(() => {
    if (paso !== 3) return;
    const style = document.createElement('style');
    style.id = 'print-individual';
    style.innerHTML = `@media print {
      body * { visibility: hidden !important; }
      #boletin-individual, #boletin-individual * { visibility: visible !important; }
      #boletin-individual { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; padding: 24px 32px !important; background: #fff !important; }
    }`;
    document.head.appendChild(style);
    return () => document.getElementById('print-individual')?.remove();
  }, [paso]);

  // CSS de impresión para boletines masivos (page-break entre cada uno)
  useEffect(() => {
    if (paso !== 4) return;
    const style = document.createElement('style');
    style.id = 'print-masivo';
    style.innerHTML = `@media print {
      body * { visibility: hidden !important; }
      #boletin-masivo, #boletin-masivo * { visibility: visible !important; }
      #boletin-masivo { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; background: #fff !important; }
      .pagina-boletin { page-break-after: always !important; padding: 20px 28px !important; }
      .pagina-boletin:last-child { page-break-after: avoid !important; }
    }`;
    document.head.appendChild(style);
    return () => document.getElementById('print-masivo')?.remove();
  }, [paso]);

  const cargarEstudiantes = useCallback(async () => {
    if (!grupoId || !periodo) return;
    setCargando(true); setError('');
    try {
      const r = await axiosAuth.get(`/api/boletin/grupo/${grupoId}/periodo/${periodo}`);
      setEstudiantes(r.data.data || []);
      setPaso(2);
    } catch { setError('No se pudieron cargar los estudiantes'); }
    finally { setCargando(false); }
  }, [grupoId, periodo]);

  const verBoletin = useCallback(async (estudianteId) => {
    setCargando(true); setError('');
    try {
      const r = await axiosAuth.get(`/api/boletin/estudiante/${estudianteId}?grupo_id=${grupoId}&periodo=${periodo}`);
      setBoletin(r.data.data);
      setObsTexto(r.data.data.observacion?.texto || '');
      setObsRequiereAtencion(false);
      setMensajeObs(''); setErrorObs('');
      setPaso(3);
    } catch { setError('No se pudo generar el boletín'); }
    finally { setCargando(false); }
  }, [grupoId, periodo]);

  async function generarObservacion() {
    if (!boletin) return;
    setGenerandoObs(true); setErrorObs('');
    try {
      const r = await axiosAuth.post('/api/observaciones/generar', {
        estudiante_id: boletin.estudiante.id, grupo_id: boletin.grupo.id, periodo,
      });
      setObsTexto(r.data.data.texto);
      setObsRequiereAtencion(!!r.data.data.requiere_atencion);
    } catch (err) {
      setErrorObs(err.response?.data?.error || 'Error al generar la observación');
    } finally {
      setGenerandoObs(false);
    }
  }

  async function guardarObservacion() {
    if (!boletin || !obsTexto.trim()) return;
    setGuardandoObs(true); setErrorObs(''); setMensajeObs('');
    try {
      await axiosAuth.put('/api/observaciones', {
        estudiante_id: boletin.estudiante.id, grupo_id: boletin.grupo.id, periodo, texto: obsTexto.trim(),
      });
      setBoletin(prev => ({ ...prev, observacion: { ...prev.observacion, texto: obsTexto.trim() } }));
      setMensajeObs('Observación guardada correctamente');
      setTimeout(() => setMensajeObs(''), 3000);
    } catch (err) {
      setErrorObs(err.response?.data?.error || 'Error al guardar la observación');
    } finally {
      setGuardandoObs(false);
    }
  }

  async function notificarObservacion() {
    if (!boletin) return;
    setNotificandoObs(true); setErrorObs(''); setMensajeObs('');
    try {
      const r = await axiosAuth.post('/api/observaciones/notificar', {
        estudiante_id: boletin.estudiante.id, periodo,
      });
      setMensajeObs(`Acudiente notificado por WhatsApp (${r.data.data.telefono})`);
      setTimeout(() => setMensajeObs(''), 4000);
    } catch (err) {
      setErrorObs(err.response?.data?.error || 'No se pudo enviar la notificación');
    } finally {
      setNotificandoObs(false);
    }
  }

  async function descargarPDF(url, nombreArchivo) {
    setDescargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get(url, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${nombreArchivo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch {
      setError('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  }

  const imprimirTodoElGrupo = useCallback(async () => {
    setCargandoMasivo(true); setError('');
    try {
      const r = await axiosAuth.get(`/api/boletin/grupo/${grupoId}/periodo/${periodo}/masivo`);
      setBoletinesMasivos(r.data.data || []);
      setPaso(4);
    } catch { setError('No se pudieron generar los boletines masivos'); }
    finally { setCargandoMasivo(false); }
  }, [grupoId, periodo]);

  const grupoSel = grupos.find(g => g.id === parseInt(grupoId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Navbar titulo="Boletines" />
      <div style={{ padding: '28px', flex: 1 }}>

        {/* ── Paso 1: Selección ── */}
        {paso === 1 && (
          <div style={{ maxWidth: '520px' }}>
            <h2 style={es.titulo}>Generar Boletín de Desempeño</h2>
            {error && <div style={es.errorBox}>{error}</div>}
            {gruposCargados && usuario?.rol === 'docente' && grupos.length === 0 ? (
              <div style={es.avisoNoDisponible}>
                No diriges ningún grupo — el boletín oficial solo lo puede generar el director de grupo
                (o el administrador/rector). Si crees que deberías dirigir un grupo, pídele al administrador
                que te lo asigne desde "Docentes".
              </div>
            ) : (
              <>
                <p style={es.subtitulo}>Selecciona el grupo y el período.</p>
                <div style={es.card}>
                  <label style={es.label}>Grupo</label>
                  {usuario?.rol === 'docente' ? (
                    <div style={es.grupoFijo}>
                      {grupoSel ? `${grupoSel.grado}° · ${grupoSel.nombre}` : 'Cargando...'}
                      <span style={es.grupoFijoNota}>Grupo que diriges</span>
                    </div>
                  ) : (
                    <select style={es.select} value={grupoId} onChange={e => setGrupoId(e.target.value)}>
                      <option value="">— Selecciona un grupo —</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.grado} · {g.nombre}</option>)}
                    </select>
                  )}
                  <label style={{ ...es.label, marginTop: '16px' }}>Período</label>
                  <select style={es.select} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                    <option value="">— Selecciona un período —</option>
                    {periodos.map(p => <option key={p.numero} value={p.numero}>{p.nombre}</option>)}
                    <option value="final">Final (Consolidado)</option>
                  </select>
                  <button
                    style={{ ...es.btn, marginTop: '24px', opacity: (!grupoId || !periodo || cargando) ? 0.5 : 1 }}
                    disabled={!grupoId || !periodo || cargando}
                    onClick={cargarEstudiantes}
                  >
                    {cargando ? 'Cargando...' : 'Ver estudiantes →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Paso 2: Lista de estudiantes ── */}
        {paso === 2 && (
          <div style={{ maxWidth: '760px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button style={es.btnVolver} onClick={() => setPaso(1)}>← Volver</button>
              <div style={{ flex: 1 }}>
                <h2 style={{ ...es.titulo, margin: 0 }}>{grupoSel?.grado} · {grupoSel?.nombre}</h2>
                <p style={{ ...es.subtitulo, margin: 0 }}>{nombrePeriodo(periodo)} — {estudiantes.length} estudiante(s)</p>
              </div>
              <button
                style={{ ...es.btn, background: 'linear-gradient(135deg,#43a047,#2e7d32)', opacity: cargandoMasivo ? 0.6 : 1 }}
                disabled={cargandoMasivo}
                onClick={imprimirTodoElGrupo}
              >
                {cargandoMasivo ? 'Generando...' : `Imprimir todo el grupo (${estudiantes.length})`}
              </button>
            </div>
            {error && <div style={es.errorBox}>{error}</div>}
            <div style={es.card}>
              <table style={es.tabla}>
                <thead>
                  <tr>
                    <th style={es.th}>Estudiante</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Promedio</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Desempeño</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Boletín</th>
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.map(est => (
                    <tr key={est.estudiante_id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={es.td}>{formatearApellidoPrimero(est.nombre)}</td>
                      <td style={{ ...es.td, textAlign: 'center', fontWeight: '700', fontSize: '15px' }}>
                        {est.promedio ?? '—'}
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <ChipNivel nivel={est.nivel} />
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <button style={es.btnVer} onClick={() => verBoletin(est.estudiante_id)} disabled={cargando}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Paso 3: Boletín individual ── */}
        {paso === 3 && boletin && (
          <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={es.btnVolver} onClick={() => setPaso(2)}>← Volver a lista</button>
              <button
                style={{ ...es.btn, display: 'flex', alignItems: 'center', gap: '8px', opacity: descargando ? 0.6 : 1 }}
                disabled={descargando}
                onClick={() => descargarPDF(
                  `/api/boletin/pdf/estudiante/${boletin.estudiante.id}?grupo_id=${grupoId}&periodo=${periodo}`,
                  `Boletín_${boletin.estudiante.nombre}_${boletin.periodo === 'final' ? 'Final' : `P${boletin.periodo}`}`
                )}
              >
                <IconDownload size={15} />
                {descargando ? 'Generando PDF...' : 'Descargar PDF'}
              </button>
            </div>
            <div id="boletin-individual">
              <RenderBoletin b={boletin} />
            </div>

            {/* Editor de la observación del período (no se imprime) */}
            <div style={es.obsCard}>
              <div style={es.obsHeader}>
                <h3 style={es.obsTitulo}>Observaciones del período</h3>
                {boletin.observacion?.nombre_docente && (
                  <span style={es.obsAutor}>Última edición: {boletin.observacion.nombre_docente}</span>
                )}
              </div>
              <p style={es.obsAyuda}>
                Genera un borrador con IA a partir de las notas, asistencia y anotaciones reales del estudiante,
                revísalo y ajústalo antes de guardar — es un documento oficial.
              </p>

              <button
                onClick={generarObservacion}
                disabled={generandoObs}
                style={{ ...es.btnGenerarObs, opacity: generandoObs ? 0.6 : 1 }}
              >
                {generandoObs ? 'Generando con IA...' : (obsTexto ? '↻ Regenerar con IA' : '✨ Generar con IA')}
              </button>

              <textarea
                value={obsTexto}
                onChange={e => setObsTexto(e.target.value)}
                placeholder="Escribe aquí la observación, o genera un borrador con IA..."
                rows={5}
                style={es.obsTextarea}
              />

              {obsRequiereAtencion && (
                <div style={es.obsAlerta}>
                  ⚠ Este caso podría requerir seguimiento cercano — considera notificar al acudiente.
                </div>
              )}

              {mensajeObs && <div style={es.obsExito}>{mensajeObs}</div>}
              {errorObs && <div style={es.errorBox}>{errorObs}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={guardarObservacion}
                  disabled={guardandoObs || !obsTexto.trim()}
                  style={{ ...es.btn, opacity: (guardandoObs || !obsTexto.trim()) ? 0.5 : 1 }}
                >
                  {guardandoObs ? 'Guardando...' : 'Guardar observación'}
                </button>
                <button
                  onClick={notificarObservacion}
                  disabled={notificandoObs || !boletin.observacion?.texto}
                  style={{
                    ...es.btnWhatsapp,
                    opacity: (notificandoObs || !boletin.observacion?.texto) ? 0.5 : 1,
                  }}
                  title={!boletin.observacion?.texto ? 'Guarda la observación primero' : ''}
                >
                  {notificandoObs ? 'Enviando...' : '📲 Notificar al acudiente'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 4: Boletines masivos ── */}
        {paso === 4 && boletinesMasivos.length > 0 && (
          <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={es.btnVolver} onClick={() => setPaso(2)}>← Volver a lista</button>
              <button
                style={{ ...es.btn, background: 'linear-gradient(135deg,#43a047,#2e7d32)', display: 'flex', alignItems: 'center', gap: '8px', opacity: descargando ? 0.6 : 1 }}
                disabled={descargando}
                onClick={() => descargarPDF(
                  `/api/boletin/grupo/${grupoId}/periodo/${periodo}/pdf`,
                  `Boletines_${grupoSel?.nombre}_${periodo === 'final' ? 'Final' : `P${periodo}`}`
                )}
              >
                <IconDownload size={15} />
                {descargando ? 'Generando PDF...' : `Descargar PDF — ${boletinesMasivos.length} boletines`}
              </button>
              <span style={{ fontSize: '12px', color: '#aaa' }}>Cada estudiante en su propia hoja</span>
            </div>
            <div id="boletin-masivo">
              {boletinesMasivos.map((b, i) => (
                <div
                  key={b.estudiante.id}
                  className="pagina-boletin"
                  style={{ marginBottom: i < boletinesMasivos.length - 1 ? '40px' : 0 }}
                >
                  <RenderBoletin b={b} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const es = {
  titulo:    { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 6px' },
  subtitulo: { fontSize: '14px', color: '#888', margin: '0 0 20px' },
  errorBox:  { background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' },
  avisoNoDisponible: { background: '#fef9ec', border: '1px solid #f5d78e', borderRadius: '8px', padding: '12px 16px', color: '#b7791f', fontSize: '13px', marginBottom: '18px' },
  card:      { background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #eeeff3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  label:     { display: 'block', fontSize: '12px', fontWeight: '700', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select:    { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', color: '#333', background: '#fff', outline: 'none', fontFamily: 'inherit' },
  grupoFijo: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #eee', fontSize: '14px', color: '#333', background: '#f8f9ff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '600' },
  grupoFijoNota: { fontSize: '11px', fontWeight: '600', color: '#9aa0c2', textTransform: 'uppercase', letterSpacing: '0.4px' },
  btn:       { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnVolver: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#555', cursor: 'pointer', fontFamily: 'inherit' },
  btnVer:    { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  tabla:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f0f0f5', textAlign: 'left' },
  td:        { padding: '12px 14px', fontSize: '14px', color: '#333' },
  /* Boletín */
  boletin:         { background: '#fff', borderRadius: '12px', padding: '28px', border: '1px solid #eeeff3', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: 'Inter,sans-serif' },
  encabezado:      { display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '3px solid #667eea', paddingBottom: '18px', marginBottom: '18px' },
  logoCirculo:     { width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 },
  nombreColegio:   { fontSize: '17px', fontWeight: '800', color: '#1a1a2e' },
  subtitleColegio: { fontSize: '12px', color: '#888', marginTop: '2px' },
  periodoChip:     { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', borderRadius: '20px', padding: '6px 16px', fontWeight: '800', fontSize: '13px', flexShrink: 0 },
  datosEstudiante: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', background: '#f8f9ff', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid #e8eaf6' },
  datoItem:        { display: 'flex', flexDirection: 'column', gap: '2px' },
  datoLabel:       { fontSize: '10px', fontWeight: '700', color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.5px' },
  datoValor:       { fontSize: '13px', fontWeight: '700', color: '#1a1a2e' },
  seccionTitulo:   { fontSize: '10px', fontWeight: '800', color: '#667eea', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' },
  tablaImpresa:    { width: '100%', borderCollapse: 'collapse', border: '1px solid #eeeff3' },
  thImpreso:       { padding: '9px 11px', fontSize: '11px', fontWeight: '700', color: '#666', textAlign: 'left', borderBottom: '1px solid #eeeff3' },
  tdImpreso:       { padding: '9px 11px', fontSize: '13px', color: '#333' },
  asistenciaGrid:  { display: 'flex', gap: '10px' },
  asistenciaCard:  { flex: 1, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '10px', padding: '12px', textAlign: 'center' },
  asistenciaNum:   { fontSize: '20px', fontWeight: '800' },
  asistenciaLabel: { fontSize: '10px', color: '#999', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.3px' },
  escalaMEN:       { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '10px 14px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', marginTop: '14px', marginBottom: '16px' },
  escalaTitle:     { fontSize: '11px', fontWeight: '700', color: '#666' },
  escalaItem:      { fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' },
  observaciones:   { marginBottom: '20px' },
  lineaObs:        { borderBottom: '1px solid #e0e0e0', marginBottom: '14px', height: '18px' },
  textoObs:        { fontSize: '13px', color: '#333', lineHeight: 1.6, textAlign: 'justify', margin: 0 },
  firmasGrid:      { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px', marginBottom: '20px' },
  firmaBox:        { textAlign: 'center' },
  firmaLinea:      { borderBottom: '2px solid #333', marginBottom: '6px', height: '36px' },
  firmaLabel:      { fontSize: '11px', color: '#666', fontWeight: '600' },
  pie:             { textAlign: 'center', fontSize: '10px', color: '#bbb', borderTop: '1px solid #f0f0f0', paddingTop: '10px' },

  /* Editor de observaciones */
  obsCard:      { background: '#fff', borderRadius: '12px', padding: '22px', border: '1px solid #eeeff3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginTop: '20px' },
  obsHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' },
  obsTitulo:    { fontSize: '15px', fontWeight: '800', color: '#1a1a2e', margin: 0 },
  obsAutor:     { fontSize: '11px', color: '#aaa' },
  obsAyuda:     { fontSize: '12.5px', color: '#888', lineHeight: 1.5, margin: '4px 0 14px' },
  btnGenerarObs:{ background: 'linear-gradient(135deg,#764ba2,#667eea)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '12px' },
  obsTextarea:  { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13.5px', color: '#333', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 },
  obsAlerta:    { background: '#fff8e1', border: '1px solid #ffe082', color: '#8a6d00', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginTop: '10px' },
  obsExito:     { background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', marginTop: '10px' },
  btnWhatsapp:  { background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
