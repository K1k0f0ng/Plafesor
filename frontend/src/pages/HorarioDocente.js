import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconCalendar, IconArrowLeft, IconClock, IconCheck } from '../components/Icons';

// Paleta cíclica — ya no está atada a un día fijo porque los días activos
// ahora los define cada colegio en Semana Académica.
const PALETA_COLORES = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feb47b'];

const FORM_VACIO = { dia_semana: null, grupo_id: '', materia_id: '', hora_inicio: '', hora_fin: '', salon_id: '' };

export default function HorarioDocente() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState([]);
  const [horario, setHorario] = useState([]);
  const [dias, setDias] = useState([]);
  const [salones, setSalones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [diaAbierto, setDiaAbierto] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'err', texto }

  useEffect(() => {
    async function cargar() {
      try {
        const [respAsig, respHor, respDias, respSalones] = await Promise.all([
          axiosAuth.get(`/api/docentes/${usuario.id}/asignaciones`),
          axiosAuth.get('/api/horarios/mio'),
          axiosAuth.get('/api/semana-academica'),
          axiosAuth.get('/api/salones'),
        ]);
        setAsignaciones(respAsig.data.data || []);
        setHorario(respHor.data.data || []);
        setDias((respDias.data.data || []).filter(d => d.activo));
        setSalones(respSalones.data.data || []);
      } catch {
        // silencioso
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [usuario.id]);

  function colorDia(diaNumero) {
    const idx = dias.findIndex(d => d.dia_numero === diaNumero);
    return PALETA_COLORES[idx % PALETA_COLORES.length] || '#667eea';
  }

  function nombreDia(diaNumero) {
    return dias.find(d => d.dia_numero === diaNumero)?.nombre || `Día ${diaNumero}`;
  }

  // Grupos únicos del docente
  const grupos = useMemo(() =>
    [...new Map(asignaciones.map(a => [a.grupo_id, a])).values()],
    [asignaciones]
  );

  // Materias del grupo seleccionado en el formulario
  const materiasFiltradas = useMemo(() =>
    asignaciones.filter(a => a.grupo_id === parseInt(form.grupo_id)),
    [asignaciones, form.grupo_id]
  );

  // Horario agrupado por día
  const porDia = useMemo(() => {
    const mapa = {};
    dias.forEach(d => { mapa[d.dia_numero] = []; });
    horario.forEach(h => { if (mapa[h.dia_semana]) mapa[h.dia_semana].push(h); });
    return mapa;
  }, [horario, dias]);

  function abrirFormDia(dia) {
    setDiaAbierto(dia);
    setForm({ ...FORM_VACIO, dia_semana: dia });
    setMsg(null);
  }

  function cerrarForm() {
    setDiaAbierto(null);
    setForm(FORM_VACIO);
    setMsg(null);
  }

  async function recargar() {
    const resp = await axiosAuth.get('/api/horarios/mio');
    setHorario(resp.data.data || []);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.grupo_id || !form.materia_id || !form.hora_inicio || !form.hora_fin) {
      setMsg({ tipo: 'err', texto: 'Completa todos los campos' });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      await axiosAuth.post('/api/horarios', {
        grupo_id:    parseInt(form.grupo_id),
        materia_id:  parseInt(form.materia_id),
        dia_semana:  parseInt(form.dia_semana),
        hora_inicio: form.hora_inicio,
        hora_fin:    form.hora_fin,
        salon_id:    form.salon_id || null,
      });
      await recargar();
      setMsg({ tipo: 'ok', texto: 'Franja guardada' });
      setForm({ ...FORM_VACIO, dia_semana: form.dia_semana });
    } catch (err) {
      setMsg({ tipo: 'err', texto: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id) {
    try {
      await axiosAuth.delete(`/api/horarios/${id}`);
      setHorario(prev => prev.filter(h => h.id !== id));
    } catch {
      // silencioso
    }
  }

  function formatHora(t) {
    if (!t) return '';
    return t.slice(0, 5); // HH:MM
  }

  const totalFranjas = horario.length;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Mi horario semanal" />
      <div style={es.contenido}>

        {/* Cabecera */}
        <div style={es.cabecera}>
          <button onClick={() => navigate('/dashboard-docente')} style={es.btnVolver}>
            <IconArrowLeft size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Volver
          </button>
          <div style={es.cabeceraInfo}>
            <IconCalendar size={22} style={{ color: '#667eea' }} />
            <span style={es.cabeceraTexto}>
              {totalFranjas === 0
                ? 'Sin franjas configuradas — agrega tus clases'
                : `${totalFranjas} franja${totalFranjas !== 1 ? 's' : ''} configuradas`}
            </span>
          </div>
        </div>

        {cargando ? (
          <p style={es.gris}>Cargando...</p>
        ) : grupos.length === 0 ? (
          <div style={es.vacio}>No tienes grupos asignados. Contacta al administrador.</div>
        ) : dias.length === 0 ? (
          <div style={es.vacio}>El colegio no tiene días de clase configurados en la Semana Académica.</div>
        ) : (
          <div style={es.diasGrid}>
            {dias.map(({ dia_numero: dia }) => (
              <div key={dia} style={es.diaColumna}>
                {/* Cabecera del día */}
                <div style={{ ...es.diaCabecera, borderBottom: `3px solid ${colorDia(dia)}` }}>
                  <span style={{ ...es.diaNombre, color: colorDia(dia) }}>{nombreDia(dia)}</span>
                  <span style={es.diaCount}>{porDia[dia].length} clase{porDia[dia].length !== 1 ? 's' : ''}</span>
                </div>

                {/* Franjas del día */}
                {porDia[dia].length === 0 && (
                  <p style={es.diaVacio}>Sin clases</p>
                )}
                {porDia[dia].map(franja => (
                  <div key={franja.id} style={{ ...es.franja, borderLeft: `3px solid ${colorDia(dia)}` }}>
                    <div style={es.franjaHora}>
                      <IconClock size={12} style={{ color: '#aaa', marginRight: 4, flexShrink: 0 }} />
                      {formatHora(franja.hora_inicio)} – {formatHora(franja.hora_fin)}
                    </div>
                    <div style={es.franjaGrupo}>Grado {franja.grado}° — {franja.nombre_grupo}</div>
                    <div style={es.franjaMateria}>{franja.nombre_materia}</div>
                    {franja.nombre_salon && <div style={es.franjaSalon}>{franja.nombre_salon}</div>}
                    <button onClick={() => eliminar(franja.id)} style={es.btnEliminar} title="Eliminar franja">
                      ×
                    </button>
                  </div>
                ))}

                {/* Botón agregar / formulario */}
                {diaAbierto !== dia ? (
                  <button onClick={() => abrirFormDia(dia)} style={{ ...es.btnAgregar, borderColor: colorDia(dia), color: colorDia(dia) }}>
                    + Agregar clase
                  </button>
                ) : (
                  <form onSubmit={guardar} style={es.formInline}>
                    <select
                      value={form.grupo_id}
                      onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value, materia_id: '' }))}
                      style={es.select}
                    >
                      <option value="">— Selecciona grupo —</option>
                      {grupos.map(g => (
                        <option key={g.grupo_id} value={g.grupo_id}>
                          Grado {g.grado}° — {g.nombre_grupo}
                        </option>
                      ))}
                    </select>

                    <select
                      value={form.materia_id}
                      onChange={e => setForm(f => ({ ...f, materia_id: e.target.value }))}
                      style={es.select}
                      disabled={!form.grupo_id}
                    >
                      <option value="">— Selecciona materia —</option>
                      {materiasFiltradas.map(a => (
                        <option key={a.materia_id} value={a.materia_id}>{a.nombre_materia}</option>
                      ))}
                    </select>

                    {salones.length > 0 && (
                      <select
                        value={form.salon_id}
                        onChange={e => setForm(f => ({ ...f, salon_id: e.target.value }))}
                        style={es.select}
                      >
                        <option value="">— Salón (opcional) —</option>
                        {salones.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    )}

                    <div style={es.horasRow}>
                      <div style={{ flex: 1 }}>
                        <label style={es.label}>Inicio</label>
                        <input
                          type="time" value={form.hora_inicio}
                          onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                          style={es.inputTime}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={es.label}>Fin</label>
                        <input
                          type="time" value={form.hora_fin}
                          onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                          style={es.inputTime}
                        />
                      </div>
                    </div>

                    {msg && (
                      <p style={{ fontSize: 12, color: msg.tipo === 'ok' ? '#2e7d32' : '#c62828', margin: '4px 0' }}>
                        {msg.tipo === 'ok' && <IconCheck size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                        {msg.texto}
                      </p>
                    )}

                    <div style={es.formBtns}>
                      <button type="submit" disabled={guardando}
                        style={{ ...es.btnGuardar, background: colorDia(dia), opacity: guardando ? 0.7 : 1 }}>
                        {guardando ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button type="button" onClick={cerrarForm} style={es.btnCancelar}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '28px 20px', maxWidth: '1200px', margin: '0 auto' },
  cabecera: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  btnVolver: {
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
    padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    color: '#555', fontWeight: 600,
  },
  cabeceraInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  cabeceraTexto: { fontSize: 15, fontWeight: 700, color: '#333' },
  gris: { color: '#888', fontSize: 14 },
  vacio: { background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#aaa' },
  diasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16,
    alignItems: 'start',
  },
  diaColumna: {
    background: '#fff', borderRadius: 14, padding: '16px 14px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  diaCabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 2 },
  diaNombre: { fontWeight: 800, fontSize: 15 },
  diaCount: { fontSize: 11, color: '#aaa', fontWeight: 600 },
  diaVacio: { fontSize: 12, color: '#ccc', textAlign: 'center', margin: '8px 0' },
  franja: {
    position: 'relative', background: '#f8f9ff', borderRadius: 8,
    padding: '10px 12px', paddingRight: 28,
  },
  franjaHora: { display: 'flex', alignItems: 'center', fontSize: 11, color: '#888', marginBottom: 4 },
  franjaGrupo: { fontSize: 12, fontWeight: 800, color: '#333', marginBottom: 2 },
  franjaMateria: { fontSize: 12, color: '#667eea', fontWeight: 600 },
  franjaSalon: { fontSize: 11, color: '#999', marginTop: 2 },
  btnEliminar: {
    position: 'absolute', top: 6, right: 6,
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: '#ccc', lineHeight: 1, padding: '0 2px',
    fontWeight: 700,
  },
  btnAgregar: {
    background: 'none', border: '1.5px dashed', borderRadius: 8,
    padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', width: '100%', textAlign: 'center',
  },
  formInline: { display: 'flex', flexDirection: 'column', gap: 8 },
  select: {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid #ddd', fontSize: 12, fontFamily: 'inherit',
    background: '#fafafa',
  },
  horasRow: { display: 'flex', gap: 8 },
  label: { display: 'block', fontSize: 10, color: '#888', marginBottom: 3, fontWeight: 600 },
  inputTime: {
    width: '100%', padding: '7px 8px', borderRadius: 8,
    border: '1px solid #ddd', fontSize: 12, fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  formBtns: { display: 'flex', gap: 6 },
  btnGuardar: {
    flex: 1, color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 0', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnCancelar: {
    flex: 1, background: '#f0f0f0', color: '#666', border: 'none',
    borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
