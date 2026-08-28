import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconAccessibility, IconDownload, IconBot } from '../components/Icons';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

const CAMPOS = [
  { clave: 'contexto_estudiante',   label: 'Contexto del estudiante', ayuda: 'Hogar, aula, espacios, capacidades, gustos, intereses, apoyo familiar' },
  { clave: 'valoracion_pedagogica', label: 'Valoración pedagógica', ayuda: 'Barreras para el aprendizaje y la participación identificadas' },
  { clave: 'informes_salud',        label: 'Informes de profesionales de la salud', ayuda: 'Resumen de diagnósticos, si existen (opcional)' },
  { clave: 'objetivos_metas',       label: 'Objetivos y metas de aprendizaje' },
  { clave: 'ajustes_curriculares',  label: 'Ajustes curriculares' },
  { clave: 'ajustes_didacticos',    label: 'Ajustes didácticos' },
  { clave: 'ajustes_evaluativos',  label: 'Ajustes evaluativos' },
  { clave: 'recursos_apoyos',       label: 'Recursos físicos, tecnológicos y didácticos' },
  { clave: 'proyectos_especificos', label: 'Proyectos específicos necesarios' },
  { clave: 'actividades_casa',      label: 'Actividades en casa durante recesos' },
  { clave: 'seguimiento',           label: 'Seguimiento', ayuda: 'Temporalidad, responsables y medios' },
];

const FORM_VACIO = CAMPOS.reduce((acc, c) => ({ ...acc, [c.clave]: '' }), {
  docente_apoyo_nombre: '', docente_apoyo_observaciones: '',
});

const ESTADO_BADGE = {
  borrador:    { bg: '#fff8e1', color: '#e65100', label: 'Borrador' },
  activo:      { bg: '#e8f5e9', color: '#2e7d32', label: 'Activo (firmado)' },
  en_revision: { bg: '#e3f2fd', color: '#1565c0', label: 'En revisión' },
  archivado:   { bg: '#f5f5f5', color: '#757575', label: 'Archivado' },
};

export default function PIAR() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const puedeCambiarEstado = usuario.rol === 'director' || usuario.rol === 'admin';

  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [piarActual, setPiarActual] = useState(null);
  const [documentoEditable, setDocumentoEditable] = useState('');
  const [cargandoPiar, setCargandoPiar] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarEstudiantes = useCallback(async () => {
    try {
      const resp = await axiosAuth.get(`/api/piar/colegio/${usuario.colegio_id}`);
      setEstudiantes(resp.data.data);
    } catch {
      setError('No se pudieron cargar los estudiantes. Verifica que haya estudiantes marcados con PIAR.');
    }
  }, [usuario.colegio_id]);

  useEffect(() => { cargarEstudiantes(); }, [cargarEstudiantes]);

  const estudianteInfo = estudiantes.find(e => String(e.estudiante_id) === String(estudianteId));

  async function seleccionarEstudiante(id) {
    setEstudianteId(id);
    setForm(FORM_VACIO);
    setPiarActual(null);
    setDocumentoEditable('');
    setMensaje('');
    setError('');
    if (!id) return;

    setCargandoPiar(true);
    try {
      const resp = await axiosAuth.get(`/api/piar/estudiante/${id}`);
      const piar = resp.data.data;
      if (piar) {
        setPiarActual(piar);
        setDocumentoEditable(piar.documento_generado || '');
        const nuevoForm = { ...FORM_VACIO };
        for (const c of CAMPOS) nuevoForm[c.clave] = piar[c.clave] || '';
        nuevoForm.docente_apoyo_nombre = piar.docente_apoyo_nombre || '';
        nuevoForm.docente_apoyo_observaciones = piar.docente_apoyo_observaciones || '';
        setForm(nuevoForm);
      }
    } catch {
      setError('No se pudo cargar el PIAR existente de este estudiante.');
    } finally {
      setCargandoPiar(false);
    }
  }

  async function generar() {
    if (!estudianteId || !estudianteInfo?.grupo_id || generando) return;
    setGenerando(true);
    setMensaje('');
    setError('');
    try {
      const resp = await axiosAuth.post('/api/piar/generar', {
        estudiante_id: estudianteId,
        grupo_id: estudianteInfo.grupo_id,
        ...form,
      });
      const piar = resp.data.data;
      setPiarActual(piar);
      setDocumentoEditable(piar.documento_generado || '');
      setMensaje('Borrador generado. Revísalo y ajústalo antes de activarlo.');
      await cargarEstudiantes();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar el borrador del PIAR.');
    } finally {
      setGenerando(false);
    }
  }

  async function guardarEdicion() {
    if (!piarActual) return;
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.put(`/api/piar/${piarActual.id}`, { documento_generado: documentoEditable });
      setMensaje('Cambios guardados.');
      setTimeout(() => setMensaje(''), 3000);
    } catch {
      setError('Error al guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(nuevoEstado) {
    if (!piarActual) return;
    try {
      await axiosAuth.put(`/api/piar/${piarActual.id}/estado`, { estado: nuevoEstado });
      setPiarActual({ ...piarActual, estado: nuevoEstado });
      await cargarEstudiantes();
    } catch {
      setError('Error al actualizar el estado.');
    }
  }

  async function descargarPDF() {
    if (!piarActual) return;
    setDescargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get(`/api/piar/${piarActual.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `PIAR_${estudianteInfo?.estudiante || 'estudiante'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch {
      setError('Error al descargar el PDF.');
    } finally {
      setDescargando(false);
    }
  }

  const rutaVolver = usuario.rol === 'docente' ? '/dashboard-docente' : '/dashboard-director';

  return (
    <div style={es.pagina}>
      <Navbar titulo="PIAR — Ajustes Razonables" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(rutaVolver)} style={es.btnVolver}>← Volver al panel</button>
          <h2 style={es.titulo}>
            <IconAccessibility size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#667eea' }} />
            Plan Individual de Ajustes Razonables (PIAR)
          </h2>
          <p style={es.subtitulo}>
            Conforme al Decreto 1421 de 2017. La IA solo redacta el documento oficial a partir de la
            información real que escribas aquí — no inventa diagnósticos ni necesidades.
          </p>
        </div>

        {/* Selector de estudiante */}
        <div style={es.card}>
          <label style={es.label}>Estudiante</label>
          <select value={estudianteId} onChange={e => seleccionarEstudiante(e.target.value)} style={es.select}>
            <option value="">— Selecciona un estudiante con PIAR —</option>
            {estudiantes.map(e => (
              <option key={e.estudiante_id} value={e.estudiante_id}>
                {formatearApellidoPrimero(e.estudiante)} {e.grado ? `— Grado ${e.grado}° ${e.grupo}` : ''}
              </option>
            ))}
          </select>
          {estudiantes.length === 0 && (
            <p style={es.ayuda}>
              Ningún estudiante está marcado con "requiere PIAR" todavía. Márcalo desde la sección Estudiantes.
            </p>
          )}
          {estudianteInfo?.piar_id && (
            <span style={{ ...es.badge, background: ESTADO_BADGE[estudianteInfo.estado]?.bg, color: ESTADO_BADGE[estudianteInfo.estado]?.color, marginTop: 10 }}>
              {ESTADO_BADGE[estudianteInfo.estado]?.label}
            </span>
          )}
        </div>

        {error && <div style={es.error}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {estudianteId && !cargandoPiar && (
          <>
            {/* Formulario con la información real */}
            <div style={es.card}>
              <h3 style={es.cardTitulo}>Información del estudiante (componentes del Decreto 1421)</h3>
              <div style={es.grid}>
                {CAMPOS.map(c => (
                  <div key={c.clave} style={es.campo}>
                    <label style={es.label}>{c.label}</label>
                    {c.ayuda && <p style={es.ayudaCampo}>{c.ayuda}</p>}
                    <textarea
                      value={form[c.clave]}
                      onChange={e => setForm({ ...form, [c.clave]: e.target.value })}
                      style={es.textarea}
                      rows={3}
                    />
                  </div>
                ))}
                <div style={es.campo}>
                  <label style={es.label}>Docente de apoyo pedagógico</label>
                  <p style={es.ayudaCampo}>Nombre del profesional que participa junto con el docente de aula y la familia</p>
                  <input
                    value={form.docente_apoyo_nombre}
                    onChange={e => setForm({ ...form, docente_apoyo_nombre: e.target.value })}
                    style={es.input}
                    placeholder="Nombre del docente de apoyo"
                  />
                  <textarea
                    value={form.docente_apoyo_observaciones}
                    onChange={e => setForm({ ...form, docente_apoyo_observaciones: e.target.value })}
                    style={{ ...es.textarea, marginTop: 8 }}
                    rows={2}
                    placeholder="Observaciones del docente de apoyo (opcional)"
                  />
                </div>
              </div>

              <button onClick={generar} disabled={generando} style={{ ...es.btnGenerar, opacity: generando ? 0.6 : 1 }}>
                {generando ? 'Redactando con IA...' : <><IconBot size={14} style={{ marginRight: 6 }} />Generar borrador con IA</>}
              </button>
            </div>

            {/* Documento generado */}
            {piarActual && (
              <div style={es.card}>
                <div style={es.resultadoHeader}>
                  <h3 style={es.cardTitulo}>Borrador del PIAR</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={descargarPDF} disabled={descargando} style={es.btnSecundario}>
                      <IconDownload size={13} style={{ marginRight: 5 }} />{descargando ? 'Generando...' : 'Descargar PDF (acta)'}
                    </button>
                    <button onClick={guardarEdicion} disabled={guardando} style={es.btnGenerar}>
                      {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>

                <textarea
                  value={documentoEditable}
                  onChange={e => setDocumentoEditable(e.target.value)}
                  style={es.documentoTextarea}
                  rows={18}
                />

                <p style={es.notaLegal}>
                  Este documento debe ser validado y firmado por el docente de aula, el docente de apoyo
                  pedagógico y la familia, según el Decreto 1421 de 2017, antes de marcarse como "Activo".
                </p>

                {puedeCambiarEstado && (
                  <div style={es.acciones}>
                    {piarActual.estado !== 'activo' && (
                      <button onClick={() => cambiarEstado('activo')} style={es.btnActivar}>✓ Marcar como activo (acta firmada)</button>
                    )}
                    {piarActual.estado !== 'en_revision' && (
                      <button onClick={() => cambiarEstado('en_revision')} style={es.btnRevision}>Enviar a revisión</button>
                    )}
                    {piarActual.estado !== 'archivado' && (
                      <button onClick={() => cambiarEstado('archivado')} style={es.btnArchivar}>Archivar</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {cargandoPiar && <div style={es.card}>Cargando información del PIAR...</div>}
      </div>
    </div>
  );
}

const es = {
  pagina:     { minHeight: '100vh', background: '#f0f2f5' },
  contenido:  { padding: '28px 24px', maxWidth: '960px', margin: '0 auto' },
  encabezado: { marginBottom: '24px' },
  btnVolver:  { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', fontWeight: '700', padding: '0 0 10px', fontFamily: 'inherit', display: 'block' },
  titulo:     { fontSize: '22px', fontWeight: '800', color: '#333', margin: 0 },
  subtitulo:  { fontSize: '14px', color: '#888', margin: '6px 0 0', lineHeight: 1.6, maxWidth: 700 },

  card: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px' },
  cardTitulo: { fontSize: '16px', fontWeight: '700', color: '#333', margin: '0 0 14px' },
  label:  { display: 'block', fontSize: '12px', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  select: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '2px solid #e8eaf6', fontSize: '14px', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', outline: 'none' },
  ayuda:  { fontSize: '13px', color: '#aaa', marginTop: '10px' },
  badge:  { display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginBottom: '18px' },
  campo: {},
  ayudaCampo: { fontSize: '12px', color: '#aaa', margin: '0 0 6px' },
  textarea: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '2px solid #e8eaf6', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  input:    { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '2px solid #e8eaf6', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },

  btnGenerar: {
    padding: '11px 24px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer',
  },
  btnSecundario: {
    padding: '10px 18px', borderRadius: '10px', border: '2px solid #e8eaf6',
    background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
    color: '#555', fontFamily: 'inherit',
  },

  error: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' },

  resultadoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  documentoTextarea: {
    width: '100%', padding: '18px', borderRadius: '12px', border: '1px solid #e8eaf6',
    fontSize: '14px', lineHeight: '1.7', fontFamily: 'Georgia, serif', color: '#333',
    outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: '#fafaff',
  },
  notaLegal: { fontSize: '12.5px', color: '#999', marginTop: '14px', lineHeight: 1.6, fontStyle: 'italic' },

  acciones: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  btnActivar:   { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnRevision:  { background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnArchivar:  { background: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
};
