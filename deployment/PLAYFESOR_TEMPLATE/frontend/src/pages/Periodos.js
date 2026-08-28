import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { IconCalendar } from '../components/Icons';
import { useAuth } from '../context/AuthContext';

const NUMERO_LABELS = { '1': 'Período 1', '2': 'Período 2', '3': 'Período 3', '4': 'Período 4' };

function nivelSemaforo(periodo) {
  if (periodo.activo) return { color: '#27ae60', label: 'ACTIVO', bg: '#eafaf1' };
  const hoy = new Date();
  const fin = new Date(periodo.fecha_fin);
  const inicio = new Date(periodo.fecha_inicio);
  if (fin < hoy) return { color: '#95a5a6', label: 'Finalizado', bg: '#f5f5f5' };
  if (inicio > hoy) return { color: '#2980b9', label: 'Próximo', bg: '#eaf3fb' };
  return { color: '#e67e22', label: 'En curso', bg: '#fef9ec' };
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '—';
  const [y, m, d] = fechaStr.split('T')[0].split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

function diasRestantes(fechaFin) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  const diff = Math.round((fin - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `Hace ${Math.abs(diff)} días`;
  if (diff === 0) return 'Cierra hoy';
  return `${diff} días para cerrar`;
}

export default function Periodos() {
  const { usuario } = useAuth();
  const colegioId = usuario?.colegio_id ? String(usuario.colegio_id) : '';
  const [periodos, setPeriodos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', numero: '1', porcentaje: '', ano_lectivo: '2026', fecha_inicio: '', fecha_fin: '' });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarPeriodos = useCallback(async () => {
    if (!colegioId) return;
    setCargando(true);
    try {
      const r = await axiosAuth.get(`/api/periodos/colegio/${colegioId}`);
      setPeriodos(r.data.data || []);
    } catch {
      setError('No se pudieron cargar los períodos');
    } finally {
      setCargando(false);
    }
  }, [colegioId]);

  useEffect(() => { cargarPeriodos(); }, [cargarPeriodos]);

  function abrirCrear() {
    setEditando(null);
    setForm({ nombre: '', numero: '1', porcentaje: '', ano_lectivo: '2026', fecha_inicio: '', fecha_fin: '' });
    setError('');
    setMostrarForm(true);
  }

  function abrirEditar(p) {
    setEditando(p.id);
    setForm({
      nombre: p.nombre,
      numero: String(p.numero),
      porcentaje: p.porcentaje !== undefined && p.porcentaje !== null ? String(p.porcentaje) : '',
      ano_lectivo: String(p.ano_lectivo),
      fecha_inicio: p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '',
      fecha_fin: p.fecha_fin ? p.fecha_fin.split('T')[0] : '',
    });
    setError('');
    setMostrarForm(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) {
      setError('Completa todos los campos');
      return;
    }
    if (form.fecha_fin <= form.fecha_inicio) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }
    const pct = form.porcentaje === '' ? 0 : parseFloat(form.porcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError('El porcentaje debe ser un número entre 0 y 100');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await axiosAuth.put(`/api/periodos/${editando}`, form);
        setExito('Período actualizado');
      } else {
        await axiosAuth.post('/api/periodos', form);
        setExito('Período creado');
      }
      setMostrarForm(false);
      cargarPeriodos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function activar(id) {
    try {
      await axiosAuth.put(`/api/periodos/${id}/activar`);
      setExito('Período activado correctamente');
      cargarPeriodos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al activar');
    }
  }

  async function eliminar(id, nombre) {
    if (!window.confirm(`¿Eliminar el período "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await axiosAuth.delete(`/api/periodos/${id}`);
      setExito('Período eliminado');
      cargarPeriodos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar');
    }
  }

  const periodoActivo = periodos.find(p => p.activo);

  // Suma de porcentajes por año lectivo — de esto depende que la nota
  // "Final" del boletín se pueda calcular (debe sumar exactamente 100%).
  const sumasPorAno = periodos.reduce((acc, p) => {
    acc[p.ano_lectivo] = (acc[p.ano_lectivo] || 0) + parseFloat(p.porcentaje || 0);
    return acc;
  }, {});

  return (
    <div style={es.pagina}>
      <Navbar titulo="Períodos Académicos" />
      <div style={es.contenido}>

        {/* Banner período activo */}
        {periodoActivo && (
          <div style={es.bannerActivo}>
            <div style={es.bannerIzq}>
              <IconCalendar size={20} style={{ color: 'var(--color-primario)' }} />
              <div>
                <div style={es.bannerTitulo}>Período activo: {periodoActivo.nombre}</div>
                <div style={es.bannerSub}>
                  {formatFecha(periodoActivo.fecha_inicio)} → {formatFecha(periodoActivo.fecha_fin)}
                  {' · '}
                  <strong>{diasRestantes(periodoActivo.fecha_fin)}</strong>
                </div>
              </div>
            </div>
            <span style={es.badgeActivo}>EN CURSO</span>
          </div>
        )}

        {/* Encabezado + botón crear */}
        <div style={es.encabezado}>
          <h2 style={es.titulo}>Períodos del año {form.ano_lectivo}</h2>
          <button onClick={abrirCrear} style={es.btnPrimario}>+ Nuevo período</button>
        </div>

        {/* Mensajes */}
        {error && <div style={es.msgError}>{error}</div>}
        {exito && <div style={es.msgExito}>{exito}</div>}

        {/* Formulario crear/editar */}
        {mostrarForm && (
          <div style={es.formCard}>
            <h3 style={es.formTitulo}>{editando ? 'Editar período' : 'Crear nuevo período'}</h3>
            <form onSubmit={guardar} style={es.form}>
              <div style={es.formFila}>
                <div style={es.formGrupo}>
                  <label style={es.label}>Nombre</label>
                  <input
                    style={es.input}
                    placeholder="Ej: Período 1 — 2026"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                  />
                </div>
                <div style={es.formGrupo}>
                  <label style={es.label}>Número de período</label>
                  <select value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} style={es.input}>
                    <option value="1">Período 1</option>
                    <option value="2">Período 2</option>
                    <option value="3">Período 3</option>
                    <option value="4">Período 4</option>
                  </select>
                </div>
                <div style={es.formGrupo}>
                  <label style={es.label}>Porcentaje en la nota Final</label>
                  <input
                    style={es.input}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Ej: 25"
                    value={form.porcentaje}
                    onChange={e => setForm({ ...form, porcentaje: e.target.value })}
                  />
                </div>
                <div style={es.formGrupo}>
                  <label style={es.label}>Año lectivo</label>
                  <input
                    style={es.input}
                    type="number"
                    min="2024"
                    max="2035"
                    value={form.ano_lectivo}
                    onChange={e => setForm({ ...form, ano_lectivo: e.target.value })}
                  />
                </div>
              </div>
              <div style={es.formFila}>
                <div style={es.formGrupo}>
                  <label style={es.label}>Fecha de inicio</label>
                  <input
                    style={es.input}
                    type="date"
                    value={form.fecha_inicio}
                    onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                  />
                </div>
                <div style={es.formGrupo}>
                  <label style={es.label}>Fecha de fin</label>
                  <input
                    style={es.input}
                    type="date"
                    value={form.fecha_fin}
                    onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                  />
                </div>
              </div>
              <div style={es.formAcciones}>
                <button type="button" onClick={() => setMostrarForm(false)} style={es.btnSecundario}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} style={es.btnPrimario}>
                  {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear período'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Suma de porcentajes por año — de esto depende la nota Final del boletín */}
        {Object.keys(sumasPorAno).length > 0 && (
          <div style={es.avisoPorcentajes}>
            {Object.entries(sumasPorAno).map(([ano, suma]) => {
              const sumaRedondeada = Math.round(suma * 100) / 100;
              const completo = sumaRedondeada === 100;
              return (
                <span
                  key={ano}
                  style={{ ...es.chipPorcentaje, ...(completo ? es.chipPorcentajeOk : es.chipPorcentajeFalta) }}
                >
                  {ano}: suma {sumaRedondeada}% {completo ? '✓ Final disponible' : `— falta ${Math.round((100 - sumaRedondeada) * 100) / 100}% para que "Final" esté disponible`}
                </span>
              );
            })}
          </div>
        )}

        {/* Lista de períodos */}
        {cargando ? (
          <div style={es.cargando}>Cargando períodos...</div>
        ) : periodos.length === 0 ? (
          <div style={es.vacio}>
            <IconCalendar size={40} style={{ color: '#ccc' }} />
            <div style={es.vacioTexto}>No hay períodos registrados</div>
            <div style={es.vacioSub}>Crea el Período 1 para comenzar el año lectivo</div>
            <button onClick={abrirCrear} style={{ ...es.btnPrimario, marginTop: '16px' }}>
              + Crear primer período
            </button>
          </div>
        ) : (
          <div style={es.grid}>
            {periodos.map(p => {
              const sem = nivelSemaforo(p);
              return (
                <div key={p.id} style={{ ...es.card, borderTop: `4px solid ${sem.color}`, background: p.activo ? '#fafffe' : '#fff' }}>
                  <div style={es.cardCabecera}>
                    <div>
                      <div style={es.cardTitulo}>{p.nombre}</div>
                      <div style={es.cardSub}>{NUMERO_LABELS[p.numero]} · {p.ano_lectivo} · {p.porcentaje ?? 0}% de la nota Final</div>
                    </div>
                    <span style={{ ...es.badge, background: sem.bg, color: sem.color }}>{sem.label}</span>
                  </div>

                  <div style={es.fechas}>
                    <div style={es.fechaItem}>
                      <span style={es.fechaLabel}>Inicio</span>
                      <span style={es.fechaVal}>{formatFecha(p.fecha_inicio)}</span>
                    </div>
                    <span style={es.fechaSep}>→</span>
                    <div style={es.fechaItem}>
                      <span style={es.fechaLabel}>Fin</span>
                      <span style={es.fechaVal}>{formatFecha(p.fecha_fin)}</span>
                    </div>
                  </div>

                  {!p.activo && new Date(p.fecha_fin) >= new Date() && (
                    <div style={es.diasRestantes}>{diasRestantes(p.fecha_fin)}</div>
                  )}
                  {p.activo && (
                    <div style={{ ...es.diasRestantes, color: '#27ae60' }}>{diasRestantes(p.fecha_fin)}</div>
                  )}

                  <div style={es.cardAcciones}>
                    {!p.activo && (
                      <button onClick={() => activar(p.id)} style={es.btnActivar}>
                        Activar
                      </button>
                    )}
                    <button onClick={() => abrirEditar(p)} style={es.btnEditar}>
                      Editar
                    </button>
                    {!p.activo && (
                      <button onClick={() => eliminar(p.id, p.nombre)} style={es.btnEliminar}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' },

  bannerActivo: {
    background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
    borderRadius: '16px', padding: '20px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '24px', color: '#fff', boxShadow: '0 4px 16px rgba(39,174,96,0.25)',
  },
  bannerIzq: { display: 'flex', alignItems: 'center', gap: '16px' },
  bannerIcono: { fontSize: '32px' },
  bannerTitulo: { fontSize: '17px', fontWeight: '700' },
  bannerSub: { fontSize: '13px', opacity: 0.9, marginTop: '2px' },
  badgeActivo: {
    background: 'rgba(255,255,255,0.25)', padding: '6px 14px',
    borderRadius: '20px', fontSize: '12px', fontWeight: '700', letterSpacing: '1px',
  },

  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  titulo: { fontSize: '20px', fontWeight: '700', color: '#333', margin: 0 },

  btnPrimario: {
    background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))', color: '#fff',
    border: 'none', borderRadius: '10px', padding: '10px 20px',
    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  },
  btnSecundario: {
    background: '#f0f2f5', color: '#555', border: 'none',
    borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer',
  },

  msgError: { background: '#fef2f2', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' },
  msgExito: { background: '#eafaf1', color: '#27ae60', border: '1px solid #a9dfbf', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' },

  avisoPorcentajes: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' },
  chipPorcentaje: { padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', border: '1px solid' },
  chipPorcentajeOk: { background: '#eafaf1', color: '#27ae60', borderColor: '#a9dfbf' },
  chipPorcentajeFalta: { background: '#fef9ec', color: '#b7791f', borderColor: '#f5d78e' },

  formCard: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px', borderLeft: '4px solid var(--color-primario)' },
  formTitulo: { fontSize: '16px', fontWeight: '700', color: '#333', marginBottom: '20px', margin: '0 0 20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formFila: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  formGrupo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#555' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'inherit' },
  formAcciones: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },

  cargando: { textAlign: 'center', color: '#888', padding: '40px', fontSize: '14px' },
  vacio: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  vacioIcono: { fontSize: '48px', marginBottom: '12px' },
  vacioTexto: { fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '6px' },
  vacioSub: { fontSize: '14px', color: '#888' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '14px' },
  cardCabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitulo: { fontSize: '17px', fontWeight: '700', color: '#222' },
  cardSub: { fontSize: '13px', color: '#888', marginTop: '2px' },
  badge: { padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', whiteSpace: 'nowrap' },

  fechas: { display: 'flex', alignItems: 'center', gap: '12px', background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px' },
  fechaItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  fechaLabel: { fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' },
  fechaVal: { fontSize: '14px', fontWeight: '600', color: '#333' },
  fechaSep: { fontSize: '18px', color: '#bbb', flex: 1, textAlign: 'center' },
  diasRestantes: { fontSize: '13px', color: '#888', fontStyle: 'italic' },

  cardAcciones: { display: 'flex', gap: '8px', marginTop: '4px' },
  btnActivar: { flex: 1, padding: '8px', background: '#eafaf1', color: '#27ae60', border: '1px solid #a9dfbf', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  btnEditar: { padding: '8px 14px', background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  btnEliminar: { padding: '8px 14px', background: '#fef2f2', color: '#c0392b', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
};
