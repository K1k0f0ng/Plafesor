import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

// Orden fijo de niveles, igual al de la plataforma de referencia
const ORDEN_NIVELES = ['prejardin', 'jardin', 'transicion', 'primaria', 'secundaria', 'media'];
const NIVEL_LABEL = {
  prejardin: 'Prejardín', jardin: 'Jardín', transicion: 'Transición',
  primaria: 'Básica Primaria', secundaria: 'Básica Secundaria', media: 'Educación Media',
};

export default function GradosAcademicos() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nivel, setNivel] = useState('');
  const [programa, setPrograma] = useState('');
  const [cambios, setCambios] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Solo al entrar a la pantalla: trae el catálogo y elige el primer
  // nivel/programa disponible como punto de partida.
  const cargarInicial = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await axiosAuth.get('/api/grados-academicos');
      const data = resp.data.data;
      setGrados(data);
      const primerNivel = ORDEN_NIVELES.find(n => data.some(g => g.nivel === n)) || '';
      setNivel(primerNivel);
      const primerPrograma = data.find(g => g.nivel === primerNivel)?.programa || '';
      setPrograma(primerPrograma);
    } catch {
      setError('No se pudo cargar el catálogo de grados académicos.');
    } finally {
      setCargando(false);
    }
  }, []);

  // Después de guardar: solo refresca los datos, sin mover al director del
  // nivel/programa que estaba viendo (antes lo devolvía siempre a Prejardín).
  const refrescar = useCallback(async () => {
    const resp = await axiosAuth.get('/api/grados-academicos');
    setGrados(resp.data.data);
  }, []);

  useEffect(() => { cargarInicial(); }, [cargarInicial]);

  const nivelesDisponibles = useMemo(
    () => ORDEN_NIVELES.filter(n => grados.some(g => g.nivel === n)),
    [grados]
  );

  const programasDelNivel = useMemo(
    () => [...new Set(grados.filter(g => g.nivel === nivel).map(g => g.programa))],
    [grados, nivel]
  );

  const gradosVisibles = useMemo(
    () => grados
      .filter(g => g.nivel === nivel && g.programa === programa)
      .sort((a, b) => a.orden - b.orden),
    [grados, nivel, programa]
  );

  function cambiarNivel(nuevoNivel) {
    setNivel(nuevoNivel);
    const primerPrograma = grados.find(g => g.nivel === nuevoNivel)?.programa || '';
    setPrograma(primerPrograma);
    setCambios({});
    setMensaje('');
  }

  function editarCampo(id, campo, valor) {
    setCambios(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }

  function valorActual(g, campo) {
    return cambios[g.id]?.[campo] ?? g[campo] ?? '';
  }

  function cancelar() {
    setCambios({});
    setMensaje('');
  }

  async function actualizar() {
    const idsConCambios = Object.keys(cambios);
    if (idsConCambios.length === 0) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      for (const id of idsConCambios) {
        const g = grados.find(x => x.id === parseInt(id));
        const payload = {
          nombre: valorActual(g, 'nombre'),
          intensidad_horaria: valorActual(g, 'intensidad_horaria') || null,
          max_tareas: valorActual(g, 'max_tareas') || null,
          max_evaluaciones: valorActual(g, 'max_evaluaciones') || null,
        };
        await axiosAuth.put(`/api/grados-academicos/${id}`, payload);
      }
      await refrescar();
      setCambios({});
      setMensaje('Grados académicos actualizados correctamente.');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar los grados académicos');
    } finally {
      setGuardando(false);
    }
  }

  const hayCambios = Object.keys(cambios).length > 0;

  return (
    <div style={es.pagina}>
      <Navbar titulo="Grados académicos" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Grados académicos</h2>
          <p style={es.subtitulo}>
            Personaliza el nombre, la intensidad horaria y los máximos de tareas y evaluaciones de cada grado que ofrece tu colegio.
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {mensaje && <div style={es.exito}>{mensaje}</div>}

        {cargando ? (
          <div style={es.cargando}>Cargando grados académicos...</div>
        ) : (
          <div style={es.card}>
            <p style={es.instruccion}>Seleccione un nivel y programa académico de la lista</p>

            <div style={es.selectores}>
              <select style={es.select} value={nivel} onChange={e => cambiarNivel(e.target.value)}>
                {nivelesDisponibles.map(n => (
                  <option key={n} value={n}>{NIVEL_LABEL[n] || n}</option>
                ))}
              </select>
              <select style={es.select} value={programa} onChange={e => { setPrograma(e.target.value); setCambios({}); setMensaje(''); }}>
                {programasDelNivel.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={es.tablaScroll}>
              <table style={es.tabla}>
                <thead>
                  <tr>
                    <th style={es.th}>Grado</th>
                    <th style={es.th}>Nombre</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Intensidad horaria</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Máximo de tareas</th>
                    <th style={{ ...es.th, textAlign: 'center' }}>Máximo de evaluaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gradosVisibles.map((g, i) => (
                    <tr key={g.id} style={es.tr}>
                      <td style={{ ...es.td, fontWeight: '700', color: '#764ba2', whiteSpace: 'nowrap' }}>Grado {i + 1}</td>
                      <td style={es.td}>
                        <input
                          style={es.input}
                          value={valorActual(g, 'nombre')}
                          onChange={e => editarCampo(g.id, 'nombre', e.target.value)}
                        />
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <input
                          style={{ ...es.input, ...es.inputCorto }}
                          type="number"
                          value={valorActual(g, 'intensidad_horaria')}
                          onChange={e => editarCampo(g.id, 'intensidad_horaria', e.target.value)}
                        />
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <input
                          style={{ ...es.input, ...es.inputCorto }}
                          type="number"
                          value={valorActual(g, 'max_tareas')}
                          onChange={e => editarCampo(g.id, 'max_tareas', e.target.value)}
                        />
                      </td>
                      <td style={{ ...es.td, textAlign: 'center' }}>
                        <input
                          style={{ ...es.input, ...es.inputCorto }}
                          type="number"
                          value={valorActual(g, 'max_evaluaciones')}
                          onChange={e => editarCampo(g.id, 'max_evaluaciones', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  {gradosVisibles.length === 0 && (
                    <tr><td colSpan={5} style={{ ...es.td, textAlign: 'center', color: '#999' }}>No hay grados en este nivel y programa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={es.botones}>
              <button onClick={actualizar} disabled={!hayCambios || guardando} style={{ ...es.btnPrimario, opacity: (!hayCambios || guardando) ? 0.5 : 1 }}>
                {guardando ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button onClick={cancelar} disabled={!hayCambios} style={{ ...es.btnCancelar, opacity: !hayCambios ? 0.5 : 1 }}>
                Cancelar
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
  cargando: { textAlign: 'center', padding: '60px', color: '#888', fontSize: '15px' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  instruccion: { textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#764ba2', margin: '0 0 14px' },
  selectores: { display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', minWidth: '200px', background: '#fff' },

  tablaScroll: { overflowX: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '640px' },
  th: { padding: '10px 12px', fontSize: '11.5px', fontWeight: '700', color: '#fff', background: 'linear-gradient(135deg, #a084c9, #764ba2)', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f0e9f7' },
  td: { padding: '10px 12px', fontSize: '13px', color: '#374151' },
  input: { width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1.5px solid #e0d5ee', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  inputCorto: { width: '80px', textAlign: 'center', margin: '0 auto' },

  botones: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' },
  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnCancelar: { background: '#f0f2f5', color: '#666', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
};
