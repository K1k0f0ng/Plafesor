import React, { useState, useEffect, useRef, useCallback } from 'react';
import axiosAuth from '../config/axios';

const TIPO_COLOR = {
  riesgo_critico: '#c62828',
  riesgo_alto:    '#e65100',
};

const TIPO_LABEL = {
  riesgo_critico: 'CRÍTICO',
  riesgo_alto:    'ALTO',
};

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000);
  if (diff < 60)    return 'Hace un momento';
  if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} d`;
}

export default function NotificacionBell() {
  const [notifs,  setNotifs]  = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const dropRef               = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await axiosAuth.get('/api/notificaciones');
      setNotifs(data.data  || []);
      setSinLeer(data.sinLeer || 0);
    } catch {
      // silencioso — no interrumpe la UI si falla el poll
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function marcarTodas() {
    try {
      await axiosAuth.patch('/api/notificaciones/leer-todas');
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
      setSinLeer(0);
    } catch { /* silencioso */ }
  }

  async function marcarUna(id) {
    try {
      await axiosAuth.patch(`/api/notificaciones/${id}/leer`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
      setSinLeer(prev => Math.max(0, prev - 1));
    } catch { /* silencioso */ }
  }

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>

      <button
        onClick={() => setAbierto(v => !v)}
        style={{ ...es.bell, ...(sinLeer > 0 ? es.bellActivo : {}) }}
        title="Notificaciones"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {sinLeer > 0 && (
          <span style={es.badge}>{sinLeer > 9 ? '9+' : sinLeer}</span>
        )}
      </button>

      {abierto && (
        <div style={es.dropdown}>
          <div style={es.dropHeader}>
            <span style={es.dropTitulo}>Notificaciones</span>
            {sinLeer > 0 && (
              <button onClick={marcarTodas} style={es.btnLeer}>
                Marcar todas
              </button>
            )}
          </div>

          <div style={es.lista}>
            {notifs.length === 0 ? (
              <div style={es.vacio}>Sin notificaciones</div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  style={{ ...es.item, background: n.leida ? '#fff' : '#f8f8ff' }}
                  onClick={() => { if (!n.leida) marcarUna(n.id); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      ...es.tipoPill,
                      background: (TIPO_COLOR[n.tipo] || '#666') + '18',
                      color: TIPO_COLOR[n.tipo] || '#666',
                    }}>
                      {TIPO_LABEL[n.tipo] || n.tipo}
                    </span>
                    {!n.leida && <span style={es.puntito} />}
                  </div>
                  <div style={es.itemTitulo}>{n.titulo}</div>
                  <div style={es.itemMsg}>{n.mensaje}</div>
                  <div style={es.itemFecha}>{tiempoRelativo(n.creado_en)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const es = {
  bell: {
    position: 'relative',
    background: 'transparent',
    border: '1px solid #eeeeee',
    borderRadius: '8px',
    padding: '6px 7px',
    cursor: 'pointer',
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  bellActivo: {
    borderColor: '#ffcdd2',
    color: '#c62828',
    background: '#fff5f5',
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: '#e53935',
    color: '#fff',
    fontSize: '9px',
    fontWeight: '800',
    borderRadius: '10px',
    padding: '1px 4px',
    lineHeight: '1.4',
    minWidth: '14px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  dropdown: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: 0,
    width: '296px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
    border: '1px solid #eeeff3',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px 10px',
    borderBottom: '1px solid #f3f3f7',
  },
  dropTitulo: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1a1a2e',
  },
  btnLeer: {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    color: '#667eea',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    fontWeight: '600',
  },
  lista: {
    maxHeight: '340px',
    overflowY: 'auto',
  },
  vacio: {
    padding: '28px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#ccc',
  },
  item: {
    padding: '10px 14px',
    borderBottom: '1px solid #f5f5f8',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  tipoPill: {
    fontSize: '9px',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  puntito: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#667eea',
    flexShrink: 0,
  },
  itemTitulo: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#222',
    lineHeight: '1.3',
  },
  itemMsg: {
    fontSize: '11.5px',
    color: '#666',
    marginTop: '3px',
    lineHeight: '1.4',
  },
  itemFecha: {
    fontSize: '10px',
    color: '#bbb',
    marginTop: '5px',
  },
};
