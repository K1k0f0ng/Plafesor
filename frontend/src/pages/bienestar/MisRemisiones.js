import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';

// Remisiones que hizo el usuario, con estado simplificado. Nunca muestra
// quién la atiende ni nada del caso.
export const ESTADOS_REMITENTE = {
  enviada:     { nombre: 'Enviada',                  color: '#6b7280', fondo: '#f1f2f4' },
  recibida:    { nombre: 'Recibida por orientación', color: '#1565c0', fondo: '#e3f2fd' },
  en_atencion: { nombre: 'En atención',              color: '#5a4fcf', fondo: '#efedff' },
  atendida:    { nombre: 'Atendida',                 color: '#2e7d32', fondo: '#e8f5e9' },
};

function fecha(f) {
  try { return new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}

export default function MisRemisiones() {
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosAuth.get('/api/bienestar/remisiones/mias')
      .then(r => setLista(r.data.data || []))
      .catch(err => { setError(err.response?.data?.error || 'No se pudieron cargar tus remisiones'); setLista([]); });
  }, []);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mis remisiones" />
      <div style={es.contenido}>
        <div style={es.encabezado}>
          <p style={es.ayuda}>El detalle del acompañamiento es confidencial; aquí solo ves en qué estado está cada remisión.</p>
          <button onClick={() => navigate('/bienestar/remitir')} style={es.btnPrimario}>+ Nueva remisión</button>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {lista === null && <p style={es.ayuda}>Cargando...</p>}
        {lista?.length === 0 && !error && <div style={es.vacio}>Aún no has remitido estudiantes a orientación.</div>}

        <div style={es.lista}>
          {(lista || []).map(r => {
            const est = ESTADOS_REMITENTE[r.estado] || ESTADOS_REMITENTE.enviada;
            const abiertaEsta = abierta === r.id;
            return (
              <div key={r.id} style={es.card}>
                <button onClick={() => setAbierta(abiertaEsta ? null : r.id)} style={es.fila} aria-expanded={abiertaEsta}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={es.nombre}>{r.estudiante}</div>
                    <div style={es.meta}>{r.grado}° {r.grupo} · {r.motivo} · {fecha(r.creado_en)}</div>
                  </div>
                  <span style={{ ...es.chip, color: est.color, background: est.fondo }}>{est.nombre}</span>
                </button>
                {abiertaEsta && (
                  <div style={es.detalle}>
                    <div style={es.etiqueta}>Lo que escribiste</div>
                    <p style={es.texto}>{r.descripcion || '—'}</p>
                    {r.devolucion && (
                      <>
                        <div style={es.etiqueta}>Devolución de orientación</div>
                        <p style={{ ...es.texto, background: '#f3f4ff', borderRadius: '8px', padding: '10px 12px' }}>{r.devolucion}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  ayuda: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5, flex: 1, minWidth: '220px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { background: '#fff', borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' },
  fila: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexWrap: 'wrap' },
  nombre: { fontSize: '15px', fontWeight: 700, color: '#1a1a2e' },
  meta: { fontSize: '12.5px', color: '#999', marginTop: '2px' },
  chip: { borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  detalle: { padding: '0 16px 16px', borderTop: '1px solid #f2f2f5' },
  etiqueta: { fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '12px 0 4px' },
  texto: { fontSize: '14px', color: '#333', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' },
  vacio: { background: '#fff', borderRadius: '14px', padding: '32px', textAlign: 'center', color: '#999', fontSize: '14px' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
};
