import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconArrowLeft, IconInbox, IconCheckSquare } from '../components/Icons';

const TIPO_LABEL = {
  opcion_multiple:    'Opción múltiple',
  verdadero_falso:    'Verdadero / Falso',
  ordenar_pasos:      'Ordenar pasos',
  completar_espacios: 'Completar espacios',
  relacionar_columnas:'Relacionar',
  ordenar_letras:     'Ordenar letras',
  ordenar_palabras:   'Ordenar palabras',
  sopa_letras:        'Sopa de letras',
  entrega_archivo:    'Entrega de trabajo',
};

export default function BancoActividades() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [actividades,  setActividades]  = useState([]);
  const [materias,     setMaterias]     = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [filMateria,   setFilMateria]   = useState('');
  const [filTipo,      setFilTipo]      = useState('');

  // Para el modal de copia
  const [copiando,     setCopiando]     = useState(null);   // actividad seleccionada
  const [grupoDestino, setGrupoDestino] = useState('');
  const [periodoDestino, setPeriodoDestino] = useState('');
  const [porcentajeDestino, setPorcentajeDestino] = useState('');
  const [mensajeCopia, setMensajeCopia] = useState('');
  const [errorCopia,   setErrorCopia]   = useState('');

  const cargarActividades = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filMateria) params.set('materia_id', filMateria);
      if (filTipo)    params.set('tipo', filTipo);
      const resp = await axiosAuth.get(`/api/actividades/banco?${params}`);
      setActividades(resp.data.data);
    } catch {
      setActividades([]);
    } finally {
      setCargando(false);
    }
  }, [filMateria, filTipo]);

  useEffect(() => {
    async function init() {
      try {
        const [respMat, respAsig] = await Promise.all([
          axiosAuth.get('/api/materias'),
          axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`),
        ]);
        setMaterias(respMat.data.data || []);
        setAsignaciones(respAsig.data.data || []);
      } catch {}
    }
    init();
  }, [usuario.id]);

  useEffect(() => { cargarActividades(); }, [cargarActividades]);

  async function confirmarCopia() {
    if (!grupoDestino || !periodoDestino || !porcentajeDestino) {
      setErrorCopia('Selecciona un grupo, un período y un porcentaje de destino.');
      return;
    }
    setErrorCopia('');
    try {
      await axiosAuth.post(`/api/actividades/${copiando.id}/copiar`, {
        grupo_id: parseInt(grupoDestino),
        periodo:  periodoDestino,
        porcentaje: parseFloat(porcentajeDestino),
      });
      setMensajeCopia(`"${copiando.titulo}" copiada a tus actividades.`);
      setCopiando(null);
      setGrupoDestino('');
      setPeriodoDestino('');
      setPorcentajeDestino('');
    } catch (err) {
      setErrorCopia(err.response?.data?.error || 'Error al copiar. Intenta de nuevo.');
    }
  }

  // Grupos únicos del docente (sin duplicar por materia)
  const gruposDocente = [...new Map(asignaciones.map(a => [a.grupo_id, a])).values()];

  return (
    <div style={es.pagina}>
      <Navbar titulo="Banco de Actividades" />
      <div style={es.contenido}>

        <div style={es.header}>
          <div>
            <button onClick={() => navigate('/dashboard-docente')} style={es.btnVolver}>
              <IconArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Volver
            </button>
            <h2 style={es.titulo}>Banco de Actividades</h2>
            <p style={es.subtitulo}>Actividades creadas por tus colegas — cópialas a tus grupos con un clic</p>
          </div>
        </div>

        {mensajeCopia && (
          <div style={es.exito}><IconCheckSquare size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />{mensajeCopia}</div>
        )}

        {/* Filtros */}
        <div style={es.filtros}>
          <select value={filMateria} onChange={e => setFilMateria(e.target.value)} style={es.select}>
            <option value="">Todas las materias</option>
            {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select value={filTipo} onChange={e => setFilTipo(e.target.value)} style={es.select}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Lista */}
        {cargando ? (
          <div style={es.sinDatos}>Buscando actividades...</div>
        ) : actividades.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={40} style={{ color: '#ccc', marginBottom: 10 }} />
            <p>No hay actividades de otros docentes en tu colegio todavía.</p>
          </div>
        ) : (
          <div style={es.grid}>
            {actividades.map(act => (
              <div key={act.id} style={es.card}>
                <div style={es.cardTop}>
                  <span style={es.tipoBadge}>{TIPO_LABEL[act.tipo] || act.tipo}</span>
                  <span style={es.materiaBadge}>{act.materia}</span>
                </div>
                <div style={es.cardTitulo}>{act.titulo}</div>
                {act.descripcion && (
                  <div style={es.cardDesc}>{act.descripcion}</div>
                )}
                <div style={es.cardMeta}>
                  <span>P{act.periodo}</span>
                  <span>Grado {act.grado}° {act.grupo}</span>
                  <span style={{ color: '#888' }}>{act.docente}</span>
                </div>
                {parseInt(act.veces_completada) > 0 && (
                  <div style={es.cardStats}>
                    {act.veces_completada} completadas · Prom. {act.nota_promedio}
                  </div>
                )}
                <button
                  onClick={() => { setCopiando(act); setMensajeCopia(''); setErrorCopia(''); }}
                  style={es.btnCopiar}
                >
                  Copiar a mis actividades
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Modal de copia */}
        {copiando && (
          <div style={es.overlay} onClick={() => setCopiando(null)}>
            <div style={es.modal} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#333', marginBottom: 6 }}>Copiar actividad</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                <strong>"{copiando.titulo}"</strong> se copiará a tus actividades. Selecciona el grupo y período de destino.
              </p>
              {errorCopia && <div style={es.errorBox}>{errorCopia}</div>}
              <label style={es.label}>Grupo destino</label>
              <select value={grupoDestino} onChange={e => setGrupoDestino(e.target.value)} style={es.select}>
                <option value="">— Selecciona un grupo —</option>
                {gruposDocente.map(g => (
                  <option key={g.grupo_id} value={g.grupo_id}>Grado {g.grado}° · {g.nombre_grupo}</option>
                ))}
              </select>
              <label style={{ ...es.label, marginTop: 12 }}>Período destino</label>
              <select value={periodoDestino} onChange={e => setPeriodoDestino(e.target.value)} style={es.select}>
                <option value="">— Selecciona un período —</option>
                {['1','2','3','4'].map(p => <option key={p} value={p}>Período {p}</option>)}
              </select>
              <label style={{ ...es.label, marginTop: 12 }}>Porcentaje dentro del período (%)</label>
              <input
                type="number" min="1" max="100" step="1"
                value={porcentajeDestino}
                onChange={e => setPorcentajeDestino(e.target.value)}
                placeholder="Ej: 25"
                style={es.select}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={confirmarCopia} style={es.btnConfirmar}>Copiar</button>
                <button onClick={() => setCopiando(null)} style={es.btnCancelar}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const es = {
  pagina:     { minHeight: '100vh', background: '#f0f2f5' },
  contenido:  { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  header:     { marginBottom: 20 },
  btnVolver:  { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0, fontFamily: 'inherit', marginBottom: 6, display: 'flex', alignItems: 'center' },
  titulo:     { fontSize: 22, fontWeight: 800, color: '#333', margin: '0 0 4px' },
  subtitulo:  { fontSize: 13, color: '#888', margin: 0 },
  exito:      { background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 },
  filtros:    { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  select:     { padding: '9px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 13, fontFamily: 'inherit', background: '#fff', minWidth: 180 },
  sinDatos:   { background: '#fff', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:       { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8 },
  cardTop:    { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tipoBadge:  { background: '#f0f0ff', color: '#667eea', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 },
  materiaBadge: { background: '#e8f5e9', color: '#2e7d32', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 },
  cardTitulo: { fontSize: 15, fontWeight: 700, color: '#333', lineHeight: 1.3 },
  cardDesc:   { fontSize: 12, color: '#888', lineHeight: 1.4 },
  cardMeta:   { display: 'flex', gap: 10, fontSize: 12, color: '#666', flexWrap: 'wrap' },
  cardStats:  { fontSize: 12, color: '#888', background: '#f9f9f9', borderRadius: 8, padding: '4px 10px' },
  btnCopiar:  { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 },
  overlay:    { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  modal:      { background: '#fff', borderRadius: 16, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' },
  label:      { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 },
  errorBox:   { background: '#fff0f0', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  btnConfirmar: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flex: 1 },
  btnCancelar:  { background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0', borderRadius: 9, padding: '10px 22px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flex: 1 },
};
