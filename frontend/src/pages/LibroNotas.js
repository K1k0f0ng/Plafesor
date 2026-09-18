import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBookOpen, IconDownload, IconEdit } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const PERIODOS = [1, 2, 3, 4];

const COMPONENTES = [
  { tipo: 'autoevaluacion',   etiqueta: 'Autoevaluación',   peso: 5,  color: '#8e24aa' },
  { tipo: 'coevaluacion',     etiqueta: 'Coevaluación',     peso: 5,  color: '#00897b' },
  { tipo: 'heteroevaluacion', etiqueta: 'Heteroevaluación', peso: 10, color: '#3949ab' },
];

function colorNota(nota) {
  if (nota === null || nota === undefined) return { bg: '#f5f5f5', text: '#bbb' };
  if (nota < 3.5)  return { bg: '#ffebee', text: '#c62828' };
  if (nota < 4.0)  return { bg: '#fffde7', text: '#f57f17' };
  if (nota < 4.6)  return { bg: '#e8f5e9', text: '#2e7d32' };
  return             { bg: '#e3f2fd', text: '#1565c0' };
}

function CeldaNota({ nota }) {
  const c = colorNota(nota);
  return (
    <div style={{
      background: c.bg, color: c.text, fontWeight: '700', fontSize: '13px',
      textAlign: 'center', padding: '6px 4px', borderRadius: '6px', minWidth: '46px',
    }}>
      {nota ?? '—'}
    </div>
  );
}

export default function LibroNotas() {
  const { usuario } = useAuth();
  const [grupos,       setGrupos]       = useState([]);
  const [materias,     setMaterias]     = useState([]);
  const [grupoId,      setGrupoId]      = useState('');
  const [materiaId,    setMateriaId]    = useState('');
  const [periodo,      setPeriodo]      = useState('');
  const [libro,        setLibro]        = useState(null);
  const [cargando,     setCargando]     = useState(false);
  const [error,        setError]        = useState('');

  // Panel calificación manual
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [editandoId,   setEditandoId]   = useState(null); // id de la evaluación manual que se corrige
  const [tituloEval,   setTituloEval]   = useState('');
  const [porcentajeEval, setPorcentajeEval] = useState('');
  const [notasManual,  setNotasManual]  = useState({});
  const [guardando,    setGuardando]    = useState(false);
  const [mensajeOk,    setMensajeOk]   = useState('');

  // Panel de componente (Autoevaluación / Coevaluación / Heteroevaluación)
  const [panelComponente,   setPanelComponente]   = useState(null); // tipo o null
  const [notasComponente,   setNotasComponente]   = useState({});
  const [guardandoComponente, setGuardandoComponente] = useState(false);

  const esDocente = usuario?.rol === 'docente';

  useEffect(() => {
    axiosAuth.get('/api/boletin/mis-grupos')
      .then(r => setGrupos(r.data.data || []))
      .catch(() => setError('No se pudieron cargar los grupos'));
  }, []);

  useEffect(() => {
    if (!grupoId) { setMaterias([]); setMateriaId(''); return; }
    axiosAuth.get(`/api/actividades/mis-materias?grupo_id=${grupoId}`)
      .then(r => { setMaterias(r.data.data || []); setMateriaId(''); })
      .catch(() => setError('No se pudieron cargar las materias'));
  }, [grupoId]);

  const cargarLibro = useCallback(async () => {
    if (!grupoId || !materiaId || !periodo) return;
    setCargando(true); setError(''); setLibro(null);
    try {
      const r = await axiosAuth.get(
        `/api/actividades/libro?grupo_id=${grupoId}&materia_id=${materiaId}&periodo=${periodo}`
      );
      setLibro(r.data.data);
    } catch {
      setError('No se pudo cargar el libro de calificaciones');
    } finally {
      setCargando(false);
    }
  }, [grupoId, materiaId, periodo]);

  // Sin argumento: evaluación nueva. Con una actividad manual: corregirla.
  function abrirPanel(actividad) {
    const init = {};
    (libro?.estudiantes || []).forEach(e => {
      const actual = actividad ? e.notas[actividad.id] : undefined;
      init[e.id] = actual !== undefined && actual !== null ? String(actual) : '';
    });
    setNotasManual(init);
    setEditandoId(actividad ? actividad.id : null);
    setTituloEval(actividad ? actividad.titulo : '');
    setPorcentajeEval(actividad ? String(parseFloat(actividad.porcentaje)) : '');
    setMensajeOk('');
    setPanelAbierto(true);
  }

  async function guardarCalificaciones() {
    if (!tituloEval.trim()) return;
    const porcentajeNum = parseFloat(porcentajeEval);
    if (porcentajeEval === '' || isNaN(porcentajeNum) || porcentajeNum <= 0 || porcentajeNum > 100) {
      setError('Indica un porcentaje válido para esta evaluación (mayor a 0 y máximo 100)');
      return;
    }
    const fueraDeRango = Object.values(notasManual).some(n => n !== '' && (isNaN(parseFloat(n)) || parseFloat(n) < 1 || parseFloat(n) > 5));
    if (fueraDeRango) {
      setError('Todas las notas deben estar entre 1.0 y 5.0');
      return;
    }
    const calificaciones = Object.entries(notasManual)
      .filter(([, n]) => n !== '' && n !== null)
      .map(([id, nota]) => ({ estudiante_id: parseInt(id), nota: parseFloat(nota) }));

    if (calificaciones.length === 0) return;

    setGuardando(true); setError('');
    try {
      if (editandoId) {
        // Al corregir se envían todos los estudiantes: una nota vacía borra la anterior
        await axiosAuth.put(`/api/actividades/calificar-manual/${editandoId}`, {
          titulo: tituloEval.trim(),
          porcentaje: porcentajeNum,
          calificaciones: Object.entries(notasManual).map(([id, nota]) => ({
            estudiante_id: parseInt(id), nota: nota === '' ? null : parseFloat(nota),
          })),
        });
        setMensajeOk(`"${tituloEval}" actualizada correctamente`);
      } else {
        await axiosAuth.post('/api/actividades/calificar-manual', {
          titulo: tituloEval.trim(),
          grupo_id: parseInt(grupoId),
          materia_id: parseInt(materiaId),
          periodo: parseInt(periodo),
          porcentaje: porcentajeNum,
          calificaciones,
        });
        setMensajeOk(`"${tituloEval}" guardada con ${calificaciones.length} notas`);
      }
      setPanelAbierto(false);
      await cargarLibro(); // refrescar el libro
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar las calificaciones');
    } finally {
      setGuardando(false);
    }
  }

  function abrirPanelComponente(tipo) {
    const init = {};
    (libro?.estudiantes || []).forEach(e => {
      const actual = e.componentes?.[tipo];
      init[e.id] = actual !== null && actual !== undefined ? String(actual) : '';
    });
    setNotasComponente(init);
    setMensajeOk('');
    setPanelComponente(tipo);
  }

  async function guardarComponente() {
    const calificaciones = Object.entries(notasComponente)
      .filter(([, n]) => n !== '' && n !== null)
      .map(([id, nota]) => ({ estudiante_id: parseInt(id), nota: parseFloat(nota) }));
    if (calificaciones.length === 0) return;

    setGuardandoComponente(true); setError('');
    try {
      await axiosAuth.post('/api/actividades/componentes', {
        grupo_id: parseInt(grupoId),
        materia_id: parseInt(materiaId),
        periodo: parseInt(periodo),
        tipo: panelComponente,
        calificaciones,
      });
      const etiqueta = COMPONENTES.find(c => c.tipo === panelComponente)?.etiqueta || panelComponente;
      setMensajeOk(`${etiqueta} guardada con ${calificaciones.length} notas`);
      setPanelComponente(null);
      await cargarLibro();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar las calificaciones');
    } finally {
      setGuardandoComponente(false);
    }
  }

  function exportarExcel() {
    if (!libro) return;
    const grupoNombre   = grupos.find(g => g.id === parseInt(grupoId))?.nombre || grupoId;
    const materiaNombre = materias.find(m => m.id === parseInt(materiaId))?.nombre || materiaId;
    const encabezados   = [
      'Estudiante',
      ...libro.actividades.map(a => `${a.titulo} (${a.porcentaje}%)`),
      'Actividades (80%)',
      ...COMPONENTES.map(c => `${c.etiqueta} (${c.peso}%)`),
      'Nota final',
    ];
    const filas = libro.estudiantes.map(est => [
      formatearApellidoPrimero(est.nombre),
      ...libro.actividades.map(a => est.notas[a.id] ?? ''),
      est.promedio_actividades ?? '',
      ...COMPONENTES.map(c => est.componentes?.[c.tipo] ?? ''),
      est.nota_final ?? (libro.porcentajeCompleto ? '' : 'Pendiente'),
    ]);
    const filaPromedio = [
      'Promedio actividad', ...libro.actividades.map(a => a.promedio_actividad ?? ''),
      '', ...COMPONENTES.map(() => ''), '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas, filaPromedio]);
    ws['!cols'] = [{ wch: 28 }, ...libro.actividades.map(() => ({ wch: 18 })), { wch: 16 }, ...COMPONENTES.map(() => ({ wch: 18 })), { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');
    XLSX.writeFile(wb, `Notas_${materiaNombre}_${grupoNombre}_P${periodo}.xlsx`);
  }

  const grupoSel        = grupos.find(g => g.id === parseInt(grupoId));
  const materiaSel      = materias.find(m => m.id === parseInt(materiaId));
  const listo           = grupoId && materiaId && periodo;
  const totalEstudiantes = libro?.estudiantes.length || 0;
  const totalActividades = libro?.actividades.length || 0;
  const sinEntregas     = libro ? libro.estudiantes.filter(e => Object.keys(e.notas).length === 0).length : 0;
  const promedioGrupal  = libro
    ? (() => {
        const vals = libro.estudiantes.map(e => e.nota_final).filter(n => n !== null && n !== undefined);
        return vals.length ? Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10 : null;
      })()
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Navbar titulo="Libro de Notas" />

      {/* Overlay + Panel lateral de calificación manual */}
      {panelAbierto && (
        <>
          <div
            onClick={() => setPanelAbierto(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }}
          />
          <div style={es.panel}>
            <div style={es.panelHeader}>
              <div>
                <div style={es.panelTitulo}>{editandoId ? 'Editar calificación manual' : 'Ingresar calificación manual'}</div>
                <div style={es.panelSub}>{materiaSel?.nombre} · {grupoSel?.grado} {grupoSel?.nombre} · P{periodo}</div>
              </div>
              <button style={es.panelClose} onClick={() => setPanelAbierto(false)}>✕</button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <label style={es.label}>Nombre de la evaluación *</label>
              <input
                style={es.inputEval}
                placeholder='Ej: Examen parcial, Exposición, Trabajo en clase...'
                value={tituloEval}
                onChange={e => setTituloEval(e.target.value)}
                autoFocus
              />

              <label style={{ ...es.label, marginTop: '14px', display: 'block' }}>Porcentaje dentro del período (%) *</label>
              <input
                type="number" min="1" max="100" step="1"
                style={es.inputEval}
                placeholder="Ej: 25"
                value={porcentajeEval}
                onChange={e => setPorcentajeEval(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
                <label style={es.label}>Notas (escala 1.0 – 5.0)</label>
                <button
                  style={es.btnLlenar}
                  onClick={() => {
                    const nuevas = {};
                    libro.estudiantes.forEach(e => { nuevas[e.id] = ''; });
                    setNotasManual(nuevas);
                  }}
                >
                  Limpiar todo
                </button>
              </div>

              <div style={es.listaEstudiantes}>
                {(libro?.estudiantes || []).map(est => (
                  <div key={est.id} style={es.filaEst}>
                    <span style={es.nombreEst}>{formatearApellidoPrimero(est.nombre)}</span>
                    <input
                      type="number"
                      min="1" max="5" step="0.1"
                      placeholder="—"
                      value={notasManual[est.id] ?? ''}
                      onChange={e => setNotasManual(prev => ({ ...prev, [est.id]: e.target.value }))}
                      style={{
                        ...es.inputNota,
                        ...(notasManual[est.id] !== '' ? colorNota(parseFloat(notasManual[est.id])) : {}),
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '8px', fontSize: '12px', color: '#aaa' }}>
                {Object.values(notasManual).filter(n => n !== '').length} de {totalEstudiantes} notas ingresadas
              </div>
            </div>

            <div style={es.panelFooter}>
              <button style={es.btnCancelar} onClick={() => setPanelAbierto(false)}>Cancelar</button>
              <button
                style={{
                  ...es.btnGuardar,
                  opacity: (!tituloEval.trim() || !porcentajeEval || Object.values(notasManual).every(n => n === '') || guardando) ? 0.5 : 1,
                }}
                disabled={!tituloEval.trim() || !porcentajeEval || Object.values(notasManual).every(n => n === '') || guardando}
                onClick={guardarCalificaciones}
              >
                {guardando ? 'Guardando...' : (editandoId ? 'Guardar cambios' : 'Guardar calificaciones')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Overlay + Panel lateral de componente (Autoevaluación/Coevaluación/Heteroevaluación) */}
      {panelComponente && (() => {
        const comp = COMPONENTES.find(c => c.tipo === panelComponente);
        return (
          <>
            <div
              onClick={() => setPanelComponente(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', zIndex: 100 }}
            />
            <div style={es.panel}>
              <div style={{ ...es.panelHeader, background: `linear-gradient(135deg, ${comp.color}, ${comp.color}cc)` }}>
                <div>
                  <div style={es.panelTitulo}>{comp.etiqueta} ({comp.peso}% de la nota final)</div>
                  <div style={es.panelSub}>{materiaSel?.nombre} · {grupoSel?.grado} {grupoSel?.nombre} · P{periodo}</div>
                </div>
                <button style={es.panelClose} onClick={() => setPanelComponente(null)}>✕</button>
              </div>

              <div style={{ padding: '20px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <label style={es.label}>Notas (escala 1.0 – 5.0)</label>
                <div style={{ ...es.listaEstudiantes, marginTop: '8px' }}>
                  {(libro?.estudiantes || []).map(est => (
                    <div key={est.id} style={es.filaEst}>
                      <span style={es.nombreEst}>{formatearApellidoPrimero(est.nombre)}</span>
                      <input
                        type="number"
                        min="1" max="5" step="0.1"
                        placeholder="—"
                        value={notasComponente[est.id] ?? ''}
                        onChange={e => setNotasComponente(prev => ({ ...prev, [est.id]: e.target.value }))}
                        style={{
                          ...es.inputNota,
                          ...(notasComponente[est.id] !== '' ? colorNota(parseFloat(notasComponente[est.id])) : {}),
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#aaa' }}>
                  {Object.values(notasComponente).filter(n => n !== '').length} de {totalEstudiantes} notas ingresadas
                </div>
              </div>

              <div style={es.panelFooter}>
                <button style={es.btnCancelar} onClick={() => setPanelComponente(null)}>Cancelar</button>
                <button
                  style={{
                    ...es.btnGuardar,
                    background: `linear-gradient(135deg, ${comp.color}, ${comp.color}cc)`,
                    opacity: (Object.values(notasComponente).every(n => n === '') || guardandoComponente) ? 0.5 : 1,
                  }}
                  disabled={Object.values(notasComponente).every(n => n === '') || guardandoComponente}
                  onClick={guardarComponente}
                >
                  {guardandoComponente ? 'Guardando...' : 'Guardar calificaciones'}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      <div style={{ padding: '28px', flex: 1 }}>

        {/* Selectores */}
        <div style={es.filtrosCard}>
          <div style={es.filtrosRow}>
            <div style={es.filtroItem}>
              <label style={es.label}>Grupo</label>
              <select style={es.select} value={grupoId} onChange={e => setGrupoId(e.target.value)}>
                <option value="">— Grupo —</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.grado} · {g.nombre}</option>)}
              </select>
            </div>
            <div style={es.filtroItem}>
              <label style={es.label}>Materia</label>
              <select style={es.select} value={materiaId} onChange={e => setMateriaId(e.target.value)} disabled={!grupoId}>
                <option value="">— Materia —</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div style={es.filtroItem}>
              <label style={es.label}>Período</label>
              <select style={es.select} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                <option value="">— Período —</option>
                {PERIODOS.map(p => <option key={p} value={p}>Período {p}</option>)}
              </select>
            </div>
            <button
              style={{ ...es.btn, opacity: (!listo || cargando) ? 0.5 : 1, alignSelf: 'flex-end' }}
              disabled={!listo || cargando}
              onClick={cargarLibro}
            >
              {cargando ? 'Cargando...' : 'Ver libro'}
            </button>
          </div>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensajeOk && <div style={es.okBox}>{mensajeOk}</div>}

        {!libro && !cargando && (
          <div style={es.vacio}>
            <IconBookOpen size={48} style={{ color: '#ccc', marginBottom: '12px' }} />
            <p style={{ color: '#aaa', fontSize: '15px' }}>
              Selecciona grupo, materia y período para ver el libro de calificaciones
            </p>
          </div>
        )}

        {libro && (
          <>
            <div style={es.encabezadoLibro}>
              <div>
                <h2 style={es.titulo}>{materiaSel?.nombre} — {grupoSel?.grado} {grupoSel?.nombre}</h2>
                <p style={es.subtitulo}>Período {periodo}</p>
              </div>
              <div style={es.statsRow}>
                <div style={es.statCard}>
                  <span style={es.statNum}>{totalEstudiantes}</span>
                  <span style={es.statLabel}>Estudiantes</span>
                </div>
                <div style={es.statCard}>
                  <span style={es.statNum}>{totalActividades}</span>
                  <span style={es.statLabel}>Actividades</span>
                </div>
                <div style={{ ...es.statCard, ...colorNota(promedioGrupal), border: 'none' }}>
                  <span style={{ ...es.statNum, color: colorNota(promedioGrupal).text }}>
                    {promedioGrupal ?? '—'}
                  </span>
                  <span style={es.statLabel}>Promedio grupo</span>
                </div>
                {sinEntregas > 0 && (
                  <div style={{ ...es.statCard, background: '#fff3e0' }}>
                    <span style={{ ...es.statNum, color: '#e65100' }}>{sinEntregas}</span>
                    <span style={es.statLabel}>Sin entregas</span>
                  </div>
                )}
                {esDocente && (
                  <button style={{ ...es.btnManual, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => abrirPanel()}>
                    <IconEdit size={14} />Calificación manual
                  </button>
                )}
                <button style={{ ...es.btnExcel, display: 'flex', alignItems: 'center', gap: 6 }} onClick={exportarExcel}>
                  <IconDownload size={14} />Exportar Excel
                </button>
              </div>
            </div>

            <div style={es.leyenda}>
              {[
                { bg: '#ffebee', text: '#c62828', label: 'Bajo < 3.5' },
                { bg: '#fffde7', text: '#f57f17', label: 'Básico 3.5–3.9' },
                { bg: '#e8f5e9', text: '#2e7d32', label: 'Alto 4.0–4.5' },
                { bg: '#e3f2fd', text: '#1565c0', label: 'Superior ≥ 4.6' },
              ].map(({ bg, text, label }) => (
                <span key={label} style={{ ...es.leyendaItem, background: bg, color: text }}>{label}</span>
              ))}
            </div>

            {libro.actividades.length > 0 && (
              <div style={{ ...es.avisoPorcentaje, ...(libro.porcentajeCompleto ? es.avisoOk : es.avisoPendiente) }}>
                {libro.porcentajeCompleto
                  ? `✓ Los porcentajes de las actividades suman 100% — la nota final ya se calcula.`
                  : `Los porcentajes de las actividades suman ${libro.sumaPorcentaje}% (deben sumar 100% para calcular la nota final). Ajusta los porcentajes desde "Crear actividad".`}
              </div>
            )}

            {esDocente && libro.actividades.some(a => a.tipo === 'manual' && a.docente_id === usuario?.id) && (
              <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px' }}>
                Para corregir una calificación manual, haz clic en el nombre de la evaluación (marcada con el lápiz).
              </p>
            )}

            <div style={{ ...es.leyenda, marginTop: 0 }}>
              {COMPONENTES.map(c => (
                <button
                  key={c.tipo}
                  onClick={() => abrirPanelComponente(c.tipo)}
                  style={{ ...es.btnComponente, borderColor: c.color, color: c.color }}
                  title={`Ingresar/editar ${c.etiqueta.toLowerCase()}`}
                >
                  <IconEdit size={12} />{c.etiqueta} ({c.peso}%)
                </button>
              ))}
            </div>

            {libro.actividades.length === 0 ? (
              <div style={es.vacio}>
                <p style={{ color: '#aaa' }}>
                  No hay actividades para este grupo, materia y período.
                  {esDocente && ' Usa "Calificación manual" para ingresar la primera nota.'}
                </p>
              </div>
            ) : (
              <div style={es.tablaWrapper}>
                <table style={es.tabla}>
                  <thead>
                    <tr>
                      <th style={es.thFijo}>Estudiante</th>
                      {libro.actividades.map(a => {
                        // Solo el docente que la creó puede corregir una evaluación manual
                        const editable = esDocente && a.tipo === 'manual' && a.docente_id === usuario?.id;
                        return (
                          <th
                            key={a.id}
                            style={{ ...es.thAct, ...(editable ? { cursor: 'pointer', color: '#e64a19' } : {}) }}
                            title={editable ? `Clic para editar "${a.titulo}"` : a.titulo}
                            onClick={editable ? () => abrirPanel(a) : undefined}
                          >
                            <div style={es.thActTexto}>
                              {editable && <IconEdit size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                              {a.titulo}
                            </div>
                            <div style={es.thActSub}>{a.porcentaje}% · {a.total_completadas}/{totalEstudiantes}</div>
                          </th>
                        );
                      })}
                      <th style={{ ...es.thAct, background: '#f3f4ff', color: '#667eea' }}>Actividades (80%)</th>
                      {COMPONENTES.map(c => (
                        <th
                          key={c.tipo}
                          style={{ ...es.thAct, background: `${c.color}15`, color: c.color, cursor: 'pointer' }}
                          onClick={() => abrirPanelComponente(c.tipo)}
                          title={`Clic para ingresar/editar ${c.etiqueta.toLowerCase()}`}
                        >
                          {c.etiqueta} ({c.peso}%)
                        </th>
                      ))}
                      <th style={{ ...es.thAct, background: '#667eea', color: '#fff' }}>Nota final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libro.estudiantes.map(est => (
                      <tr key={est.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={es.tdFijo}>{formatearApellidoPrimero(est.nombre)}</td>
                        {libro.actividades.map(a => (
                          <td key={a.id} style={es.tdCentro}>
                            <CeldaNota nota={est.notas[a.id] ?? null} />
                          </td>
                        ))}
                        <td style={es.tdCentro}>
                          <CeldaNota nota={est.promedio_actividades} />
                        </td>
                        {COMPONENTES.map(c => (
                          <td key={c.tipo} style={es.tdCentro}>
                            <CeldaNota nota={est.componentes?.[c.tipo] ?? null} />
                          </td>
                        ))}
                        <td style={es.tdCentro}>
                          <div style={{
                            ...colorNota(est.nota_final), fontWeight: '800', fontSize: '14px',
                            textAlign: 'center', padding: '6px 4px', borderRadius: '6px', minWidth: '46px',
                          }}>
                            {est.nota_final ?? (libro.porcentajeCompleto ? '—' : 'Pendiente')}
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #667eea', background: '#f8f9ff' }}>
                      <td style={{ ...es.tdFijo, fontWeight: '800', color: '#667eea', background: '#f0f0ff' }}>
                        Promedio actividad
                      </td>
                      {libro.actividades.map(a => (
                        <td key={a.id} style={es.tdCentro}>
                          <CeldaNota nota={a.promedio_actividad} />
                        </td>
                      ))}
                      <td style={es.tdCentro} />
                      {COMPONENTES.map(c => <td key={c.tipo} style={es.tdCentro} />)}
                      <td style={es.tdCentro}>
                        <div style={{
                          ...colorNota(promedioGrupal), fontWeight: '800', fontSize: '14px',
                          textAlign: 'center', padding: '6px 4px', borderRadius: '6px',
                        }}>
                          {promedioGrupal ?? '—'}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  filtrosCard:  { background: '#fff', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', border: '1px solid #eeeff3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  filtrosRow:   { display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' },
  filtroItem:   { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '160px' },
  label:        { fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' },
  select:       { padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', color: '#333', background: '#fff', outline: 'none', fontFamily: 'inherit' },
  btn:          { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnExcel:     { background: 'linear-gradient(135deg,#43a047,#2e7d32)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnManual:    { background: 'linear-gradient(135deg,#ff7043,#e64a19)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  errorBox:     { background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' },
  okBox:        { background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '12px 16px', color: '#2e7d32', fontSize: '13px', marginBottom: '16px' },
  vacio:        { textAlign: 'center', padding: '60px 20px', color: '#bbb' },
  encabezadoLibro: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '16px' },
  titulo:       { fontSize: '18px', fontWeight: '800', color: '#1a1a2e', margin: '0 0 4px' },
  subtitulo:    { fontSize: '13px', color: '#999', margin: 0 },
  statsRow:     { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  statCard:     { background: '#f8f9ff', borderRadius: '10px', padding: '10px 16px', textAlign: 'center', border: '1px solid #eeeff3' },
  statNum:      { display: 'block', fontSize: '20px', fontWeight: '800', color: '#1a1a2e' },
  statLabel:    { display: 'block', fontSize: '10px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '2px' },
  leyenda:      { display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' },
  leyendaItem:  { fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' },
  avisoPorcentaje: { borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', marginBottom: '14px' },
  avisoOk:      { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' },
  avisoPendiente: { background: '#fff8e1', color: '#e65100', border: '1px solid #ffe082' },
  btnComponente: { background: '#fff', border: '1.5px solid', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  tablaWrapper: { overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #eeeff3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  tabla:        { borderCollapse: 'collapse', minWidth: '100%' },
  thFijo:       { padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: '#555', background: '#fafafa', borderBottom: '2px solid #eeeff3', borderRight: '2px solid #eeeff3', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 2, minWidth: '200px' },
  thAct:        { padding: '8px 6px', fontSize: '11px', fontWeight: '700', color: '#666', background: '#fafafa', borderBottom: '2px solid #eeeff3', textAlign: 'center', minWidth: '80px' },
  thActTexto:   { maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' },
  thActSub:     { fontSize: '10px', color: '#bbb', fontWeight: '400' },
  tdFijo:       { padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: '#333', borderRight: '2px solid #eeeff3', background: '#fff', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' },
  tdCentro:     { padding: '6px 8px', textAlign: 'center' },
  // Panel lateral
  panel:        { position: 'fixed', top: 0, right: 0, width: '420px', maxWidth: '95vw', height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'hidden' },
  panelHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid #f0f0f5', background: 'linear-gradient(135deg,#ff7043,#e64a19)' },
  panelTitulo:  { fontSize: '15px', fontWeight: '800', color: '#fff' },
  panelSub:     { fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' },
  panelClose:   { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' },
  panelFooter:  { padding: '16px 20px', borderTop: '1px solid #f0f0f5', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 'auto' },
  inputEval:    { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  btnLlenar:    { background: 'none', border: 'none', color: '#999', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' },
  listaEstudiantes: { display: 'flex', flexDirection: 'column', gap: '6px' },
  filaEst:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f5f5f5' },
  nombreEst:    { fontSize: '13px', color: '#333', flex: 1 },
  inputNota:    { width: '72px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontWeight: '700', textAlign: 'center', fontFamily: 'inherit', outline: 'none' },
  btnCancelar:  { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', color: '#666', cursor: 'pointer', fontFamily: 'inherit' },
  btnGuardar:   { background: 'linear-gradient(135deg,#ff7043,#e64a19)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
