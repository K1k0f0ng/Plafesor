import React from 'react';

// Piezas compartidas por las pantallas de Bienestar y Orientación.

export const PRIORIDAD = {
  urgente: { nombre: 'Urgente', color: '#fff',    fondo: '#e53935' },
  alta:    { nombre: 'Alta',    color: '#c62828', fondo: '#ffebee' },
  media:   { nombre: 'Media',   color: '#8a5a00', fondo: '#fff8e1' },
  baja:    { nombre: 'Baja',    color: '#607d8b', fondo: '#eceff1' },
};

export const ESTADO_REMISION = {
  pendiente:      { nombre: 'Pendiente',      color: '#b45309', fondo: '#fff7e6' },
  recibida:       { nombre: 'Recibida',       color: '#1565c0', fondo: '#e3f2fd' },
  en_revision:    { nombre: 'En revisión',    color: '#5a4fcf', fondo: '#efedff' },
  en_seguimiento: { nombre: 'En seguimiento', color: '#00796b', fondo: '#e0f2f1' },
  cerrada:        { nombre: 'Cerrada',        color: '#2e7d32', fondo: '#e8f5e9' },
  archivada:      { nombre: 'Archivada',      color: '#6b7280', fondo: '#f1f2f4' },
};

export const ESTADO_CASO = {
  abierto:        { nombre: 'Abierto',        color: '#1565c0', fondo: '#e3f2fd' },
  en_seguimiento: { nombre: 'En seguimiento', color: '#00796b', fondo: '#e0f2f1' },
  cerrado:        { nombre: 'Cerrado',        color: '#2e7d32', fondo: '#e8f5e9' },
  archivado:      { nombre: 'Archivado',      color: '#6b7280', fondo: '#f1f2f4' },
};

export const ESTADO_COMPROMISO = {
  pendiente:  { nombre: 'Pendiente',  color: '#b45309', fondo: '#fff7e6' },
  cumplido:   { nombre: 'Cumplido',   color: '#2e7d32', fondo: '#e8f5e9' },
  incumplido: { nombre: 'Incumplido', color: '#c62828', fondo: '#ffebee' },
  cancelado:  { nombre: 'Cancelado',  color: '#6b7280', fondo: '#f1f2f4' },
};

export const RESPONSABLE_COMPROMISO = {
  estudiante: 'Estudiante', familia: 'Familia', docente: 'Docente', orientacion: 'Orientación', otro: 'Otro',
};

export const ROL_REMITENTE = { docente: 'Docente', director: 'Director', orientador: 'Orientación' };

export function Chip({ def }) {
  if (!def) return null;
  return (
    <span style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap', color: def.color, background: def.fondo }}>
      {def.nombre}
    </span>
  );
}

export function fecha(f, conHora = false) {
  if (!f) return '';
  try {
    return new Date(f).toLocaleString('es-CO', conHora
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// "2026-09-24T10:30" en hora local, para <input type="datetime-local">
export function ahoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function fechaCorta(f) {
  if (!f) return '';
  return String(f).slice(0, 10);
}

export const estilos = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  card: { background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  label: { fontSize: '13px', fontWeight: 700, color: '#555', display: 'block', marginBottom: '6px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: '#fff', width: '100%' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSecundario: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnPeligro: { background: '#fff0f0', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '14px' },
  gris: { color: '#888', fontSize: '14px' },
  fondoModal: { position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.4)', zIndex: 100 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '16px', zIndex: 101, padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' },
  modalTitulo: { fontSize: '17px', fontWeight: 800, color: '#1a1a2e', margin: '0 0 14px' },
  campo: { marginBottom: '14px' },
  botones: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '6px' },
};
