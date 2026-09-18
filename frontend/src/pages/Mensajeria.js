import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconDownload, IconInbox } from '../components/Icons';

const CARPETAS = [
  { valor: 'bandeja_entrada', etiqueta: 'Bandeja de entrada' },
  { valor: 'enviados',        etiqueta: 'Enviados' },
  { valor: 'archivados',      etiqueta: 'Archivados' },
  { valor: 'eliminados',      etiqueta: 'Eliminados' },
  { valor: 'borradores',      etiqueta: 'Borradores' },
];

const ROL_ETIQUETA = { admin: 'Administrador', director: 'Director', docente: 'Docente', padre: 'Padre/Madre', estudiante: 'Estudiante' };

// Las columnas JSON de MySQL a veces llegan ya parseadas por mysql2 (array) y
// a veces como texto — hay que soportar ambos casos.
function parseJsonColumna(valor, porDefecto = []) {
  if (valor == null) return porDefecto;
  if (typeof valor === 'string') {
    try { return JSON.parse(valor); } catch { return porDefecto; }
  }
  return valor;
}

function formatFecha(fecha) {
  const d = new Date(fecha);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  if (mismoDia) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

async function descargarAdjunto(adjuntoId, nombre) {
  const resp = await axiosAuth.get(`/api/mensajes/adjuntos/${adjuntoId}/archivo`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([resp.data]));
  const a = document.createElement('a');
  a.href = url; a.download = nombre || 'adjunto';
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Selector de destinatarios ────────────────────────────────────────────────

// Etiqueta "Curso" para un hijo: "6° 6A" (grado + nombre del grupo)
function etiquetaCurso(hijo) {
  if (!hijo.grupo_nombre) return '';
  return hijo.grado ? `${hijo.grado}° ${hijo.grupo_nombre}` : hijo.grupo_nombre;
}

// Un acudiente con varios hijos con el mismo docente (caso "hermanos") llega
// del backend ya agrupado en un solo contacto con `hijos: [...]` — nunca con
// el id repetido — para que no se pueda armar una lista de destinatarios con
// ids duplicados (rompía el envío) ni se confunda al docente con filas que
// parecen personas distintas pero se marcan juntas.
function SelectorDestinatarios({ contactos, seleccionados, onChange }) {
  const [filtro, setFiltro] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');

  // Roles presentes en la lista de contactos de este usuario — para poder
  // separar "Docentes" de "Acudientes" (etc.) en vez de una sola lista
  // mezclada, cuando hay más de un tipo de contacto disponible.
  const rolesPresentes = [...new Set(contactos.map(c => c.rol))];

  // Grupos disponibles para filtrar, tomados de los hijos de los contactos
  // (solo existen para docentes; en otros roles la lista queda vacía y el
  // selector de grupo simplemente no aparece).
  const grupos = [];
  const vistos = new Set();
  contactos.forEach(c => (c.hijos || []).forEach(h => {
    if (h.grupo_id && !vistos.has(h.grupo_id)) {
      vistos.add(h.grupo_id);
      grupos.push({ id: h.grupo_id, nombre: h.grupo_nombre, grado: h.grado });
    }
  }));
  grupos.sort((a, b) => (a.grado || '').localeCompare(b.grado || '') || a.nombre.localeCompare(b.nombre));

  const filtroNorm = filtro.trim().toLowerCase();
  const grupoIdFiltro = grupoFiltro ? parseInt(grupoFiltro) : null;

  // Busca primero por el nombre del estudiante (más fácil de recordar para
  // el docente que con muchos alumnos) y también por el nombre del acudiente.
  const filtrados = contactos
    .map(c => {
      if (!c.hijos) return c;
      const hijos = grupoIdFiltro ? c.hijos.filter(h => h.grupo_id === grupoIdFiltro) : c.hijos;
      return { ...c, hijos };
    })
    .filter(c => {
      if (rolFiltro && c.rol !== rolFiltro) return false;
      if (c.hijos && grupoIdFiltro && c.hijos.length === 0) return false;
      if (!filtroNorm) return true;
      const matchAcudiente = c.nombre.toLowerCase().includes(filtroNorm);
      const matchEstudiante = (c.hijos || []).some(h => h.nombre.toLowerCase().includes(filtroNorm))
        || (c.detalle || '').toLowerCase().includes(filtroNorm);
      return matchAcudiente || matchEstudiante;
    });

  function toggle(id) {
    onChange(seleccionados.includes(id) ? seleccionados.filter(x => x !== id) : [...seleccionados, id]);
  }
  function seleccionarTodos() { onChange([...new Set(filtrados.map(c => c.id))]); }
  function limpiar() { onChange([]); }

  return (
    <div>
      {rolesPresentes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setRolFiltro('')}
            style={{ ...cs.btnChico, ...(rolFiltro === '' ? cs.btnChicoActivo : {}) }}>
            Todos
          </button>
          {rolesPresentes.map(r => (
            <button key={r} type="button" onClick={() => setRolFiltro(r)}
              style={{ ...cs.btnChico, ...(rolFiltro === r ? cs.btnChicoActivo : {}) }}>
              {ROL_ETIQUETA[r] || r}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="text" value={filtro} onChange={e => setFiltro(e.target.value)}
          placeholder="Buscar por nombre del estudiante o del acudiente..." style={{ ...cs.input, flex: 1, minWidth: 180 }} />
        {grupos.length > 0 && (
          <select value={grupoFiltro} onChange={e => setGrupoFiltro(e.target.value)} style={cs.selectChico}>
            <option value="">Todos los grupos</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
          </select>
        )}
        <button type="button" onClick={seleccionarTodos} style={cs.btnChico}>Seleccionar todos</button>
        <button type="button" onClick={limpiar} style={cs.btnChico}>Limpiar</button>
      </div>
      <div style={cs.listaContactos}>
        {filtrados.length === 0 ? (
          <p style={cs.textoGris}>Sin contactos disponibles.</p>
        ) : filtrados.map(c => {
          const varioshijos = c.hijos && c.hijos.length > 1;
          const unHijo = c.hijos && c.hijos.length === 1 ? c.hijos[0] : null;
          return (
            <div key={c.id} style={cs.contactoGrupo}>
              <label style={cs.contactoFila}>
                <input type="checkbox" checked={seleccionados.includes(c.id)} onChange={() => toggle(c.id)} />
                {unHijo ? (
                  <span style={cs.contactoTexto}>
                    <span style={{ fontWeight: 600 }}>{unHijo.nombre}</span>
                    <span style={cs.contactoDetalle}>
                      Acudiente: {c.nombre}{etiquetaCurso(unHijo) ? ` · Curso ${etiquetaCurso(unHijo)}` : ''}
                    </span>
                  </span>
                ) : varioshijos ? (
                  <span style={{ fontWeight: 700 }}>{c.nombre} <span style={cs.contactoDetalle}>({ROL_ETIQUETA[c.rol] || c.rol})</span></span>
                ) : (
                  <span style={cs.contactoTexto}>
                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                    <span style={cs.contactoDetalle}>{ROL_ETIQUETA[c.rol] || c.rol}{c.detalle ? ` · ${c.detalle}` : ''}</span>
                  </span>
                )}
              </label>
              {varioshijos && (
                <div style={cs.hijosLista}>
                  {c.hijos.map(h => (
                    <div key={h.id} style={cs.hijoFila}>
                      🔹 Acudiente de: <strong>{h.nombre}</strong>{etiquetaCurso(h) ? ` — Curso ${etiquetaCurso(h)}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p style={cs.ayuda}>{seleccionados.length} seleccionado(s)</p>
    </div>
  );
}

// ─── Modal: redactar / editar borrador ────────────────────────────────────────

function ModalRedactar({ contactos, borradorInicial, onClose, onGuardado }) {
  const [destinatarios, setDestinatarios] = useState(
    parseJsonColumna(borradorInicial?.destinatarios_borrador)
  );
  const [asunto, setAsunto] = useState(borradorInicial?.asunto || '');
  const [cuerpo, setCuerpo] = useState(borradorInicial?.cuerpo || '');
  const [archivos, setArchivos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function construirFormData(esBorrador) {
    const fd = new FormData();
    fd.append('asunto', asunto);
    fd.append('cuerpo', cuerpo);
    fd.append('borrador', esBorrador ? 'true' : 'false');
    fd.append('destinatarios', JSON.stringify(destinatarios));
    archivos.forEach(f => fd.append('adjuntos', f));
    return fd;
  }

  async function guardar(enviar) {
    setError('');
    if (!asunto.trim() || !cuerpo.trim()) { setError('El asunto y el mensaje son obligatorios'); return; }
    if (enviar && destinatarios.length === 0) { setError('Selecciona al menos un destinatario'); return; }
    setGuardando(true);
    try {
      if (borradorInicial?.id) {
        await axiosAuth.put(`/api/mensajes/${borradorInicial.id}`, { asunto, cuerpo, destinatarios });
        if (enviar) await axiosAuth.post(`/api/mensajes/${borradorInicial.id}/enviar`);
      } else {
        await axiosAuth.post('/api/mensajes', construirFormData(!enviar));
      }
      onGuardado();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el mensaje');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={cs.overlay} onClick={onClose}>
      <div style={cs.modal} onClick={e => e.stopPropagation()}>
        <h3 style={cs.modalTitulo}>
          {borradorInicial ? 'Editar borrador' : 'Redactar mensaje'}
        </h3>

        <label style={cs.label}>Para</label>
        <SelectorDestinatarios contactos={contactos} seleccionados={destinatarios} onChange={setDestinatarios} />

        <label style={{ ...cs.label, marginTop: 12 }}>Asunto</label>
        <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)} style={cs.input} />

        <label style={{ ...cs.label, marginTop: 12 }}>Mensaje</label>
        <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={6} style={cs.textarea} />

        {!borradorInicial && (
          <>
            <label style={{ ...cs.label, marginTop: 12 }}>Adjuntos (opcional, máx. 3 — PDF, Word, PowerPoint, Excel o imagen)</label>
            <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={e => setArchivos(Array.from(e.target.files).slice(0, 3))} style={{ marginTop: 4 }} />
          </>
        )}

        {error && <div style={cs.errorBox}>{error}</div>}

        <div style={cs.modalAcciones}>
          <button onClick={onClose} style={cs.btnCancelar}>Cancelar</button>
          <button onClick={() => guardar(false)} disabled={guardando} style={cs.btnSecundario}>Guardar borrador</button>
          <button onClick={() => guardar(true)} disabled={guardando} style={cs.btnPrimario}>
            {guardando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Acuse de recibo (solo visible para el remitente de ese mensaje) ──────────

function AcuseRecibo({ destinatarios }) {
  const [abierto, setAbierto] = useState(false);
  const leidos = destinatarios.filter(d => d.leido).length;
  return (
    <div style={cs.acuseBox}>
      <button type="button" onClick={() => setAbierto(v => !v)} style={cs.acuseToggle}>
        ✓ Leído por {leidos} de {destinatarios.length} {abierto ? '▲' : '▼'}
      </button>
      {abierto && (
        <div style={cs.acuseLista}>
          {destinatarios.map(d => (
            <div key={d.id} style={cs.acuseFila}>
              <span>{d.nombre}</span>
              <span style={{ color: d.leido ? '#2e7d32' : '#999', fontWeight: 700 }}>
                {d.leido ? `✓ Leído${d.leido_en ? ` · ${formatFecha(d.leido_en)}` : ''}` : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal: detalle de un hilo ────────────────────────────────────────────────

function ModalDetalle({ mensajeId, usuarioId, contactos, onClose, onCambio }) {
  const [hilo, setHilo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [responder, setResponder] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const resp = await axiosAuth.get(`/api/mensajes/${mensajeId}`);
        setHilo(resp.data.data);
        onCambio();
      } catch { /* silencioso */ }
      finally { setCargando(false); }
    }
    cargar();
  }, [mensajeId]); // eslint-disable-line

  function otroParticipante() {
    if (!hilo || hilo.length === 0) return null;
    const ultimoMsg = hilo[hilo.length - 1];
    if (ultimoMsg.remitente_id !== usuarioId) return ultimoMsg.remitente_id;
    // El último mensaje del hilo lo escribió el propio usuario (ej. viendo su
    // propio mensaje enviado, todavía sin respuesta) — responder va a quien
    // se lo envió.
    return ultimoMsg.destinatarios?.[0]?.id ?? null;
  }

  const ultimo = hilo?.[hilo.length - 1];
  const destinatarioRespuesta = otroParticipante();

  return (
    <div style={cs.overlay} onClick={onClose}>
      <div style={cs.modal} onClick={e => e.stopPropagation()}>
        {cargando ? (
          <p style={cs.textoGris}>Cargando...</p>
        ) : !hilo || hilo.length === 0 ? (
          <p style={cs.textoGris}>No se pudo cargar el mensaje.</p>
        ) : (
          <>
            <h3 style={cs.modalTitulo}>{hilo[0].asunto}</h3>
            <div style={cs.hiloLista}>
              {hilo.map(m => (
                <div key={m.id} style={cs.hiloMensaje}>
                  <div style={cs.hiloHead}>
                    <span style={{ fontWeight: 700 }}>{m.remitente_nombre}</span>
                    <span style={cs.contactoDetalle}>{ROL_ETIQUETA[m.remitente_rol] || m.remitente_rol}</span>
                    <span style={{ ...cs.contactoDetalle, marginLeft: 'auto' }}>{formatFecha(m.creado_en)}</span>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0' }}>{m.cuerpo}</p>
                  {m.adjuntos?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {m.adjuntos.map(a => (
                        <button key={a.id} onClick={() => descargarAdjunto(a.id, a.archivo_nombre_original)} style={cs.btnAdjunto}>
                          <IconDownload size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                          {a.archivo_nombre_original}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.remitente_id === usuarioId && m.destinatarios?.length > 0 && (
                    <AcuseRecibo destinatarios={m.destinatarios} />
                  )}
                </div>
              ))}
            </div>

            {!responder ? (
              destinatarioRespuesta && !(ultimo.remitente_id === usuarioId && ultimo.destinatarios?.length !== 1) && (
                <button onClick={() => setResponder(true)} style={{ ...cs.btnPrimario, marginTop: 14 }}>Responder</button>
              )
            ) : (
              <div style={{ marginTop: 14 }}>
                <ModalRespuestaInline
                  respondeA={{ respondeAId: ultimo.id, destinatarioId: destinatarioRespuesta, asunto: hilo[0].asunto }}
                  onCancelar={() => setResponder(false)}
                  onEnviado={() => { setResponder(false); onCambio(); onClose(); }}
                />
              </div>
            )}

            <div style={cs.modalAcciones}>
              <button onClick={onClose} style={cs.btnCancelar}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Cuadro de respuesta simple, embebido dentro del modal de detalle (sin selector de destinatarios)
function ModalRespuestaInline({ respondeA, onCancelar, onEnviado }) {
  const [cuerpo, setCuerpo] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar() {
    if (!cuerpo.trim()) { setError('Escribe una respuesta'); return; }
    setError(''); setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('asunto', respondeA.asunto);
      fd.append('cuerpo', cuerpo);
      fd.append('borrador', 'false');
      fd.append('destinatarios', JSON.stringify([respondeA.destinatarioId]));
      fd.append('responde_a_id', respondeA.respondeAId);
      archivos.forEach(f => fd.append('adjuntos', f));
      await axiosAuth.post('/api/mensajes', fd);
      onEnviado();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la respuesta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={4} style={cs.textarea} placeholder="Escribe tu respuesta..." />
      <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={e => setArchivos(Array.from(e.target.files).slice(0, 3))} style={{ marginTop: 8 }} />
      {error && <div style={cs.errorBox}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={onCancelar} style={cs.btnCancelar}>Cancelar</button>
        <button onClick={enviar} disabled={enviando} style={cs.btnPrimario}>{enviando ? 'Enviando...' : 'Enviar'}</button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Mensajeria() {
  const { usuario } = useAuth();
  const [carpeta, setCarpeta] = useState('bandeja_entrada');
  const [mensajes, setMensajes] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [modalCompose, setModalCompose] = useState(false);
  const [borradorEdicion, setBorradorEdicion] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  const cargarMensajes = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ carpeta });
      if (buscar) params.set('buscar', buscar);
      const resp = await axiosAuth.get(`/api/mensajes?${params}`);
      setMensajes(resp.data.data);
    } catch {
      setError('Error al cargar los mensajes');
    } finally {
      setCargando(false);
    }
  }, [carpeta, buscar]);

  useEffect(() => { cargarMensajes(); }, [cargarMensajes]);
  useEffect(() => {
    axiosAuth.get('/api/mensajes/contactos').then(r => setContactos(r.data.data)).catch(() => {});
  }, []);

  function abrirMensaje(m) {
    if (carpeta === 'borradores') {
      setBorradorEdicion(m);
      setModalCompose(true);
    } else {
      setDetalleId(m.id);
    }
  }

  async function cambiarCarpeta(id, nuevaCarpeta) {
    try {
      await axiosAuth.put(`/api/mensajes/${id}/carpeta`, { carpeta: nuevaCarpeta });
      cargarMensajes();
    } catch { /* silencioso */ }
  }

  async function borrarBorrador(id) {
    if (!window.confirm('¿Eliminar este borrador?')) return;
    try {
      await axiosAuth.delete(`/api/mensajes/${id}`);
      cargarMensajes();
    } catch { /* silencioso */ }
  }

  function contactoNombre(id) {
    return contactos.find(c => c.id === id)?.nombre || `#${id}`;
  }

  return (
    <div style={cs.pagina}>
      <Navbar titulo="Mensajería" />
      <div style={cs.contenido}>
        <div style={cs.header}>
          <h2 style={cs.tituloPagina}>Mensajería</h2>
          <button onClick={() => { setBorradorEdicion(null); setModalCompose(true); }} style={cs.btnPrimario}>
            Redactar mensaje
          </button>
        </div>

        <div style={cs.tabs}>
          {CARPETAS.map(c => (
            <button key={c.valor} onClick={() => setCarpeta(c.valor)}
              style={{ ...cs.tab, ...(carpeta === c.valor ? cs.tabActiva : {}) }}>
              {c.etiqueta}
            </button>
          ))}
        </div>

        <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por asunto o contenido..." style={{ ...cs.input, marginBottom: 16 }} />

        {error && <div style={cs.errorBox}>{error}</div>}

        {cargando ? (
          <p style={cs.textoGris}>Cargando...</p>
        ) : mensajes.length === 0 ? (
          <div style={cs.sinDatos}>
            <IconInbox size={44} style={{ color: '#ccc' }} />
            <p>No hay mensajes en esta carpeta.</p>
          </div>
        ) : (
          <div style={cs.lista}>
            {mensajes.map(m => (
              <div key={m.id} style={{ ...cs.fila, ...(m.leido === false || m.leido === 0 ? cs.filaNoLeida : {}) }}>
                <div onClick={() => abrirMensaje(m)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                  <div style={cs.filaTop}>
                    <span style={cs.filaAsunto}>{m.asunto}</span>
                    <span style={cs.filaFecha}>{formatFecha(m.creado_en)}</span>
                  </div>
                  <div style={cs.filaMeta}>
                    {carpeta === 'borradores' ? (
                      <span style={cs.contactoDetalle}>
                        Para: {parseJsonColumna(m.destinatarios_borrador).map(contactoNombre).join(', ') || '(sin destinatarios)'}
                      </span>
                    ) : (
                      <span style={cs.contactoDetalle}>{m.remitente_nombre} · {ROL_ETIQUETA[m.remitente_rol] || m.remitente_rol}</span>
                    )}
                    {m.total_adjuntos > 0 && <span style={cs.badgeAdjunto}>📎 {m.total_adjuntos}</span>}
                  </div>
                  <p style={cs.filaPreview}>{m.cuerpo}</p>
                </div>
                <div style={cs.filaAcciones}>
                  {carpeta === 'borradores' ? (
                    <button onClick={() => borrarBorrador(m.id)} style={cs.btnAccion}>Eliminar</button>
                  ) : carpeta === 'bandeja_entrada' ? (
                    <>
                      <button onClick={() => cambiarCarpeta(m.id, 'archivado')} style={cs.btnAccion}>Archivar</button>
                      <button onClick={() => cambiarCarpeta(m.id, 'eliminado')} style={cs.btnAccion}>Eliminar</button>
                    </>
                  ) : (
                    <button onClick={() => cambiarCarpeta(m.id, 'bandeja_entrada')} style={cs.btnAccion}>Restaurar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalCompose && (
        <ModalRedactar
          contactos={contactos}
          borradorInicial={borradorEdicion}
          onClose={() => setModalCompose(false)}
          onGuardado={() => { setModalCompose(false); cargarMensajes(); }}
        />
      )}

      {detalleId && (
        <ModalDetalle
          mensajeId={detalleId}
          usuarioId={usuario.id}
          contactos={contactos}
          onClose={() => setDetalleId(null)}
          onCambio={cargarMensajes}
        />
      )}
    </div>
  );
}

const cs = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tituloPagina: { fontSize: 22, fontWeight: 800, color: '#333', margin: 0 },
  tabs: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: { padding: '8px 16px', borderRadius: 20, border: '2px solid #e0e0e0', background: '#fff', color: '#888', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' },
  tabActiva: { borderColor: '#667eea', color: '#667eea', background: '#f0f0ff' },
  input: { padding: '10px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  textarea: { padding: '10px 14px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13 },
  textoGris: { color: '#888', fontSize: 14 },
  sinDatos: { background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center', color: '#888', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  lista: { display: 'flex', flexDirection: 'column', gap: 10 },
  fila: { display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  filaNoLeida: { borderLeft: '4px solid #667eea' },
  filaTop: { display: 'flex', justifyContent: 'space-between', gap: 10 },
  filaAsunto: { fontWeight: 700, color: '#333', fontSize: 14.5 },
  filaFecha: { fontSize: 12, color: '#999', whiteSpace: 'nowrap' },
  filaMeta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 },
  filaPreview: { margin: '6px 0 0', color: '#777', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  contactoDetalle: { fontSize: 12, color: '#999' },
  badgeAdjunto: { fontSize: 11, color: '#888' },
  filaAcciones: { display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 },
  btnAccion: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#555', whiteSpace: 'nowrap' },
  btnPrimario: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { background: '#f0f0ff', color: '#667eea', border: '1px solid #d8d8ff', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnCancelar: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 10, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#555' },
  btnChico: { background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#555', whiteSpace: 'nowrap' },
  btnChicoActivo: { background: '#667eea', borderColor: '#667eea', color: '#fff' },
  btnAdjunto: { background: '#f0f0ff', border: '1px solid #d8d8ff', color: '#667eea', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitulo: { fontSize: 18, fontWeight: 800, color: '#333', margin: '0 0 16px' },
  modalAcciones: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  selectChico: { padding: '10px 10px', borderRadius: 8, border: '2px solid #e8e8e8', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#555' },
  listaContactos: { maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', borderRadius: 8, padding: 6 },
  contactoGrupo: { padding: '4px 0', borderBottom: '1px solid #f2f2f2' },
  contactoFila: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 13, cursor: 'pointer' },
  contactoTexto: { display: 'flex', flexDirection: 'column', gap: 1 },
  hijosLista: { display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 8px 6px 34px' },
  hijoFila: { fontSize: 12, color: '#666' },
  ayuda: { fontSize: 12, color: '#999', margin: '6px 0 0' },
  hiloLista: { display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '48vh', overflowY: 'auto' },
  hiloMensaje: { background: '#f9f9ff', border: '1px solid #e8e8ff', borderRadius: 12, padding: 14 },
  hiloHead: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  acuseBox: { marginTop: 4 },
  acuseToggle: { background: 'none', border: 'none', color: '#2e7d32', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  acuseLista: { marginTop: 6, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  acuseFila: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#555' },
};
