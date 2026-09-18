import React, { useState } from 'react';
import axiosAuth from '../../../config/axios';
import { ESTADO_COMPROMISO, RESPONSABLE_COMPROMISO, Chip, fecha, estilos as s } from '../comun';

// Pestaña de compromisos del caso: agregar, marcar estado y visibilidad para la familia.
export default function Compromisos({ caso, onCambio }) {
  const [nuevo, setNuevo] = useState({ descripcion: '', responsable_tipo: 'estudiante', fecha_limite: '', visible_familia: false });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const editable = caso.permisos.editable;
  const hoy = new Date().toISOString().slice(0, 10);

  async function agregar(e) {
    e.preventDefault();
    if (!nuevo.descripcion.trim()) return;
    setOcupado(true); setError('');
    try {
      await axiosAuth.post(`/api/bienestar/casos/${caso.id}/compromisos`, { ...nuevo, fecha_limite: nuevo.fecha_limite || null });
      setNuevo({ descripcion: '', responsable_tipo: 'estudiante', fecha_limite: '', visible_familia: false });
      onCambio();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo agregar el compromiso');
    } finally {
      setOcupado(false);
    }
  }

  async function cambiar(id, cambios) {
    setError('');
    try {
      await axiosAuth.patch(`/api/bienestar/compromisos/${id}`, cambios);
      onCambio();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el compromiso');
    }
  }

  return (
    <div>
      {error && <div style={s.errorBox}>{error}</div>}
      {editable && (
        <form onSubmit={agregar} style={es.nuevo}>
          <input style={{ ...s.input, flex: '2 1 240px' }} placeholder="Nuevo compromiso" maxLength={500}
            value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
          <select style={{ ...s.input, flex: '1 1 130px' }} value={nuevo.responsable_tipo} onChange={e => setNuevo({ ...nuevo, responsable_tipo: e.target.value })}>
            {Object.entries(RESPONSABLE_COMPROMISO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
          <input type="date" style={{ ...s.input, flex: '1 1 140px' }} value={nuevo.fecha_limite} onChange={e => setNuevo({ ...nuevo, fecha_limite: e.target.value })} />
          <button type="submit" disabled={ocupado} style={s.btnPrimario}>Agregar</button>
        </form>
      )}

      {caso.compromisos.length === 0 ? (
        <div style={es.vacio}>No hay compromisos registrados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {caso.compromisos.map(k => {
            const vencido = k.estado === 'pendiente' && k.fecha_limite && String(k.fecha_limite).slice(0, 10) < hoy;
            return (
              <div key={k.id} style={{ ...es.fila, ...(vencido ? es.vencido : {}) }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={es.texto}>{k.descripcion}</div>
                  <div style={es.meta}>
                    {RESPONSABLE_COMPROMISO[k.responsable_tipo]}
                    {k.fecha_limite ? ` · hasta ${fecha(k.fecha_limite)}` : ''}
                    {vencido && <strong style={{ color: '#c62828' }}> · vencido</strong>}
                    {k.visible_familia ? ' · visible para la familia' : ''}
                  </div>
                </div>
                {editable ? (
                  <div style={es.acciones}>
                    <select style={{ ...s.input, width: 'auto', padding: '6px 10px' }} value={k.estado} onChange={e => cambiar(k.id, { estado: e.target.value })}>
                      {Object.entries(ESTADO_COMPROMISO).map(([v, d]) => <option key={v} value={v}>{d.nombre}</option>)}
                    </select>
                    <label style={es.check} title="Si el colegio tiene activo el portal de familia, el acudiente verá este compromiso">
                      <input type="checkbox" checked={k.visible_familia} onChange={e => cambiar(k.id, { visible_familia: e.target.checked })} />
                      Familia
                    </label>
                  </div>
                ) : <Chip def={ESTADO_COMPROMISO[k.estado]} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const es = {
  nuevo: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' },
  fila: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #eef0f5', borderRadius: '12px', padding: '12px 14px' },
  vencido: { border: '1px solid #ffcdd2', background: '#fffafa' },
  texto: { fontSize: '14px', color: '#333', lineHeight: 1.5 },
  meta: { fontSize: '12px', color: '#999', marginTop: '2px' },
  acciones: { display: 'flex', gap: '10px', alignItems: 'center' },
  check: { display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12.5px', color: '#666', cursor: 'pointer' },
  vacio: { background: '#fafbff', border: '1px dashed #dde0f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#999', fontSize: '14px' },
};
