import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { IconShield } from '../../components/Icons';
import { PRIORIDAD, ESTADO_CASO, Chip, fecha, estilos as s } from './comun';
import LineaTiempo from './caso/LineaTiempo';
import Seguimientos from './caso/Seguimientos';
import Compromisos from './caso/Compromisos';
import Documentos from './caso/Documentos';

const PESTANAS = [
  { id: 'linea', nombre: 'Línea de tiempo' },
  { id: 'seguimientos', nombre: 'Seguimientos' },
  { id: 'compromisos', nombre: 'Compromisos' },
  { id: 'documentos', nombre: 'Documentos' },
  { id: 'datos', nombre: 'Datos del caso' },
];

const NIVEL_RIESGO = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' };

// Contexto académico de solo lectura, tomado de Playfesor (no son conclusiones)
function Contexto({ c }) {
  const tendencia = c.promedio_60_dias !== null && c.promedio_periodo_anterior !== null
    ? Math.round((c.promedio_60_dias - c.promedio_periodo_anterior) * 10) / 10 : null;
  const datos = [
    { titulo: 'Promedio (60 días)', valor: c.promedio_60_dias ?? '—',
      nota: tendencia !== null ? `${tendencia > 0 ? '+' : ''}${tendencia} vs. período anterior` : '' },
    { titulo: 'Ausencias (30 días)', valor: c.ausencias_30_dias, nota: c.tardanzas_30_dias ? `${c.tardanzas_30_dias} tardanzas` : '' },
    { titulo: 'Riesgo académico', valor: NIVEL_RIESGO[c.riesgo_academico] || '—', nota: c.materias_en_riesgo ? `${c.materias_en_riesgo} materias alto/crítico` : '' },
    { titulo: 'Anotaciones de mejora', valor: c.anotaciones_mejora_30_dias, nota: 'últimos 30 días' },
    { titulo: 'PIAR', valor: c.tiene_piar ? 'Sí' : 'No', nota: '' },
  ];
  return (
    <div style={es.contexto}>
      {datos.map(d => (
        <div key={d.titulo} style={es.dato}>
          <div style={es.datoTitulo}>{d.titulo}</div>
          <div style={es.datoValor}>{d.valor}</div>
          {d.nota && <div style={es.datoNota}>{d.nota}</div>}
        </div>
      ))}
    </div>
  );
}

function DatosCaso({ caso, onCambio }) {
  const [f, setF] = useState({ prioridad: caso.prioridad, motivo_detalle: caso.motivo_detalle || '', antecedentes: caso.antecedentes || '' });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const editable = caso.permisos.editable;

  async function guardar(e) {
    e.preventDefault();
    setOcupado(true); setError('');
    try {
      await axiosAuth.patch(`/api/bienestar/casos/${caso.id}`, f);
      setAviso('Datos guardados'); setTimeout(() => setAviso(''), 2500);
      onCambio();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      {aviso && <div style={s.exito}>{aviso}</div>}
      {error && <div style={s.errorBox}>{error}</div>}
      <div style={s.campo}>
        <label style={s.label}>Prioridad</label>
        <select style={{ ...s.input, maxWidth: '220px' }} disabled={!editable} value={f.prioridad} onChange={e => setF({ ...f, prioridad: e.target.value })}>
          {Object.entries(PRIORIDAD).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
        </select>
      </div>
      <div style={s.campo}>
        <label style={s.label}>Detalle del motivo</label>
        <textarea style={{ ...s.input, minHeight: '90px', resize: 'vertical' }} disabled={!editable} maxLength={4000}
          value={f.motivo_detalle} onChange={e => setF({ ...f, motivo_detalle: e.target.value })} />
      </div>
      <div style={s.campo}>
        <label style={s.label}>Antecedentes relevantes</label>
        <textarea style={{ ...s.input, minHeight: '90px', resize: 'vertical' }} disabled={!editable} maxLength={4000}
          value={f.antecedentes} onChange={e => setF({ ...f, antecedentes: e.target.value })} />
      </div>
      {caso.cierre_detalle && (
        <div style={s.campo}>
          <label style={s.label}>Detalle del cierre</label>
          <div style={{ fontSize: '14px', color: '#333', whiteSpace: 'pre-wrap' }}>{caso.cierre_detalle}</div>
        </div>
      )}
      {editable && <div style={s.botones}><button type="submit" disabled={ocupado} style={s.btnPrimario}>{ocupado ? 'Guardando...' : 'Guardar datos'}</button></div>}
    </form>
  );
}

export default function CasoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caso, setCaso] = useState(null);
  const [pestana, setPestana] = useState('linea');
  const [modal, setModal] = useState(null);         // 'reasignar' | 'cerrar'
  const [miembros, setMiembros] = useState([]);
  const [motivosCierre, setMotivosCierre] = useState([]);
  const [seleccion, setSeleccion] = useState('');
  const [detalleCierre, setDetalleCierre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await axiosAuth.get(`/api/bienestar/casos/${id}`);
      setCaso(r.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir el caso');
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function abrirModal(tipo) {
    setError(''); setSeleccion(''); setDetalleCierre(''); setModal(tipo);
    try {
      if (tipo === 'reasignar') {
        const r = await axiosAuth.get('/api/bienestar/equipo/miembros');
        setMiembros((r.data.data || []).filter(m => m.id !== caso.responsable_id));
      } else {
        const r = await axiosAuth.get('/api/bienestar/catalogos?tipo=motivo_cierre');
        setMotivosCierre((r.data.data || []).filter(m => m.activo));
      }
    } catch { /* el formulario mostrará listas vacías */ }
  }

  async function confirmarModal() {
    setOcupado(true); setError('');
    try {
      if (modal === 'reasignar') {
        await axiosAuth.post(`/api/bienestar/casos/${id}/asignar`, { usuario_id: parseInt(seleccion) });
      } else {
        await axiosAuth.post(`/api/bienestar/casos/${id}/cerrar`, { motivo_cierre_id: parseInt(seleccion), cierre_detalle: detalleCierre });
      }
      setModal(null);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar la acción');
    } finally {
      setOcupado(false);
    }
  }

  async function reabrir() {
    if (!window.confirm('¿Reabrir este caso?')) return;
    setError('');
    try {
      await axiosAuth.post(`/api/bienestar/casos/${id}/reabrir`);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reabrir el caso');
    }
  }

  if (!caso) {
    return (
      <div style={s.pagina}>
        <Navbar titulo="Caso" />
        <div style={es.contenido}>
          {error ? <div style={s.errorBox}>{error}</div> : <p style={s.gris}>Cargando...</p>}
          <button onClick={() => navigate('/bienestar/casos')} style={es.volver}>← Volver a casos</button>
        </div>
      </div>
    );
  }

  const esLider = caso.permisos.es_lider;
  return (
    <div style={s.pagina}>
      <Navbar titulo="Caso de orientación" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/bienestar/casos')} style={es.volver}>← Volver a casos</button>

        <div style={{ ...s.card, marginBottom: '14px' }}>
          <div style={es.cabecera}>
            <div style={{ minWidth: 0 }}>
              <h2 style={es.titulo}>{caso.estudiante}</h2>
              <div style={es.sub}>
                {caso.contexto.grado ? `${caso.contexto.grado}° ${caso.contexto.grupo} · ` : ''}{caso.motivo || 'Sin motivo'}
              </div>
              <div style={es.sub}>
                Responsable: <strong>{caso.responsable || '—'}</strong> · Abierto {fecha(caso.abierto_en)}
                {caso.cerrado_en ? ` · Cerrado ${fecha(caso.cerrado_en)}${caso.motivo_cierre ? ` (${caso.motivo_cierre})` : ''}` : ''}
              </div>
            </div>
            <div style={es.chips}>
              <Chip def={PRIORIDAD[caso.prioridad]} />
              <Chip def={ESTADO_CASO[caso.estado]} />
            </div>
          </div>
          <div style={es.acciones}>
            {caso.permisos.editable && esLider && <button onClick={() => abrirModal('reasignar')} style={s.btnSecundario}>Reasignar</button>}
            {caso.permisos.editable && <button onClick={() => abrirModal('cerrar')} style={s.btnSecundario}>Cerrar caso</button>}
            {caso.estado === 'cerrado' && esLider && <button onClick={reabrir} style={s.btnSecundario}>Reabrir</button>}
          </div>
          <div style={es.privacidad}>
            <IconShield size={14} style={{ flexShrink: 0 }} />
            Información confidencial. Cada consulta queda registrada. Los datos académicos son hechos registrados, no conclusiones.
          </div>
        </div>

        <Contexto c={caso.contexto} />

        {error && !modal && <div style={s.errorBox}>{error}</div>}

        <div style={es.tabs} role="tablist">
          {PESTANAS.map(p => (
            <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
              style={{ ...es.tab, ...(pestana === p.id ? es.tabActiva : {}) }}>
              {p.nombre}
              {p.id === 'seguimientos' && caso.seguimientos.length > 0 && ` (${caso.seguimientos.length})`}
              {p.id === 'documentos' && caso.adjuntos.length > 0 && ` (${caso.adjuntos.length})`}
            </button>
          ))}
        </div>

        <div style={s.card}>
          {pestana === 'linea' && <LineaTiempo caso={caso} />}
          {pestana === 'seguimientos' && <Seguimientos caso={caso} onCambio={cargar} />}
          {pestana === 'compromisos' && <Compromisos caso={caso} onCambio={cargar} />}
          {pestana === 'documentos' && <Documentos caso={caso} onCambio={cargar} />}
          {pestana === 'datos' && <DatosCaso key={caso.id + caso.estado} caso={caso} onCambio={cargar} />}
        </div>
      </div>

      {modal && (
        <>
          <div style={s.fondoModal} onClick={() => setModal(null)} />
          <div style={s.modal} role="dialog" aria-label={modal === 'reasignar' ? 'Reasignar caso' : 'Cerrar caso'}>
            <h3 style={s.modalTitulo}>{modal === 'reasignar' ? 'Reasignar responsable' : 'Cerrar caso'}</h3>
            {modal === 'reasignar' ? (
              <div style={s.campo}>
                <label style={s.label}>Nuevo responsable</label>
                <select style={s.input} value={seleccion} onChange={e => setSeleccion(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {miembros.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.nivel === 'lider' ? ' (líder)' : ''}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div style={s.campo}>
                  <label style={s.label}>Motivo de cierre *</label>
                  <select style={s.input} value={seleccion} onChange={e => setSeleccion(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {motivosCierre.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Evaluación final</label>
                  <textarea style={{ ...s.input, minHeight: '90px', resize: 'vertical' }} maxLength={4000}
                    value={detalleCierre} onChange={e => setDetalleCierre(e.target.value)} placeholder="Logros, situación al cierre, recomendaciones." />
                </div>
                {caso.compromisos.some(k => k.estado === 'pendiente') && (
                  <div style={{ ...s.errorBox, background: '#fff8e1', color: '#8a5a00' }}>Hay compromisos pendientes. Puedes cerrar igual; quedarán registrados como estaban.</div>
                )}
              </>
            )}
            {error && <div style={s.errorBox}>{error}</div>}
            <div style={s.botones}>
              <button onClick={() => setModal(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={confirmarModal} disabled={!seleccion || ocupado} style={{ ...s.btnPrimario, opacity: !seleccion ? 0.5 : 1 }}>
                {ocupado ? 'Guardando...' : modal === 'reasignar' ? 'Reasignar' : 'Cerrar caso'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const es = {
  contenido: { padding: '24px', maxWidth: '1050px', margin: '0 auto', width: '100%' },
  volver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginBottom: '14px', padding: 0, fontFamily: 'inherit' },
  cabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  titulo: { fontSize: '21px', fontWeight: 800, color: '#1a1a2e', margin: 0 },
  sub: { fontSize: '13px', color: '#888', marginTop: '3px' },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  acciones: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' },
  privacidad: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: '#8a86b3', marginTop: '12px' },
  contexto: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '10px', marginBottom: '14px' },
  dato: { background: '#fff', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  datoTitulo: { fontSize: '11px', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.3px' },
  datoValor: { fontSize: '19px', fontWeight: 800, color: '#1a1a2e', marginTop: '2px' },
  datoNota: { fontSize: '11.5px', color: '#aaa', marginTop: '1px' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', overflowX: 'auto' },
  tab: { background: '#fff', border: '1px solid #e6e8f0', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, color: '#666', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  tabActiva: { background: '#667eea', border: '1px solid #667eea', color: '#fff' },
};
