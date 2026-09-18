import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconClock, IconInbox } from '../components/Icons';

const ACCION_LABELS = {
  inicio_sesion:        'Inicio de sesión',
  nota_editada:         'Nota editada',
  estudiante_creado:    'Estudiante creado',
  estudiante_editado:   'Estudiante editado',
  estudiante_retirado:  'Estudiante retirado',
  colegio_editado:      'Datos del colegio editados',
  historico_importado:  'Histórico de notas importado',
  anio_lectivo_cerrado: 'Año lectivo cerrado',
  grado_academico_editado: 'Grado académico editado',
  motivo_retiro_editado: 'Motivo de retiro actualizado',
  modulos_colegio_editados: 'Módulos del portal actualizados',
  evento_institucional_creado: 'Evento de agenda creado',
  evento_institucional_editado: 'Evento de agenda editado',
  evento_institucional_eliminado: 'Evento de agenda eliminado',
  personal_creado: 'Usuario del sistema creado',
  personal_editado: 'Usuario del sistema editado',
  personal_desactivado: 'Usuario del sistema desactivado',
  piar_documento_subido: 'Documento de PIAR subido',
  piar_documento_eliminado: 'Documento de PIAR eliminado',
  grupo_editado: 'Grupo editado',
  semana_academica_editada: 'Semana académica editada',
  salon_editado: 'Salón editado',
  area_academica_editada: 'Área académica editada',
  asignatura_editada: 'Asignatura editada',
  grado_materias_editado: 'Asignaturas del grado actualizadas',
  clase_definida: 'Clase definida',
  carga_academica_reasignada: 'Carga académica reasignada',
  clases_trasladadas: 'Clases trasladadas masivamente',
  personal_modulos_editados: 'Módulos de un usuario del sistema actualizados',
};

const ROL_ETIQUETA = { director: 'Director', admin: 'Administrador', docente: 'Docente' };

function formatoFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* Convierte el detalle guardado (JSON) en una frase legible según la acción */
function descripcionDetalle(accion, detalleTexto) {
  if (!detalleTexto) return '—';
  let d;
  try { d = JSON.parse(detalleTexto); } catch { return detalleTexto; }

  switch (accion) {
    case 'nota_editada':
      return `${d.actividad || 'Actividad'}: ${d.nota_anterior ?? '—'} → ${d.nota_nueva ?? '—'}`;
    case 'estudiante_creado':
    case 'estudiante_editado':
      return `${d.nombre || ''}${d.email ? ` (${d.email})` : ''}`;
    case 'estudiante_retirado':
      return [d.nombre, d.motivo && `Motivo: ${d.motivo}`, d.detalle].filter(Boolean).join(' · ');
    case 'colegio_editado':
      return [d.nombre && `Nombre: ${d.nombre}`, d.ciudad && `Ciudad: ${d.ciudad}`, d.lema && `Lema: ${d.lema}`]
        .filter(Boolean).join(' · ') || 'Sin cambios de texto';
    case 'historico_importado':
      return `${d.importadas ?? 0} de ${d.filas_recibidas ?? 0} filas importadas${d.con_error ? ` · ${d.con_error} con error` : ''}`;
    case 'anio_lectivo_cerrado':
      return `${d.anio_cerrado} → ${d.anio_nuevo} · ${d.promovidos ?? 0} promovidos, ${d.repiten ?? 0} repiten, ${d.egresan ?? 0} egresan`;
    case 'grado_academico_editado':
      return d.nombre || '';
    case 'motivo_retiro_editado':
      return d.nombre ? `${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}` : '—';
    case 'modulos_colegio_editados':
      return Array.isArray(d.modulos_desactivados)
        ? (d.modulos_desactivados.length ? `Desactivados: ${d.modulos_desactivados.join(', ')}` : 'Todos los módulos activos')
        : '—';
    case 'evento_institucional_creado':
    case 'evento_institucional_editado':
    case 'evento_institucional_eliminado':
      return [d.titulo, d.categoria].filter(Boolean).join(' · ');
    case 'personal_creado':
    case 'personal_editado':
      return `${d.nombre || ''}${d.email ? ` (${d.email})` : ''}${d.cargo ? ` · ${d.cargo}` : ''}`;
    case 'personal_desactivado':
      return d.nombre || '';
    case 'piar_documento_subido':
      return `${d.cantidad ?? 1} documento(s)`;
    case 'piar_documento_eliminado':
      return d.nombre_original || '';
    case 'grupo_editado':
      return [d.nombre, d.grado].filter(Boolean).join(' · ');
    case 'semana_academica_editada':
      return [d.nombre, d.activo !== undefined && (d.activo ? 'Activo' : 'Inactivo')].filter(Boolean).join(' · ');
    case 'salon_editado':
      return d.nombre ? `${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}` : '—';
    case 'area_academica_editada':
      return d.nombre ? `${d.codigo ? `${d.codigo} — ` : ''}${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}` : '—';
    case 'asignatura_editada':
      return d.nombre ? `${d.codigo ? `${d.codigo} — ` : ''}${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}` : (d.tipo || '—');
    case 'grado_materias_editado':
      return `Grado ${d.grado ?? ''}: ${d.cantidad ?? 0} asignatura(s)`;
    case 'clase_definida':
      return d.materia ? `${d.materia}${d.tipo ? ` (${d.tipo})` : ''}` : (d.tipo || '—');
    case 'carga_academica_reasignada':
      return `${d.docente_origen || ''} → ${d.docente_destino || ''} · ${d.reasignadas ?? 0} clase(s)${d.omitidas ? `, ${d.omitidas} omitida(s)` : ''}`;
    case 'clases_trasladadas':
      return `${d.grupo_origen || ''} → ${(d.grupos_destino || []).join(', ')}`;
    case 'personal_modulos_editados':
      return `${d.nombre || ''}${d.modulos_desactivados?.length ? `: ${d.modulos_desactivados.join(', ')} desactivado(s)` : ': todos los módulos activos'}`;
    default:
      return '—';
  }
}

export default function Auditoria() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const porPagina = 40;
  const colegioId = usuario.colegio_id;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams({ pagina: String(pagina) });
      if (accion) params.set('accion', accion);
      const resp = await axiosAuth.get(`/api/auditoria/colegio/${colegioId}?${params.toString()}`);
      setDatos(resp.data.data);
      setTotal(resp.data.total);
    } catch {
      setError('No se pudo cargar la auditoría. Verifica tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [colegioId, pagina, accion]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalPaginas = Math.max(Math.ceil(total / porPagina), 1);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Auditoría" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock size={20} style={{ color: '#667eea' }} />
            Auditoría — quién hizo qué y cuándo
          </h2>
          <p style={es.subtitulo}>
            Registro de acciones sensibles: notas, estudiantes y datos del colegio.
          </p>
        </div>

        <div style={es.filtroRow}>
          <label style={es.filtroLabel}>Filtrar por acción</label>
          <select
            value={accion}
            onChange={e => { setAccion(e.target.value); setPagina(1); }}
            style={es.filtroSelect}
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_LABELS)
              .map(([valor, label]) => ({ valor, label }))
              .sort((a, b) => a.label.localeCompare(b.label, 'es'))
              .map(op => (
                <option key={op.valor} value={op.valor}>{op.label}</option>
              ))}
          </select>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando auditoría...</div>
        ) : datos.length === 0 ? (
          <div style={es.sinDatos}>
            <IconInbox size={52} style={{ color: '#ccc' }} />
            <p>No hay registros de auditoría todavía.</p>
          </div>
        ) : (
          <>
            <div style={es.tablaCard}>
              <div style={es.tablaScroll}>
                <table style={es.tabla}>
                  <thead>
                    <tr>
                      <th style={es.th}>Fecha</th>
                      <th style={es.th}>Usuario</th>
                      <th style={es.th}>Rol</th>
                      <th style={es.th}>Acción</th>
                      <th style={es.th}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map(fila => (
                      <tr key={fila.id} style={es.tr}>
                        <td style={{ ...es.td, whiteSpace: 'nowrap', color: '#888' }}>{formatoFecha(fila.creado_en)}</td>
                        <td style={{ ...es.td, fontWeight: '700' }}>{fila.usuario_nombre || '—'}</td>
                        <td style={es.td}>{ROL_ETIQUETA[fila.usuario_rol] || fila.usuario_rol || '—'}</td>
                        <td style={es.td}>
                          <span style={es.accionChip}>{ACCION_LABELS[fila.accion] || fila.accion}</span>
                        </td>
                        <td style={{ ...es.td, color: '#555' }}>{descripcionDetalle(fila.accion, fila.detalle)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={es.paginacion}>
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                style={{ ...es.pagBtn, opacity: pagina <= 1 ? 0.4 : 1 }}
              >
                ← Anterior
              </button>
              <span style={es.pagTexto}>Página {pagina} de {totalPaginas} · {total} registros</span>
              <button
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                style={{ ...es.pagBtn, opacity: pagina >= totalPaginas ? 0.4 : 1 }}
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0 },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },

  filtroRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  filtroLabel: { fontSize: '12.5px', fontWeight: '600', color: '#666' },
  filtroSelect: { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', background: '#fff', minWidth: '260px', color: '#333' },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },

  tablaCard: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' },
  tablaScroll: { overflowX: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '760px' },
  th: { padding: '11px 16px', fontSize: '11.5px', fontWeight: '700', color: '#6b7280', borderBottom: '1px solid #eef1f7', textAlign: 'left', background: '#fafbfe' },
  tr: { borderBottom: '1px solid #f5f7fb' },
  td: { padding: '11px 16px', fontSize: '13px', color: '#374151' },
  accionChip: { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', background: 'rgba(102,126,234,0.1)', color: '#4f46e5', fontSize: '12px', fontWeight: '700' },

  paginacion: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '18px' },
  pagBtn: { padding: '8px 16px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#555', fontFamily: 'inherit' },
  pagTexto: { fontSize: '12.5px', color: '#888' },
};
