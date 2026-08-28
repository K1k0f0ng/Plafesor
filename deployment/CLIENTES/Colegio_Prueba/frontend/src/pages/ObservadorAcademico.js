import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconFileText, IconClipboard, IconZap } from '../components/Icons';

export default function ObservadorAcademico() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();

  const [grupos,              setGrupos]              = useState([]);
  const [grupoId,             setGrupoId]             = useState('');
  const [materiaId,           setMateriaId]           = useState('');
  const [generando,           setGenerando]           = useState(false);
  const [resultado,           setResultado]           = useState(null);
  const [error,               setError]               = useState('');
  const [copiado,             setCopiado]             = useState(false);
  const [puntos,              setPuntos]              = useState('');

  useEffect(() => {
    axiosAuth.get(`/api/observador/colegio/${usuario.colegio_id}/grupos-materias`)
      .then(r => setGrupos(r.data.data))
      .catch(() => setError('No se pudieron cargar los grupos. Verifica que haya actividades registradas.'));
  }, [usuario.colegio_id]);

  useEffect(() => {
    if (!generando) { setPuntos(''); return; }
    const id = setInterval(() => setPuntos(p => p.length >= 3 ? '' : p + '.'), 480);
    return () => clearInterval(id);
  }, [generando]);

  const grupoActivo = grupos.find(g => String(g.grupo_id) === String(grupoId));
  const materias    = grupoActivo?.materias || [];

  const generar = async () => {
    if (!grupoId || !materiaId || generando) return;
    setGenerando(true);
    setResultado(null);
    setError('');
    try {
      const resp = await axiosAuth.post(`/api/observador/grupo/${grupoId}/materia/${materiaId}`);
      setResultado(resp.data.data);
    } catch {
      setError('Error al generar la observación. Asegúrate de que el grupo tenga actividades con resultados.');
    } finally {
      setGenerando(false);
    }
  };

  const copiar = () => {
    if (!resultado) return;
    const texto = [
      `OBSERVACIÓN ACADÉMICA INSTITUCIONAL`,
      `${resultado.grupo} — ${resultado.materia}`,
      `Generado: ${new Date(resultado.generado_en).toLocaleString('es-CO')}`,
      '',
      resultado.observacion,
    ].join('\n');
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const limpiar = () => {
    setResultado(null);
    setGrupoId('');
    setMateriaId('');
    setError('');
  };

  const puedeGenerar = grupoId && materiaId && !generando;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Observador Académico" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <div>
            <button onClick={() => navigate('/dashboard-director')} style={es.btnVolver}>← Volver al panel</button>
            <h2 style={es.titulo}>Observador Académico Automático</h2>
            <p style={es.subtitulo}>
              Genera informes narrativos profesionales basados en los datos reales de tu colegio
            </p>
          </div>
        </div>

        {/* Selectores */}
        <div style={es.selectorCard}>
          <div style={es.selectorRow}>
            <div style={es.selectorGrupo}>
              <label style={es.label}>Grupo</label>
              <select
                value={grupoId}
                onChange={e => { setGrupoId(e.target.value); setMateriaId(''); setResultado(null); }}
                style={es.select}
              >
                <option value="">— Selecciona un grupo —</option>
                {grupos.map(g => (
                  <option key={g.grupo_id} value={g.grupo_id}>
                    Grado {g.grado}° {g.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={es.selectorMateria}>
              <label style={es.label}>Materia</label>
              <select
                value={materiaId}
                onChange={e => { setMateriaId(e.target.value); setResultado(null); }}
                disabled={!grupoId}
                style={{ ...es.select, opacity: grupoId ? 1 : 0.5 }}
              >
                <option value="">— Selecciona una materia —</option>
                {materias.map(m => (
                  <option key={m.materia_id} value={m.materia_id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            <div style={es.selectorBtn}>
              <label style={{ ...es.label, visibility: 'hidden' }}>-</label>
              <button
                onClick={generar}
                disabled={!puedeGenerar}
                style={{ ...es.btnGenerar, opacity: puedeGenerar ? 1 : 0.55, cursor: puedeGenerar ? 'pointer' : 'not-allowed' }}
              >
                {generando
                  ? `Analizando${puntos}`
                  : 'Generar observación'}
              </button>
            </div>
          </div>

          {generando && (
            <div style={es.generandoBanner}>
              <div style={es.spinner} />
              <span>Analizando datos académicos y generando el informe con IA{puntos}</span>
            </div>
          )}
        </div>

        {error && <div style={es.error}>{error}</div>}

        {/* Resultado */}
        {resultado && (
          <div style={es.resultadoCard}>
            <div style={es.resultadoHeader}>
              <div style={es.resultadoMeta}>
                <span style={es.resultadoBadge}><IconFileText size={13} style={{ marginRight: 5 }} /> Observación generada</span>
                <span style={es.resultadoInfo}>
                  {resultado.grupo} · {resultado.materia}
                </span>
                <span style={es.resultadoFecha}>
                  {new Date(resultado.generado_en).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={copiar} style={es.btnCopiar}>
                  {copiado ? '✓ Copiado' : <><IconClipboard size={14} style={{ marginRight: 5 }} />Copiar</>}
                </button>
                <button onClick={limpiar} style={es.btnNueva}>
                  + Nueva
                </button>
              </div>
            </div>
            <div style={es.separador} />
            <div style={es.observacionTexto}>
              {resultado.observacion}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!resultado && !generando && !error && (
          <div style={es.placeholder}>
            <IconFileText size={56} style={{ color: '#ccc' }} />
            <p style={es.placeholderTitulo}>Selecciona un grupo y una materia</p>
            <p style={es.placeholderSub}>
              El observador analizará notas, tendencias, asistencia y estudiantes en riesgo
              para generar un informe narrativo listo para usar en reuniones o consejos académicos.
            </p>
            <div style={es.ejemplos}>
              {['Diagnóstico del estado actual', 'Tendencias detectadas', 'Estudiantes prioritarios', 'Recomendaciones pedagógicas'].map(e => (
                <span key={e} style={es.ejemploChip}>✓ {e}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina:     { minHeight: '100vh', background: '#f0f2f5' },
  contenido:  { padding: '28px 24px', maxWidth: '960px', margin: '0 auto' },
  encabezado: { marginBottom: '24px' },
  btnVolver:  { background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer', fontSize: '13px', fontWeight: '700', padding: '0 0 10px', fontFamily: 'inherit', display: 'block' },
  titulo:     { fontSize: '22px', fontWeight: '800', color: '#333', margin: 0 },
  subtitulo:  { fontSize: '14px', color: '#888', margin: '4px 0 0' },

  selectorCard: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px' },
  selectorRow:  { display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' },
  selectorGrupo:  { flex: '1 1 200px' },
  selectorMateria: { flex: '1 1 200px' },
  selectorBtn:    { flex: '0 0 auto' },
  label:   { display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  select:  { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '2px solid #e8eaf6', fontSize: '14px', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', outline: 'none' },
  btnGenerar: {
    padding: '11px 24px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))',
    color: '#fff', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  generandoBanner: {
    display: 'flex', alignItems: 'center', gap: '12px',
    marginTop: '16px', padding: '12px 16px', background: '#f3f0ff',
    borderRadius: '10px', fontSize: '13px', color: '#5c35c2',
  },
  spinner: {
    width: '18px', height: '18px', border: '3px solid #c5b8f7',
    borderTop: '3px solid var(--color-secundario)', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },

  error: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' },

  resultadoCard: { background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  resultadoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' },
  resultadoMeta: { display: 'flex', flexDirection: 'column', gap: '4px' },
  resultadoBadge: { fontSize: '13px', fontWeight: '700', color: '#2e7d32' },
  resultadoInfo:  { fontSize: '16px', fontWeight: '800', color: '#333' },
  resultadoFecha: { fontSize: '12px', color: '#aaa' },
  btnCopiar: {
    padding: '8px 16px', borderRadius: '10px', border: '2px solid #e8eaf6',
    background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
    color: '#555', fontFamily: 'inherit',
  },
  btnNueva: {
    padding: '8px 16px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))',
    color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
    fontFamily: 'inherit',
  },
  separador: { height: '1px', background: '#f0f0f0', margin: '20px 0' },
  observacionTexto: {
    fontSize: '15px', lineHeight: '1.8', color: '#333',
    whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
  },

  placeholder: { background: '#fff', borderRadius: '16px', padding: '60px 32px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  placeholderTitulo: { fontSize: '18px', fontWeight: '700', color: '#555', margin: '12px 0 8px' },
  placeholderSub:    { fontSize: '14px', color: '#aaa', maxWidth: '500px', margin: '0 auto 20px', lineHeight: '1.6' },
  ejemplos:    { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' },
  ejemploChip: { background: '#f3f0ff', color: '#5c35c2', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
};
