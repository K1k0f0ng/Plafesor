import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

export default function AsignaturasPorGrado() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [grados, setGrados] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [gradoSeleccionado, setGradoSeleccionado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [cargandoGrado, setCargandoGrado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarInicial = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [rGrados, rMaterias] = await Promise.all([
        axiosAuth.get('/api/grados-academicos'),
        axiosAuth.get('/api/materias'),
      ]);
      const listaGrados = [...rGrados.data.data].sort((a, b) => a.orden - b.orden);
      setGrados(listaGrados);
      setMaterias(rMaterias.data.data);
      if (listaGrados.length > 0) setGradoSeleccionado(listaGrados[0].codigo);
    } catch {
      setError('No se pudo cargar la información de grados y asignaturas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);

  const cargarSeleccionDelGrado = useCallback(async (grado) => {
    if (!grado) return;
    setCargandoGrado(true);
    setError('');
    setMensaje('');
    try {
      const resp = await axiosAuth.get(`/api/grado-materias/${grado}`);
      setSeleccionadas(new Set(resp.data.data));
    } catch {
      setError('No se pudo cargar el pénsum de este grado.');
    } finally {
      setCargandoGrado(false);
    }
  }, []);

  useEffect(() => { cargarSeleccionDelGrado(gradoSeleccionado); }, [gradoSeleccionado, cargarSeleccionDelGrado]);

  function alternar(materiaId) {
    setSeleccionadas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(materiaId)) nuevo.delete(materiaId);
      else nuevo.add(materiaId);
      return nuevo;
    });
  }

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await axiosAuth.put(`/api/grado-materias/${gradoSeleccionado}`, {
        materia_ids: Array.from(seleccionadas),
      });
      setMensaje('Asignaturas del grado actualizadas correctamente.');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar las asignaturas del grado');
    } finally {
      setGuardando(false);
    }
  }

  // Agrupar asignaturas por área, igual que en la pantalla de Materias
  const porArea = useMemo(() => materias.reduce((acc, m) => {
    const key = m.area_id || 'sin-area';
    if (!acc[key]) acc[key] = { nombre: m.nombre_area || 'Sin área asignada', codigo: m.codigo_area || '', items: [] };
    acc[key].items.push(m);
    return acc;
  }, {}), [materias]);
  const gruposArea = Object.entries(porArea).sort(([a], [b]) => (a === 'sin-area' ? 1 : b === 'sin-area' ? -1 : 0));

  const gradoActual = grados.find(g => g.codigo === gradoSeleccionado);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Asignaturas por Grado" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Asignaturas por Grado</h2>
          <p style={es.subtitulo}>
            Define qué asignaturas se dictan en cada grado (el pénsum). Esto no reemplaza la asignación de
            docente a un grupo — solo establece cuáles asignaturas aplican para ese grado.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando...</div>
        ) : grados.length === 0 ? (
          <div style={es.card}><p style={es.textoGris}>Primero crea grados académicos en "Grados Académicos".</p></div>
        ) : materias.length === 0 ? (
          <div style={es.card}><p style={es.textoGris}>Primero crea asignaturas en "Materias".</p></div>
        ) : (
          <div style={es.card}>
            <div style={es.selectores}>
              <select style={es.select} value={gradoSeleccionado} onChange={e => setGradoSeleccionado(e.target.value)}>
                {grados.map(g => <option key={g.id} value={g.codigo}>{g.nombre}</option>)}
              </select>
              {gradoActual && <span style={es.contador}>{seleccionadas.size} asignatura(s) seleccionada(s)</span>}
            </div>

            {cargandoGrado ? (
              <div style={es.cargando}>Cargando pénsum del grado...</div>
            ) : (
              gruposArea.map(([key, grupo]) => (
                <div key={key} style={es.areaBloque}>
                  <div style={es.areaEncabezado}>
                    {grupo.codigo && <span style={es.areaCodigo}>{grupo.codigo}</span>}
                    {grupo.nombre}
                  </div>
                  <div style={es.materiasGrid}>
                    {grupo.items.map(m => (
                      <label key={m.id} style={{ ...es.materiaCheck, ...(seleccionadas.has(m.id) ? es.materiaCheckActivo : {}) }}>
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(m.id)}
                          onChange={() => alternar(m.id)}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={es.materiaCodigo}>{m.codigo}</span> {m.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div style={es.botones}>
              <button onClick={guardar} disabled={guardando || cargandoGrado} style={{ ...es.btnPrimario, opacity: (guardando || cargandoGrado) ? 0.5 : 1 }}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  encabezado: { marginBottom: '18px' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0, fontFamily: 'inherit' },
  titulo: { fontSize: '20px', fontWeight: '800', color: '#1a1a2e', margin: '8px 0 4px' },
  subtitulo: { fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.5 },

  errorBox: { background: '#fff0f0', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px' },
  cargando: { textAlign: 'center', padding: '40px', color: '#888', fontSize: '15px' },
  textoGris: { color: '#888', fontSize: '14px' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  selectores: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', minWidth: '220px', background: '#fff' },
  contador: { fontSize: '12.5px', color: '#764ba2', fontWeight: '700' },

  areaBloque: { marginBottom: '16px' },
  areaEncabezado: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px 8px 0 0', background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', fontSize: '13px', fontWeight: '700' },
  areaCodigo: { background: 'rgba(255,255,255,0.25)', borderRadius: '6px', padding: '2px 7px', fontSize: '11.5px' },
  materiasGrid: { display: 'flex', flexDirection: 'column', border: '1px solid #f0e9f7', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' },
  materiaCheck: { display: 'flex', alignItems: 'center', padding: '9px 14px', fontSize: '13.5px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f5f0fa' },
  materiaCheckActivo: { background: '#f8f4fc' },
  materiaCodigo: { fontSize: '11.5px', color: '#764ba2', background: '#f0e9f7', borderRadius: '6px', padding: '2px 7px', fontWeight: '700', marginRight: '6px' },

  botones: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' },
  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
