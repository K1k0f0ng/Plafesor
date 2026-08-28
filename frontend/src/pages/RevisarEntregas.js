import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconDownload, IconInbox } from '../components/Icons';

function FilaEntrega({ entrega, onCalificar }) {
  const [nota, setNota] = useState(entrega.nota !== null ? String(entrega.nota) : '');
  const [comentario, setComentario] = useState(entrega.comentario_docente || '');
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  const tieneEntrega = Boolean(entrega.resultado_id);
  const calificada = entrega.nota !== null;

  async function descargar() {
    setDescargando(true);
    try {
      const resp = await axiosAuth.get(`/api/actividades/entregas/${entrega.resultado_id}/archivo`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = entrega.archivo_nombre_original || 'entrega';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorLocal('No se pudo descargar el archivo');
    } finally {
      setDescargando(false);
    }
  }

  async function guardar() {
    const notaNum = parseFloat(nota);
    if (isNaN(notaNum) || notaNum < 1.0 || notaNum > 5.0) {
      setErrorLocal('La nota debe estar entre 1.0 y 5.0');
      return;
    }
    setErrorLocal('');
    setGuardando(true);
    try {
      await onCalificar(entrega.resultado_id, notaNum, comentario);
    } catch (err) {
      setErrorLocal(err.response?.data?.error || 'Error al guardar la calificación');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={re.fila}>
      <div style={re.nombreCol}>
        <span style={re.nombre}>{entrega.nombre}</span>
        {!tieneEntrega && <span style={{ ...re.estado, ...re.estadoSinEntregar }}>Sin entregar</span>}
        {tieneEntrega && !calificada && <span style={{ ...re.estado, ...re.estadoPendiente }}>Pendiente de revisión</span>}
        {tieneEntrega && calificada && <span style={{ ...re.estado, ...re.estadoCalificada }}>Calificada</span>}
      </div>

      {tieneEntrega ? (
        <>
          <button onClick={descargar} disabled={descargando} style={re.btnDescargar}>
            <IconDownload size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            {descargando ? 'Descargando...' : (entrega.archivo_nombre_original || 'Descargar archivo')}
          </button>
          <input type="number" min="1" max="5" step="0.1" value={nota} disabled={calificada}
            onChange={e => setNota(e.target.value)} placeholder="Nota" style={re.inputNota} />
          <textarea value={comentario} disabled={calificada}
            onChange={e => setComentario(e.target.value)}
            placeholder="Retroalimentación (opcional)" style={re.textareaComentario} rows={2} />
          {!calificada && (
            <button onClick={guardar} disabled={guardando} style={re.btnGuardar}>
              {guardando ? 'Guardando...' : 'Guardar calificación'}
            </button>
          )}
          {errorLocal && <span style={re.errorLinea}>{errorLocal}</span>}
        </>
      ) : (
        <span style={re.textoGris}>El estudiante todavía no ha subido su trabajo.</span>
      )}
    </div>
  );
}

export default function RevisarEntregas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [actividad, setActividad] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [rAct, rEnt] = await Promise.all([
        axiosAuth.get(`/api/actividades/${id}`),
        axiosAuth.get(`/api/actividades/${id}/entregas`),
      ]);
      setActividad(rAct.data.data);
      setEntregas(rEnt.data.data);
    } catch {
      setError('No se pudieron cargar las entregas.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function calificar(resultadoId, notaNum, comentario) {
    await axiosAuth.post(`/api/actividades/entregas/${resultadoId}/calificar`, { nota: notaNum, comentario });
    await cargar();
  }

  const contenido = actividad ? (typeof actividad.contenido === 'string' ? JSON.parse(actividad.contenido) : actividad.contenido) : null;
  const totalEntregadas = entregas.filter(e => e.resultado_id).length;
  const totalCalificadas = entregas.filter(e => e.nota !== null).length;

  return (
    <div style={re.pagina}>
      <Navbar titulo="Revisar entregas" />
      <div style={re.contenido}>
        <button onClick={() => navigate('/mis-actividades')} style={re.btnVolver}>← Volver a mis actividades</button>

        {cargando ? (
          <p style={re.textoGris}>Cargando...</p>
        ) : error ? (
          <div style={re.errorBox}>{error}</div>
        ) : (
          <>
            <div style={re.card}>
              <h2 style={re.titulo}>{actividad?.titulo}</h2>
              {contenido?.instrucciones && <p style={re.instrucciones}>{contenido.instrucciones}</p>}
              <div style={re.statsRow}>
                <span style={re.stat}>{entregas.length} estudiantes</span>
                <span style={re.stat}>{totalEntregadas} entregaron</span>
                <span style={re.stat}>{totalCalificadas} calificadas</span>
              </div>
            </div>

            {entregas.length === 0 ? (
              <div style={re.sinDatos}>
                <IconInbox size={48} style={{ color: '#ccc' }} />
                <p>No hay estudiantes en este grupo.</p>
              </div>
            ) : (
              <div style={re.card}>
                {entregas.map(en => (
                  <FilaEntrega key={en.estudiante_id} entrega={en} onCalificar={calificar} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const re = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  titulo: { fontSize: 19, fontWeight: 800, color: '#333', margin: '0 0 8px' },
  instrucciones: { color: '#666', fontSize: 14, lineHeight: 1.6, background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 10, padding: '10px 14px', margin: '0 0 14px' },
  statsRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  stat: { background: '#f0f0ff', color: '#667eea', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 },
  fila: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '14px 0', borderBottom: '1px solid #f0f0f0' },
  nombreCol: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160, flex: '1 1 160px' },
  nombre: { fontWeight: 700, color: '#333', fontSize: 14 },
  estado: { fontSize: 11, fontWeight: 700, borderRadius: 12, padding: '2px 10px', width: 'fit-content' },
  estadoSinEntregar: { background: '#f5f5f5', color: '#999' },
  estadoPendiente: { background: '#fff8e1', color: '#e65100' },
  estadoCalificada: { background: '#e8f5e9', color: '#2e7d32' },
  btnDescargar: { background: '#f0f0ff', border: '1px solid #d8d8ff', color: '#667eea', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  inputNota: { width: 70, padding: '8px 10px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  textareaComentario: { flex: '1 1 220px', minWidth: 180, padding: '8px 10px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' },
  btnGuardar: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  errorLinea: { color: '#c62828', fontSize: 12, width: '100%' },
  textoGris: { color: '#888', fontSize: 14 },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  sinDatos: { background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
};
