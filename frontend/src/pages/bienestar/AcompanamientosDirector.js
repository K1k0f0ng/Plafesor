import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { IconShield } from '../../components/Icons';
import { fecha, estilos as s } from './comun';

// Vista del director: qué estudiantes están en acompañamiento, desde cuándo y
// con quién. SIN motivo, seguimientos ni notas — eso es del equipo de orientación.
export default function AcompanamientosDirector() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosAuth.get('/api/bienestar/acompanamientos')
      .then(r => setLista(r.data.data || []))
      .catch(err => { setError(err.response?.data?.error || 'No se pudo cargar la información'); setLista([]); });
  }, []);

  return (
    <div style={s.pagina}>
      <Navbar titulo="Acompañamientos de orientación" />
      <div style={es.contenido}>
        <div style={es.aviso}>
          <IconShield size={16} style={{ flexShrink: 0 }} />
          Solo ves el estado. El motivo y el detalle del acompañamiento son confidenciales del equipo de orientación.
        </div>
        {error && <div style={s.errorBox}>{error}</div>}
        {lista === null ? <p style={s.gris}>Cargando...</p> : lista.length === 0 ? (
          <div style={es.vacio}>No hay estudiantes en acompañamiento en este momento.</div>
        ) : (
          <div style={s.card}>
            <div style={es.resumen}>{lista.length} estudiante{lista.length === 1 ? '' : 's'} en acompañamiento</div>
            <table style={es.tabla}>
              <thead>
                <tr>{['Estudiante', 'Grado', 'Desde', 'Responsable'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...es.td, fontWeight: 700 }}>{c.estudiante}</td>
                    <td style={es.td}>{c.grado ? `${c.grado}° ${c.grupo}` : '—'}</td>
                    <td style={es.td}>{fecha(c.abierto_en)}</td>
                    <td style={es.td}>{c.responsable || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' },
  aviso: { display: 'flex', gap: '8px', alignItems: 'center', background: '#f3f1ff', border: '1px solid #e0dcff', color: '#4a4380', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px' },
  resumen: { fontSize: '14px', fontWeight: 700, color: '#333', marginBottom: '10px' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: '12px', fontWeight: 700, color: '#888', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '10px', fontSize: '14px', color: '#333', borderBottom: '1px solid #f5f5f5' },
  vacio: { background: '#fff', borderRadius: '14px', padding: '32px', textAlign: 'center', color: '#999', fontSize: '14px' },
};
