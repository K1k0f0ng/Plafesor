import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { IconClipboard } from '../../components/Icons';
import { PRIORIDAD, ESTADO_CASO, Chip, fecha, estilos as s } from './comun';
import AbrirCasoModal from './AbrirCasoModal';

const FILTROS = [
  { valor: 'abiertos', nombre: 'Abiertos' },
  { valor: 'cerrado',  nombre: 'Cerrados' },
  { valor: 'todos',    nombre: 'Todos' },
];

export default function Casos() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('abiertos');
  const [lista, setLista] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [abrir, setAbrir] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLista(null); setError('');
    try {
      const r = await axiosAuth.get(`/api/bienestar/casos?estado=${filtro}`);
      setLista(r.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los casos');
      setLista([]);
    }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return !q || !lista ? lista : lista.filter(c => `${c.estudiante} ${c.grado} ${c.grupo} ${c.responsable}`.toLowerCase().includes(q));
  }, [busqueda, lista]);

  return (
    <div style={s.pagina}>
      <Navbar titulo="Casos" />
      <div style={es.contenido}>
        <div style={es.barra}>
          <div style={es.tabs}>
            {FILTROS.map(f => (
              <button key={f.valor} onClick={() => setFiltro(f.valor)} style={{ ...es.tab, ...(filtro === f.valor ? es.tabActiva : {}) }}>
                {f.nombre}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <input style={{ ...s.input, maxWidth: '260px' }} placeholder="Buscar estudiante o responsable..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <button onClick={() => setAbrir(true)} style={s.btnPrimario}>+ Abrir caso</button>
          </div>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        {visibles === null ? <p style={s.gris}>Cargando...</p> : visibles.length === 0 ? (
          <div style={es.vacio}>
            <IconClipboard size={40} style={{ color: '#ccc' }} />
            <p>{busqueda ? 'Ningún caso coincide con la búsqueda.' : 'No hay casos en esta vista.'}</p>
          </div>
        ) : (
          <div style={es.lista}>
            {visibles.map(c => (
              <button key={c.id} onClick={() => navigate(`/bienestar/casos/${c.id}`)} style={es.fila}>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={es.nombre}>
                    {c.estudiante}
                    {c.compromisos_vencidos > 0 && (
                      <span style={es.chipAlerta}>{c.compromisos_vencidos} compromiso{c.compromisos_vencidos === 1 ? '' : 's'} vencido{c.compromisos_vencidos === 1 ? '' : 's'}</span>
                    )}
                  </div>
                  <div style={es.meta}>
                    {c.grado ? `${c.grado}° ${c.grupo} · ` : ''}{c.motivo || 'Sin motivo'} · Responsable: {c.responsable || '—'}
                  </div>
                  <div style={es.meta}>
                    Abierto {fecha(c.abierto_en)}
                    {c.ultimo_seguimiento ? ` · Último seguimiento ${fecha(c.ultimo_seguimiento)}` : ' · Sin seguimientos aún'}
                    {c.cerrado_en ? ` · Cerrado ${fecha(c.cerrado_en)}` : ''}
                  </div>
                </div>
                <div style={es.chips}>
                  <Chip def={PRIORIDAD[c.prioridad]} />
                  <Chip def={ESTADO_CASO[c.estado]} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {abrir && (
        <AbrirCasoModal onCerrar={() => setAbrir(false)} onAbierto={(id) => navigate(`/bienestar/casos/${id}`)} />
      )}
    </div>
  );
}

const es = {
  contenido: { padding: '24px', maxWidth: '1050px', margin: '0 auto', width: '100%' },
  barra: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  tab: { background: '#fff', border: '1px solid #e6e8f0', borderRadius: '999px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, color: '#666', cursor: 'pointer', fontFamily: 'inherit' },
  tabActiva: { background: '#667eea', border: '1px solid #667eea', color: '#fff' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  fila: { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', border: 'none', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', flexWrap: 'wrap' },
  nombre: { fontSize: '15px', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  meta: { fontSize: '12.5px', color: '#999', marginTop: '3px' },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chipAlerta: { background: '#ffebee', color: '#c62828', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 },
  vacio: { background: '#fff', borderRadius: '14px', padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: '14px' },
};
