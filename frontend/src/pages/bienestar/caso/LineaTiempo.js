import React from 'react';
import { fecha, ROL_REMITENTE, RESPONSABLE_COMPROMISO } from '../comun';

// Línea de tiempo del caso: todo lo ocurrido, en orden, en un solo lugar.
// Se arma con lo que ya trae GET /casos/:id (no hace consultas propias).
const TIPOS = {
  remision:     { color: '#b45309', etiqueta: 'Remisión' },
  apertura:     { color: '#1565c0', etiqueta: 'Apertura' },
  asignacion:   { color: '#6b7280', etiqueta: 'Responsable' },
  seguimiento:  { color: '#5a4fcf', etiqueta: 'Seguimiento' },
  compromiso:   { color: '#00796b', etiqueta: 'Compromiso' },
  documento:    { color: '#607d8b', etiqueta: 'Documento' },
  cierre:       { color: '#2e7d32', etiqueta: 'Cierre' },
};

function recortar(t, n = 180) {
  if (!t) return '';
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
}

export function construirEventos(caso) {
  const ev = [];
  caso.remisiones.forEach(r => ev.push({
    tipo: 'remision', fecha: r.creado_en,
    titulo: `Remisión${r.remitente ? ` de ${ROL_REMITENTE[r.remitente_rol] || ''} ${r.remitente}` : ' automática'}`,
    texto: `${r.motivo || 'Sin motivo'} · prioridad ${r.prioridad}`,
  }));
  ev.push({ tipo: 'apertura', fecha: caso.abierto_en, titulo: 'Caso abierto', texto: caso.motivo || '' });
  caso.asignaciones.forEach((a, i) => {
    if (i === 0) return;   // la primera coincide con la apertura
    ev.push({ tipo: 'asignacion', fecha: a.desde, titulo: `Nuevo responsable: ${a.orientador}`, texto: a.asignado_por ? `Asignado por ${a.asignado_por}` : '' });
  });
  caso.seguimientos.forEach(s => ev.push({
    tipo: 'seguimiento', fecha: s.fecha, titulo: `${s.tipo || 'Seguimiento'}${s.autor ? ` · ${s.autor}` : ''}`,
    texto: recortar(s.resumen), privado: s.tiene_nota_privada,
  }));
  caso.compromisos.filter(k => !k.seguimiento_id).forEach(k => ev.push({
    tipo: 'compromiso', fecha: k.creado_en, titulo: `Compromiso (${RESPONSABLE_COMPROMISO[k.responsable_tipo] || ''})`,
    texto: recortar(k.descripcion, 120),
  }));
  caso.adjuntos.forEach(a => ev.push({ tipo: 'documento', fecha: a.creado_en, titulo: 'Documento agregado', texto: a.nombre_original }));
  if (caso.cerrado_en) ev.push({ tipo: 'cierre', fecha: caso.cerrado_en, titulo: 'Caso cerrado', texto: caso.motivo_cierre || '' });
  return ev.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export default function LineaTiempo({ caso }) {
  const eventos = construirEventos(caso);
  return (
    <div style={es.contenedor}>
      {eventos.map((e, i) => {
        const def = TIPOS[e.tipo];
        return (
          <div key={i} style={es.evento}>
            <div style={es.riel}>
              <span style={{ ...es.punto, background: def.color }} />
              {i < eventos.length - 1 && <span style={es.linea} />}
            </div>
            <div style={es.cuerpo}>
              <div style={es.cabecera}>
                <span style={{ ...es.etiqueta, color: def.color }}>{def.etiqueta}</span>
                <span style={es.fecha}>{fecha(e.fecha, e.tipo === 'seguimiento')}</span>
              </div>
              <div style={es.titulo}>{e.titulo}</div>
              {e.texto && <div style={es.texto}>{e.texto}</div>}
              {e.privado && <div style={es.privado}>Incluye nota privada</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const es = {
  contenedor: { display: 'flex', flexDirection: 'column' },
  evento: { display: 'flex', gap: '12px' },
  riel: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '14px', flexShrink: 0 },
  punto: { width: '12px', height: '12px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, boxShadow: '0 0 0 3px #fff' },
  linea: { flex: 1, width: '2px', background: '#e6e8f0', margin: '2px 0' },
  cuerpo: { paddingBottom: '18px', minWidth: 0, flex: 1 },
  cabecera: { display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' },
  etiqueta: { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' },
  fecha: { fontSize: '12px', color: '#aaa' },
  titulo: { fontSize: '14px', fontWeight: 700, color: '#1a1a2e', marginTop: '2px' },
  texto: { fontSize: '13px', color: '#666', marginTop: '2px', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  privado: { fontSize: '11.5px', color: '#8a5a00', marginTop: '4px' },
};
