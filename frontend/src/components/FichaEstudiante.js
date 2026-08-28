import React from 'react';
import { formatearApellidoPrimero } from '../utils/ordenNombre';

export function iniciales(nombre) {
  return (nombre || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');
}

export function Avatar({ nombre, fotoUrl, size = 34 }) {
  if (fotoUrl) {
    return (
      <img
        src={`${process.env.REACT_APP_API_URL}${fotoUrl}`}
        alt={nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,var(--color-primario,#667eea),var(--color-secundario,#764ba2))', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: '700',
    }}>
      {iniciales(nombre) || '?'}
    </div>
  );
}

// Contenido de la ficha básica (foto + datos clave) — cada pantalla lo envuelve
// en su propio layout (modal, panel lateral, tarjeta inline, etc.)
export function FichaBasicaContenido({ datos, cargando }) {
  if (cargando) return <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>;
  if (!datos || datos.error) return <p style={{ color: '#c62828', fontSize: '13px' }}>No se pudo cargar la ficha del estudiante.</p>;

  const fila = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f2f2f5', paddingBottom: '10px' };
  const label = { fontSize: '12px', color: '#999', fontWeight: '600' };
  const valor = { fontSize: '14px', color: '#222', fontWeight: '700', textAlign: 'right' };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <Avatar nombre={datos.nombre} fotoUrl={datos.foto_url} size={72} />
        <div style={{ fontSize: '16px', fontWeight: '800', color: '#222', textAlign: 'center' }}>{formatearApellidoPrimero(datos.nombre)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={fila}>
          <span style={label}>Grado</span>
          <span style={valor}>{datos.grado ? `${datos.grado}°` : '—'}</span>
        </div>
        <div style={fila}>
          <span style={label}>Curso</span>
          <span style={valor}>{datos.nombre_grupo || '—'}</span>
        </div>
        <div style={fila}>
          <span style={label}>Director de grupo</span>
          <span style={valor}>{datos.director_grupo || 'Sin asignar'}</span>
        </div>
        <div style={fila}>
          <span style={label}>Acudiente</span>
          <span style={valor}>{datos.acudientes || '—'}</span>
        </div>
        <div style={fila}>
          <span style={label}>Número acudiente</span>
          <span style={valor}>{datos.telefono_padres || '—'}</span>
        </div>
      </div>
    </>
  );
}
