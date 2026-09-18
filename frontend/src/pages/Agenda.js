import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconCalendar } from '../components/Icons';
import { CATEGORIAS_EVENTO, CATEGORIA_COLOR, ROLES_EVENTO, nombreCategoria } from '../config/eventos';

const RUTAS_POR_ROL = {
  admin: '/dashboard', docente: '/dashboard-docente', estudiante: '/dashboard-estudiante',
  director: '/dashboard-director', padre: '/dashboard-padre', orientador: '/bienestar',
};

const FILA_VACIA = { fecha: '', hora_inicio: '', hora_fin: '', lugar: '' };
const FORM_VACIO = { titulo: '', categoria: CATEGORIAS_EVENTO[0].clave, detalle: '', dirigido_roles: [], dirigido_grados: [], fechas: [{ ...FILA_VACIA }] };

function formatoFechaLarga(fecha) {
  const d = new Date(fecha);
  const texto = d.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatoHora(hora) {
  if (!hora) return '';
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function claveFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function esMismoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function nombreMesAnio(d) {
  const texto = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Agenda() {
  const { usuario, modulosDesactivados } = useAuth();
  const navigate = useNavigate();
  const puedeGestionar = ['admin', 'director'].includes(usuario.rol) && !modulosDesactivados.includes('agenda_gestion');

  const [eventos, setEventos] = useState([]);
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [categoriasActivas, setCategoriasActivas] = useState(new Set(CATEGORIAS_EVENTO.map(c => c.clave)));

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [eventoDetalle, setEventoDetalle] = useState(null);
  const [vista, setVista] = useState('calendario');
  const [mesActual, setMesActual] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      // Quien administra ve TODOS los eventos del colegio (incluso los que
      // no van dirigidos a su propio rol) para poder editarlos o borrarlos;
      // el resto ve únicamente lo que le corresponde.
      const resp = await axiosAuth.get(puedeGestionar ? '/api/eventos?gestion=1' : '/api/eventos');
      setEventos(resp.data.data);
    } catch {
      setError('No se pudo cargar la agenda institucional.');
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!puedeGestionar) return;
    axiosAuth.get('/api/eventos/opciones').then(r => setGrados(r.data.data.grados)).catch(() => {});
  }, [puedeGestionar]);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  function toggleCategoria(clave) {
    setCategoriasActivas(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  }

  const filas = useMemo(() => {
    return eventos
      .filter(e => categoriasActivas.has(e.categoria))
      .flatMap(e => e.fechas.map(f => ({ evento: e, fecha: f })))
      .sort((a, b) => String(a.fecha.fecha).localeCompare(String(b.fecha.fecha)) || (a.fecha.hora_inicio || '').localeCompare(b.fecha.hora_inicio || ''));
  }, [eventos, categoriasActivas]);

  const gruposPorFecha = useMemo(() => {
    const grupos = [];
    let actual = null;
    for (const fila of filas) {
      const clave = String(fila.fecha.fecha).slice(0, 10);
      if (!actual || actual.clave !== clave) {
        actual = { clave, fecha: fila.fecha.fecha, filas: [] };
        grupos.push(actual);
      }
      actual.filas.push(fila);
    }
    return grupos;
  }, [filas]);

  // Mismos datos que gruposPorFecha, pero indexados por clave YYYY-MM-DD
  // para pintar rápido cada celda del calendario.
  const eventosPorFecha = useMemo(() => {
    const mapa = new Map();
    for (const fila of filas) {
      const clave = String(fila.fecha.fecha).slice(0, 10);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(fila);
    }
    return mapa;
  }, [filas]);

  // Grilla de 6 semanas (siempre) empezando en domingo, con los días del mes
  // anterior/siguiente que completan la primera y última semana en gris.
  const diasCalendario = useMemo(() => {
    const primerDiaMes = mesActual;
    const diaSemana = primerDiaMes.getDay(); // 0 = domingo
    const inicio = new Date(primerDiaMes);
    inicio.setDate(inicio.getDate() - diaSemana);

    const hoy = new Date();
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      dias.push({
        fecha: d,
        clave: claveFecha(d),
        delMes: d.getMonth() === primerDiaMes.getMonth(),
        esHoy: esMismoDia(d, hoy),
      });
    }
    return dias;
  }, [mesActual]);

  function mesAnterior() {
    setMesActual(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }
  function mesSiguiente() {
    setMesActual(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }
  function irAHoy() {
    const h = new Date();
    setMesActual(new Date(h.getFullYear(), h.getMonth(), 1));
  }

  function abrirCrear() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setErrorForm('');
    setModalAbierto(true);
  }

  function abrirEditar(evento) {
    setEditandoId(evento.id);
    setForm({
      titulo: evento.titulo,
      categoria: evento.categoria,
      detalle: evento.detalle || '',
      dirigido_roles: Array.isArray(evento.dirigido_roles) ? evento.dirigido_roles : [],
      dirigido_grados: Array.isArray(evento.dirigido_grados) ? evento.dirigido_grados : [],
      fechas: evento.fechas.length > 0
        ? evento.fechas.map(f => ({
            fecha: String(f.fecha).slice(0, 10),
            hora_inicio: (f.hora_inicio || '').slice(0, 5),
            hora_fin: (f.hora_fin || '').slice(0, 5),
            lugar: f.lugar || '',
          }))
        : [{ ...FILA_VACIA }],
    });
    setErrorForm('');
    setModalAbierto(true);
  }

  function toggleEnArray(campo, valor) {
    setForm(prev => ({
      ...prev,
      [campo]: prev[campo].includes(valor) ? prev[campo].filter(v => v !== valor) : [...prev[campo], valor],
    }));
  }

  function cambiarFila(i, campo, valor) {
    setForm(prev => ({
      ...prev,
      fechas: prev.fechas.map((f, idx) => idx === i ? { ...f, [campo]: valor } : f),
    }));
  }

  function agregarFila() {
    setForm(prev => ({ ...prev, fechas: [...prev.fechas, { ...FILA_VACIA }] }));
  }

  function quitarFila(i) {
    setForm(prev => ({ ...prev, fechas: prev.fechas.filter((_, idx) => idx !== i) }));
  }

  async function guardar() {
    if (!form.titulo.trim()) return setErrorForm('El título es obligatorio');
    if (form.fechas.some(f => !f.fecha)) return setErrorForm('Todas las fechas deben estar completas');

    setGuardando(true);
    setErrorForm('');
    try {
      if (editandoId) {
        await axiosAuth.put(`/api/eventos/${editandoId}`, form);
      } else {
        await axiosAuth.post('/api/eventos', form);
      }
      setModalAbierto(false);
      await cargar();
      mostrarMensaje(editandoId ? 'Evento actualizado correctamente.' : 'Evento creado correctamente.');
    } catch (err) {
      setErrorForm(err.response?.data?.error || 'Error al guardar el evento');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este evento de la agenda institucional?')) return;
    try {
      await axiosAuth.delete(`/api/eventos/${id}`);
      await cargar();
      mostrarMensaje('Evento eliminado correctamente.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el evento');
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Agenda Institucional" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(RUTAS_POR_ROL[usuario.rol] || '/login')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={{ ...es.titulo, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCalendar size={20} style={{ color: '#764ba2' }} />
            Agenda Institucional
          </h2>
          <p style={es.subtitulo}>Eventos generales del colegio, visibles para toda la comunidad.</p>
        </div>

        {puedeGestionar && (
          <button onClick={abrirCrear} style={es.btnPrimario}>+ Crear Evento</button>
        )}

        <div style={es.filtroRow}>
          {CATEGORIAS_EVENTO.map(c => (
            <button
              key={c.clave}
              onClick={() => toggleCategoria(c.clave)}
              style={{
                ...es.filtroBtn,
                ...(categoriasActivas.has(c.clave) ? { background: CATEGORIA_COLOR[c.clave], borderColor: CATEGORIA_COLOR[c.clave], color: '#fff' } : {}),
              }}
            >
              {c.nombre}
            </button>
          ))}
          <div style={es.vistaToggle}>
            <button onClick={() => setVista('calendario')} style={{ ...es.vistaBtn, ...(vista === 'calendario' ? es.vistaBtnActivo : {}) }}>Calendario</button>
            <button onClick={() => setVista('lista')} style={{ ...es.vistaBtn, ...(vista === 'lista' ? es.vistaBtnActivo : {}) }}>Lista</button>
          </div>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando agenda...</div>
        ) : vista === 'calendario' ? (
          <div style={es.calendarioCard}>
            <div style={es.calNavBar}>
              <div style={es.calMesTitulo}>{nombreMesAnio(mesActual)}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={irAHoy} style={es.calBtnHoy}>Hoy</button>
                <button onClick={mesAnterior} style={es.calBtnNav}>‹</button>
                <button onClick={mesSiguiente} style={es.calBtnNav}>›</button>
              </div>
            </div>
            <div style={es.calScroll}>
              <div style={es.calGrid}>
                {DIAS_SEMANA_CORTO.map(d => <div key={d} style={es.calDiaHeader}>{d}</div>)}
                {diasCalendario.map(({ fecha, clave, delMes, esHoy }) => {
                  const eventosDia = eventosPorFecha.get(clave) || [];
                  const visibles = eventosDia.slice(0, 3);
                  const restantes = eventosDia.length - visibles.length;
                  return (
                    <div key={clave} style={{ ...es.calCelda, ...(delMes ? {} : es.calCeldaFuera) }}>
                      <span style={{ ...es.calNumeroDia, ...(esHoy ? es.calNumeroHoy : {}) }}>{fecha.getDate()}</span>
                      <div style={es.calEventosLista}>
                        {visibles.map(({ evento }, i) => (
                          <button
                            key={`${evento.id}_${i}`}
                            onClick={() => setEventoDetalle(evento)}
                            style={{ ...es.calEventoChip, background: CATEGORIA_COLOR[evento.categoria] || '#999' }}
                            title={evento.titulo}
                          >
                            {evento.titulo}
                          </button>
                        ))}
                        {restantes > 0 && (
                          <button onClick={() => setDiaSeleccionado({ fecha, eventos: eventosDia })} style={es.calMasBtn}>
                            +{restantes} más
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : gruposPorFecha.length === 0 ? (
          <div style={es.sinDatos}>No hay eventos programados por ahora.</div>
        ) : (
          <div style={es.tablaCard}>
            {gruposPorFecha.map(grupo => (
              <div key={grupo.clave}>
                <div style={es.fechaHeader}>{formatoFechaLarga(grupo.fecha)}</div>
                {grupo.filas.map(({ evento, fecha }, i) => (
                  <div key={`${evento.id}_${i}`} style={es.filaEvento}>
                    <span style={{ ...es.puntoCategoria, background: CATEGORIA_COLOR[evento.categoria] || '#999' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => setEventoDetalle(evento)} style={es.enlaceEvento}>{evento.titulo}</button>
                      <div style={es.metaEvento}>
                        {(fecha.hora_inicio || fecha.hora_fin) && (
                          <span>{formatoHora(fecha.hora_inicio)}{fecha.hora_fin ? ` - ${formatoHora(fecha.hora_fin)}` : ''}</span>
                        )}
                        {fecha.lugar && <span> · {fecha.lugar}</span>}
                        <span> · {nombreCategoria(evento.categoria)}</span>
                      </div>
                      <div style={es.creador}>Creado por: {evento.creado_por_nombre || '—'}</div>
                    </div>
                    {puedeGestionar && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => abrirEditar(evento)} style={es.btnMiniSec}>Editar</button>
                        <button onClick={() => eliminar(evento.id)} style={es.btnMiniPeligro}>Eliminar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: crear/editar evento */}
      {modalAbierto && (
        <>
          <div onClick={() => !guardando && setModalAbierto(false)} style={es.fondoModal} />
          <div style={es.modal}>
            <div style={es.modalCabecera}>{editandoId ? 'Editar evento' : 'Crear evento'}</div>
            <div style={es.modalCuerpo}>
              {errorForm && <div style={es.errorBox}>{errorForm}</div>}

              <label style={es.label}>Título *</label>
              <input style={es.input} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />

              <label style={es.label}>Categoría</label>
              <select style={es.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS_EVENTO.map(c => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
              </select>

              <label style={es.label}>Detalle (opcional)</label>
              <textarea style={{ ...es.input, minHeight: '70px', resize: 'vertical' }} value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} />

              <label style={es.label}>Dirigido a (deja todo sin marcar para que lo vea todo el colegio)</label>
              <div style={es.chipsFila}>
                {ROLES_EVENTO.map(r => (
                  <button key={r.clave} type="button" onClick={() => toggleEnArray('dirigido_roles', r.clave)}
                    style={{ ...es.chip, ...(form.dirigido_roles.includes(r.clave) ? es.chipActivo : {}) }}>
                    {r.nombre}
                  </button>
                ))}
              </div>

              {grados.length > 0 && (
                <>
                  <label style={es.label}>Grados específicos (opcional — aplica a estudiantes y acudientes)</label>
                  <div style={es.chipsFila}>
                    {grados.map(g => (
                      <button key={g.codigo} type="button" onClick={() => toggleEnArray('dirigido_grados', g.codigo)}
                        style={{ ...es.chip, ...(form.dirigido_grados.includes(g.codigo) ? es.chipActivo : {}) }}>
                        {g.nombre}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label style={es.label}>Horario del evento</label>
              {form.fechas.map((f, i) => (
                <div key={i} style={es.filaFecha}>
                  <input type="date" style={{ ...es.input, ...es.inputFecha }} value={f.fecha} onChange={e => cambiarFila(i, 'fecha', e.target.value)} />
                  <input type="time" style={{ ...es.input, ...es.inputHora }} value={f.hora_inicio} onChange={e => cambiarFila(i, 'hora_inicio', e.target.value)} />
                  <input type="time" style={{ ...es.input, ...es.inputHora }} value={f.hora_fin} onChange={e => cambiarFila(i, 'hora_fin', e.target.value)} />
                  <input type="text" placeholder="Lugar" style={{ ...es.input, flex: 1 }} value={f.lugar} onChange={e => cambiarFila(i, 'lugar', e.target.value)} />
                  {form.fechas.length > 1 && (
                    <button type="button" onClick={() => quitarFila(i)} style={es.btnQuitarFila}>✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={agregarFila} style={es.btnAgregarFecha}>+ Agregar fecha</button>
            </div>
            <div style={es.modalBotones}>
              <button onClick={() => setModalAbierto(false)} disabled={guardando} style={es.btnCancelar}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...es.btnPrimario, opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando...' : (editandoId ? 'Guardar cambios' : 'Crear evento')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal: todos los eventos de un día (cuando hay más de los que caben en la celda) */}
      {diaSeleccionado && (
        <>
          <div onClick={() => setDiaSeleccionado(null)} style={es.fondoModal} />
          <div style={{ ...es.modal, maxWidth: '420px' }}>
            <div style={es.modalCabecera}>{formatoFechaLarga(diaSeleccionado.fecha)}</div>
            <div style={es.modalCuerpo}>
              {diaSeleccionado.eventos.map(({ evento, fecha }, i) => (
                <button
                  key={`${evento.id}_${i}`}
                  onClick={() => { setEventoDetalle(evento); setDiaSeleccionado(null); }}
                  style={es.diaListaItem}
                >
                  <span style={{ ...es.puntoCategoria, background: CATEGORIA_COLOR[evento.categoria] || '#999' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', color: '#333', fontSize: '13.5px' }}>{evento.titulo}</div>
                    <div style={es.metaEvento}>
                      {(fecha.hora_inicio || fecha.hora_fin) && (
                        <span>{formatoHora(fecha.hora_inicio)}{fecha.hora_fin ? ` - ${formatoHora(fecha.hora_fin)}` : ''}</span>
                      )}
                      {fecha.lugar && <span> · {fecha.lugar}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div style={es.modalBotones}>
              <button onClick={() => setDiaSeleccionado(null)} style={es.btnPrimario}>Cerrar</button>
            </div>
          </div>
        </>
      )}

      {/* Modal: ver detalle de evento (lectura) */}
      {eventoDetalle && (
        <>
          <div onClick={() => setEventoDetalle(null)} style={es.fondoModal} />
          <div style={{ ...es.modal, maxWidth: '520px' }}>
            <div style={es.modalCabecera}>{eventoDetalle.titulo}</div>
            <div style={es.modalCuerpo}>
              <p style={es.detalleFila}><strong>Categoría:</strong> {nombreCategoria(eventoDetalle.categoria)}</p>
              <p style={es.detalleFila}><strong>Creado por:</strong> {eventoDetalle.creado_por_nombre || '—'}</p>
              {eventoDetalle.detalle && <p style={es.detalleFila}>{eventoDetalle.detalle}</p>}
              <p style={es.detalleFila}>
                <strong>Dirigido a:</strong>{' '}
                {(Array.isArray(eventoDetalle.dirigido_roles) && eventoDetalle.dirigido_roles.length
                  ? eventoDetalle.dirigido_roles.map(r => ROLES_EVENTO.find(x => x.clave === r)?.nombre || r).join(', ')
                  : 'Todo el colegio')}
                {Array.isArray(eventoDetalle.dirigido_grados) && eventoDetalle.dirigido_grados.length
                  ? ` · Grados: ${eventoDetalle.dirigido_grados.join(', ')}` : ''}
              </p>
              <table style={es.tablaHorario}>
                <thead>
                  <tr>{['Fecha', 'Hora inicial', 'Hora final', 'Lugar'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {eventoDetalle.fechas.map((f, i) => (
                    <tr key={i}>
                      <td style={es.td}>{formatoFechaLarga(f.fecha)}</td>
                      <td style={es.td}>{formatoHora(f.hora_inicio)}</td>
                      <td style={es.td}>{formatoHora(f.hora_fin)}</td>
                      <td style={es.td}>{f.lugar || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={es.modalBotones}>
              {puedeGestionar && (
                <button
                  onClick={() => { const ev = eventoDetalle; setEventoDetalle(null); abrirEditar(ev); }}
                  style={es.btnMiniSec}
                >
                  Editar
                </button>
              )}
              <button onClick={() => setEventoDetalle(null)} style={es.btnPrimario}>Cerrar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  encabezado: { marginBottom: '14px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0 },

  filtroRow: { display: 'flex', gap: '8px', margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' },
  filtroBtn: { padding: '7px 14px', borderRadius: '20px', border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#666', fontFamily: 'inherit' },

  vistaToggle: { display: 'flex', gap: '4px', background: '#eee', borderRadius: '10px', padding: '3px', marginLeft: 'auto' },
  vistaBtn: { padding: '6px 14px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#666', fontFamily: 'inherit' },
  vistaBtnActivo: { background: '#fff', color: '#764ba2', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },

  calendarioCard: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '18px', overflow: 'hidden' },
  calNavBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' },
  calMesTitulo: { fontSize: '17px', fontWeight: '800', color: '#1a1a2e' },
  calBtnHoy: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  calBtnNav: { background: '#f0f2f5', color: '#764ba2', border: 'none', borderRadius: '8px', width: '32px', height: '32px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  calScroll: { overflowX: 'auto' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))', minWidth: '680px' },
  calDiaHeader: { textAlign: 'center', fontSize: '11.5px', fontWeight: '700', color: '#999', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '0.3px' },
  calCelda: { minHeight: '96px', border: '1px solid #f0f0f0', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px' },
  calCeldaFuera: { background: '#fafafa' },
  calNumeroDia: { fontSize: '12.5px', fontWeight: '700', color: '#555', alignSelf: 'flex-start', padding: '2px 6px' },
  calNumeroHoy: { background: '#764ba2', color: '#fff', borderRadius: '999px', padding: '2px 8px' },
  calEventosLista: { display: 'flex', flexDirection: 'column', gap: '3px' },
  calEventoChip: { border: 'none', borderRadius: '5px', padding: '3px 6px', fontSize: '10.5px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  calMasBtn: { border: 'none', background: 'none', color: '#764ba2', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '2px 4px' },

  diaListaItem: { display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid #f2edf7', padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit' },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },
  sinDatos: { background: '#fff', borderRadius: '16px', padding: '50px', textAlign: 'center', color: '#999', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },

  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },

  tablaCard: { background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' },
  fechaHeader: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', padding: '9px 18px', fontSize: '13px', fontWeight: '700' },
  filaEvento: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', borderBottom: '1px solid #f2edf7' },
  puntoCategoria: { width: '10px', height: '10px', borderRadius: '50%', marginTop: '5px', flexShrink: 0 },
  enlaceEvento: { background: 'none', border: 'none', padding: 0, color: '#764ba2', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  metaEvento: { fontSize: '12px', color: '#888', marginTop: '3px' },
  creador: { fontSize: '11px', color: '#bbb', marginTop: '2px', fontStyle: 'italic' },

  btnMiniSec: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnMiniPeligro: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  fondoModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 200 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '560px', maxWidth: '92vw', maxHeight: '88vh', background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 201, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalCabecera: { padding: '16px 22px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontWeight: '800', fontSize: '15px' },
  modalCuerpo: { padding: '18px 22px', overflowY: 'auto', flex: 1 },
  modalBotones: { display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '14px 22px', borderTop: '1px solid #f0f0f0' },

  label: { display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#555', margin: '14px 0 6px' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box' },

  chipsFila: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: { padding: '6px 12px', borderRadius: '20px', border: '1.5px solid #e0d5ee', background: '#fff', color: '#764ba2', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  chipActivo: { background: '#764ba2', borderColor: '#764ba2', color: '#fff' },

  filaFecha: { display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' },
  inputFecha: { width: 'auto', flex: '1 1 140px' },
  inputHora: { width: 'auto', flex: '1 1 100px' },
  btnQuitarFila: { background: '#fff0f0', color: '#c62828', border: 'none', borderRadius: '6px', width: '30px', height: '30px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  btnAgregarFecha: { background: 'none', border: '1.5px dashed #c5b3dd', color: '#764ba2', borderRadius: '8px', padding: '8px', width: '100%', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: '600' },

  btnCancelar: { background: '#f0f2f5', color: '#666', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  detalleFila: { fontSize: '13px', color: '#444', margin: '0 0 10px', lineHeight: 1.5 },
  tablaHorario: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
  th: { padding: '8px 10px', fontSize: '11px', fontWeight: '700', color: '#fff', background: '#a084c9', textAlign: 'left' },
  td: { padding: '8px 10px', fontSize: '12.5px', color: '#444', borderBottom: '1px solid #f0e9f7' },
};
