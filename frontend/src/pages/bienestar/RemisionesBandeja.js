import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { IconInbox } from '../../components/Icons';
import { PRIORIDAD, ESTADO_REMISION as ESTADOS, ROL_REMITENTE as ROL, Chip, fecha } from './comun';
import AbrirCasoModal from './AbrirCasoModal';

// Bandeja de remisiones del equipo de orientación.

const PESTANAS = [
  { valor: 'pendiente',   nombre: 'Pendientes' },
  { valor: 'recibida',    nombre: 'Recibidas' },
  { valor: 'en_revision', nombre: 'En revisión' },
  { valor: '',            nombre: 'Todas' },
];

export default function RemisionesBandeja() {
  const navigate = useNavigate();
  const [abrirCaso, setAbrirCaso] = useState(false);
  const [pestana, setPestana] = useState('pendiente');
  const [lista, setLista] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [devolucionActiva, setDevolucionActiva] = useState(false);   // opción del colegio
  const [modo, setModo] = useState(null);          // 'archivar' | 'devolucion'
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setLista(null);
    try {
      const r = await axiosAuth.get(`/api/bienestar/remisiones${pestana ? `?estado=${pestana}` : ''}`);
      setLista(r.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las remisiones');
      setLista([]);
    }
  }, [pestana]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    axiosAuth.get('/api/bienestar/estado')
      .then(r => setDevolucionActiva(!!r.data.data?.devolucion_docente))
      .catch(() => setDevolucionActiva(false));
  }, []);

  async function abrir(id) {
    setError(''); setModo(null); setTexto('');
    try {
      const r = await axiosAuth.get(`/api/bienestar/remisiones/${id}`);
      setDetalle(r.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir la remisión');
    }
  }

  async function accion(ruta, cuerpo, mensaje) {
    setOcupado(true); setError('');
    try {
      await axiosAuth.patch(`/api/bienestar/remisiones/${detalle.id}/${ruta}`, cuerpo);
      setAviso(mensaje); setTimeout(() => setAviso(''), 3000);
      setModo(null); setTexto('');
      await abrir(detalle.id);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar la acción');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Remisiones" />
      <div style={es.contenido}>
        <div style={es.tabs}>
          {PESTANAS.map(p => (
            <button key={p.valor} onClick={() => setPestana(p.valor)}
              style={{ ...es.tab, ...(pestana === p.valor ? es.tabActiva : {}) }}>
              {p.nombre}
            </button>
          ))}
        </div>

        {aviso && <div style={es.exito}>{aviso}</div>}
        {error && !detalle && <div style={es.errorBox}>{error}</div>}

        {lista === null ? <p style={es.gris}>Cargando...</p> : lista.length === 0 ? (
          <div style={es.vacio}>
            <IconInbox size={40} style={{ color: '#ccc' }} />
            <p>No hay remisiones {pestana ? `en “${PESTANAS.find(p => p.valor === pestana)?.nombre.toLowerCase()}”` : ''}.</p>
          </div>
        ) : (
          <div style={es.lista}>
            {lista.map(r => (
              <button key={r.id} onClick={() => abrir(r.id)} style={es.fila}>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={es.nombre}>
                    {r.estudiante}
                    {r.tiene_caso_abierto && <span style={es.chipCaso}>Tiene caso abierto</span>}
                  </div>
                  <div style={es.meta}>
                    {r.grado}° {r.grupo} · {r.motivo || 'Sin motivo'} · {r.remitente ? `${ROL[r.remitente_rol] || ''} ${r.remitente}` : 'Señal automática'} · {fecha(r.creado_en)}
                  </div>
                </div>
                <div style={es.chips}>
                  <Chip def={PRIORIDAD[r.prioridad]} />
                  <Chip def={ESTADOS[r.estado]} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {detalle && (
        <>
          <div style={es.fondo} onClick={() => setDetalle(null)} />
          <aside style={es.panel} aria-label="Detalle de la remisión">
            <div style={es.panelCabecera}>
              <div>
                <div style={es.panelTitulo}>{detalle.estudiante}</div>
                <div style={es.panelSub}>{detalle.grado}° {detalle.grupo} · recibida {fecha(detalle.creado_en, true)}</div>
              </div>
              <button onClick={() => setDetalle(null)} style={es.cerrar} aria-label="Cerrar">✕</button>
            </div>

            <div style={es.panelCuerpo}>
              <div style={es.chips}>
                <Chip def={PRIORIDAD[detalle.prioridad]} />
                <Chip def={ESTADOS[detalle.estado]} />
              </div>

              <Campo titulo="Motivo">{detalle.motivo}</Campo>
              <Campo titulo="Remitido por">{detalle.remitente ? `${detalle.remitente} (${ROL[detalle.remitente_rol] || detalle.remitente_rol})` : 'Señal automática'}</Campo>
              <Campo titulo="Lo observado"><span style={{ whiteSpace: 'pre-wrap' }}>{detalle.descripcion || '—'}</span></Campo>
              {detalle.observaciones && <Campo titulo="Observaciones"><span style={{ whiteSpace: 'pre-wrap' }}>{detalle.observaciones}</span></Campo>}
              <Campo titulo="¿Familia enterada?">
                {detalle.familia_informada === null ? 'No indicado' : detalle.familia_informada ? 'Sí' : 'No'}
              </Campo>
              {detalle.recibida_por_nombre && <Campo titulo="Recibida por">{detalle.recibida_por_nombre} · {fecha(detalle.recibida_en, true)}</Campo>}
              {detalle.devolucion && <Campo titulo="Devolución enviada al remitente">{detalle.devolucion}</Campo>}
              {detalle.motivo_archivo && <Campo titulo="Motivo de archivo">{detalle.motivo_archivo}</Campo>}

              {error && <div style={es.errorBox}>{error}</div>}

              {modo && (
                <div style={es.cajaTexto}>
                  <label style={es.label}>
                    {modo === 'archivar' ? '¿Por qué se archiva sin abrir caso?' : 'Devolución al remitente (no confidencial)'}
                  </label>
                  {modo === 'devolucion' && (
                    <p style={es.guia}>Solo información útil para el aula. No incluyas detalles del estudiante ni de su familia.</p>
                  )}
                  <textarea style={es.textarea} maxLength={1000} value={texto} onChange={e => setTexto(e.target.value)} />
                  <div style={es.botones}>
                    <button onClick={() => { setModo(null); setTexto(''); }} style={es.btnSecundario}>Cancelar</button>
                    <button disabled={ocupado} style={es.btnPrimario}
                      onClick={() => modo === 'archivar'
                        ? accion('archivar', { motivo: texto }, 'Remisión archivada')
                        : accion('devolucion', { texto }, 'Devolución enviada')}>
                      {ocupado ? 'Guardando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!modo && (
              <div style={es.panelPie}>
                {detalle.caso_id && (
                  <button onClick={() => navigate(`/bienestar/casos/${detalle.caso_id}`)} style={es.btnPrimario}>Ver caso</button>
                )}
                {!detalle.caso_id && !['cerrada', 'archivada'].includes(detalle.estado) && (detalle.caso_abierto_id ? (
                  <button disabled={ocupado} style={es.btnPrimario} onClick={async () => {
                    setOcupado(true); setError('');
                    try {
                      await axiosAuth.post(`/api/bienestar/remisiones/${detalle.id}/vincular`, { caso_id: detalle.caso_abierto_id });
                      navigate(`/bienestar/casos/${detalle.caso_abierto_id}`);
                    } catch (err) {
                      setError(err.response?.data?.error || 'No se pudo vincular la remisión');
                      setOcupado(false);
                    }
                  }}>
                    Vincular al caso abierto
                  </button>
                ) : (
                  <button onClick={() => setAbrirCaso(true)} style={es.btnPrimario}>Abrir caso</button>
                ))}
                {detalle.estado === 'pendiente' && (
                  <button disabled={ocupado} onClick={() => accion('recibir', {}, 'Remisión recibida')} style={es.btnSecundario}>Recibir</button>
                )}
                {detalle.estado === 'recibida' && (
                  <button disabled={ocupado} onClick={() => accion('revision', {}, 'Remisión en revisión')} style={es.btnSecundario}>Pasar a revisión</button>
                )}
                {devolucionActiva && detalle.estado !== 'pendiente' && detalle.remitente && (
                  <button onClick={() => { setModo('devolucion'); setTexto(detalle.devolucion || ''); }} style={es.btnSecundario}>
                    Devolución al remitente
                  </button>
                )}
                {!['cerrada', 'archivada', 'en_seguimiento'].includes(detalle.estado) && (
                  <button onClick={() => setModo('archivar')} style={es.btnSecundario}>Archivar</button>
                )}
              </div>
            )}
          </aside>
        </>
      )}

      {abrirCaso && detalle && (
        <AbrirCasoModal
          inicial={{
            estudiante_id: detalle.estudiante_id, estudiante: `${detalle.estudiante} · ${detalle.grado}° ${detalle.grupo}`,
            remision_id: detalle.id, motivo_id: detalle.motivo_id, prioridad: detalle.prioridad,
          }}
          onCerrar={() => setAbrirCaso(false)}
          onAbierto={(id) => navigate(`/bienestar/casos/${id}`)}
        />
      )}
    </div>
  );
}

function Campo({ titulo, children }) {
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={es.etiqueta}>{titulo}</div>
      <div style={es.valor}>{children}</div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' },
  tab: { background: '#fff', border: '1px solid #e6e8f0', borderRadius: '999px', padding: '7px 16px', fontSize: '13px', fontWeight: 600, color: '#666', cursor: 'pointer', fontFamily: 'inherit' },
  tabActiva: { background: '#667eea', border: '1px solid #667eea', color: '#fff' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  fila: { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', border: 'none', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', fontFamily: 'inherit', width: '100%', flexWrap: 'wrap' },
  nombre: { fontSize: '15px', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  meta: { fontSize: '12.5px', color: '#999', marginTop: '3px' },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chipCaso: { background: '#e0f2f1', color: '#00796b', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 },
  vacio: { background: '#fff', borderRadius: '14px', padding: '40px 20px', textAlign: 'center', color: '#999', fontSize: '14px' },
  gris: { color: '#888', fontSize: '14px' },
  fondo: { position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.35)', zIndex: 100 },
  panel: { position: 'fixed', top: 0, right: 0, width: '460px', maxWidth: '100vw', height: '100vh', background: '#fff', zIndex: 101, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' },
  panelCabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', padding: '18px 20px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff' },
  panelTitulo: { fontSize: '17px', fontWeight: 800 },
  panelSub: { fontSize: '12.5px', opacity: 0.85, marginTop: '2px' },
  cerrar: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', flexShrink: 0 },
  panelCuerpo: { padding: '18px 20px', flex: 1, overflowY: 'auto' },
  panelPie: { display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '14px 20px', borderTop: '1px solid #f0f0f5' },
  etiqueta: { fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' },
  valor: { fontSize: '14px', color: '#333', lineHeight: 1.6, marginTop: '3px' },
  cajaTexto: { marginTop: '18px', background: '#fafbff', border: '1px solid #e6e8f5', borderRadius: '12px', padding: '14px' },
  label: { fontSize: '13px', fontWeight: 700, color: '#555', display: 'block', marginBottom: '6px' },
  guia: { fontSize: '12px', color: '#888', margin: '0 0 8px', lineHeight: 1.5 },
  textarea: { width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
  botones: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginTop: '12px' },
};
