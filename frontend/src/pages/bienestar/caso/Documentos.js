import React, { useRef, useState } from 'react';
import axiosAuth from '../../../config/axios';
import { fecha, estilos as s } from '../comun';

// Descarga un adjunto del módulo (el servidor verifica el permiso y lo descifra)
export async function descargarAdjunto(adj) {
  const r = await axiosAuth.get(`/api/bienestar/adjuntos/${adj.id}/descargar`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = adj.nombre_original || 'documento';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function peso(b) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

// Pestaña de documentos del caso (y los adjuntos de sus remisiones)
export default function Documentos({ caso, onCambio }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subir(e) {
    const archivos = Array.from(e.target.files || []);
    if (!archivos.length) return;
    const datos = new FormData();
    archivos.forEach(a => datos.append('archivos', a));
    setSubiendo(true); setError('');
    try {
      await axiosAuth.post(`/api/bienestar/casos/${caso.id}/adjuntos`, datos, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCambio();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron subir los documentos');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function bajar(adj) {
    setError('');
    try { await descargarAdjunto(adj); } catch { setError('No se pudo descargar el documento'); }
  }

  return (
    <div>
      {caso.permisos.editable && (
        <div style={es.subir}>
          <input ref={inputRef} id="adjuntosCaso" type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx" onChange={subir} />
          <label htmlFor="adjuntosCaso" style={{ ...s.btnPrimario, display: 'inline-block', opacity: subiendo ? 0.6 : 1, cursor: subiendo ? 'not-allowed' : 'pointer' }}>
            {subiendo ? 'Subiendo...' : '+ Agregar documentos'}
          </label>
          <span style={es.pista}>PDF, imagen, Word o Excel · máximo 5 MB cada uno. Se guardan cifrados.</span>
        </div>
      )}
      {error && <div style={s.errorBox}>{error}</div>}
      {caso.adjuntos.length === 0 ? (
        <div style={es.vacio}>No hay documentos.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {caso.adjuntos.map(a => (
            <div key={a.id} style={es.fila}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={es.nombre}>{a.nombre_original}</div>
                <div style={es.meta}>
                  {peso(a.tamano)} · {fecha(a.creado_en)}{a.subido_por ? ` · ${a.subido_por}` : ''}{a.remision_id ? ' · adjunto de la remisión' : ''}
                </div>
              </div>
              <button onClick={() => bajar(a)} style={es.btnMini}>Descargar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const es = {
  subir: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' },
  pista: { fontSize: '12px', color: '#999' },
  fila: { display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', border: '1px solid #eef0f5', borderRadius: '12px', padding: '12px 14px' },
  nombre: { fontSize: '14px', fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '12px', color: '#999', marginTop: '2px' },
  btnMini: { background: '#fff', border: '1px solid #dde0f0', color: '#667eea', borderRadius: '8px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  vacio: { background: '#fafbff', border: '1px dashed #dde0f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#999', fontSize: '14px' },
};
