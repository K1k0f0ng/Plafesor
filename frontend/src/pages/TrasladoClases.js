import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconInbox } from '../components/Icons';

export default function TrasladoClases() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [origenId, setOrigenId] = useState('');
  const [destinoIds, setDestinoIds] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [trasladando, setTrasladando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [rGrupos, rAsig] = await Promise.all([
        axiosAuth.get('/api/grupos'),
        axiosAuth.get('/api/materias/asignaciones'),
      ]);
      setGrupos(rGrupos.data.data.filter(g => g.activo));
      setAsignaciones(rAsig.data.data);
    } catch {
      setError('No se pudo cargar la información de grupos y clases.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const clasesOrigen = useMemo(
    () => asignaciones.filter(a => String(a.grupo_id) === String(origenId)),
    [asignaciones, origenId]
  );

  const gruposDestino = grupos.filter(g => String(g.id) !== String(origenId));

  function alternarDestino(id) {
    setDestinoIds(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function trasladar() {
    if (!origenId || destinoIds.size === 0) {
      return setError('Selecciona el grupo de origen y al menos un grupo de destino');
    }
    setTrasladando(true);
    setError('');
    setResultado(null);
    try {
      const resp = await axiosAuth.put('/api/docentes/clases/trasladar-masivo', {
        grupo_origen_id: origenId,
        grupo_destino_ids: Array.from(destinoIds),
      });
      setResultado(resp.data.data);
      setDestinoIds(new Set());
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al trasladar las clases');
    } finally {
      setTrasladando(false);
    }
  }

  return (
    <div style={es.pagina}>
      <Navbar titulo="Traslado Masivo de Clases Abiertas" />
      <div style={es.contenido}>

        <div style={es.encabezado}>
          <button onClick={() => navigate(usuario.rol === 'admin' ? '/dashboard' : '/dashboard-director')} style={es.btnVolver}>
            ← Volver al panel
          </button>
          <h2 style={es.titulo}>Traslado Masivo de Clases Abiertas</h2>
          <p style={es.subtitulo}>
            Copia todas las clases abiertas (asignatura, docente y horas) de un grupo a uno o varios grupos
            paralelos, sin definirlas una por una. Útil cuando varios grupos del mismo grado comparten la misma
            carga académica (ej: copiar de 6°-1 a 6°-2 y 6°-3).
          </p>
        </div>

        {error && <div style={es.errorBox}>{error}</div>}
        {resultado && (
          <div style={es.exito}>
            {resultado.map(r => (
              <div key={r.grupo_destino_id}>
                {r.nombre ? (
                  <>→ <strong>{r.nombre}</strong>: {r.insertadas} clase(s) copiada(s){r.omitidas ? `, ${r.omitidas} omitida(s)` : ''}</>
                ) : (
                  <>→ Grupo no encontrado</>
                )}
              </div>
            ))}
          </div>
        )}

        {cargando ? (
          <div style={es.cargando}>Cargando...</div>
        ) : (
          <div style={es.card}>
            <div style={es.campo}>
              <label style={es.label}>Grupo de origen</label>
              <select
                style={es.select}
                value={origenId}
                onChange={e => { setOrigenId(e.target.value); setDestinoIds(new Set()); setResultado(null); }}
              >
                <option value="">— Selecciona —</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.grado}° {g.nombre}</option>)}
              </select>
            </div>

            {!origenId ? (
              <p style={es.textoGris}>Selecciona un grupo de origen para ver sus clases abiertas.</p>
            ) : clasesOrigen.length === 0 ? (
              <div style={es.sinDatos}>
                <IconInbox size={36} style={{ color: '#ccc' }} />
                <p>Este grupo no tiene clases abiertas todavía.</p>
              </div>
            ) : (
              <>
                <table style={es.tabla}>
                  <thead>
                    <tr>
                      <th style={es.th}>Asignatura</th>
                      <th style={es.th}>Docente</th>
                      <th style={{ ...es.th, textAlign: 'center' }}>Horas/semana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clasesOrigen.map(c => (
                      <tr key={c.id} style={es.tr}>
                        <td style={es.td}>{c.nombre_materia}</td>
                        <td style={es.td}>{c.nombre_docente}</td>
                        <td style={{ ...es.td, textAlign: 'center' }}>{c.intensidad_horaria_semanal || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ ...es.campo, marginTop: '20px' }}>
                  <label style={es.label}>Grupos de destino</label>
                  <div style={es.destinosGrid}>
                    {gruposDestino.map(g => (
                      <label key={g.id} style={{ ...es.destinoCheck, ...(destinoIds.has(g.id) ? es.destinoCheckActivo : {}) }}>
                        <input
                          type="checkbox"
                          checked={destinoIds.has(g.id)}
                          onChange={() => alternarDestino(g.id)}
                          style={{ marginRight: '8px' }}
                        />
                        {g.grado}° {g.nombre}
                      </label>
                    ))}
                    {gruposDestino.length === 0 && <p style={es.textoGris}>No hay otros grupos disponibles como destino.</p>}
                  </div>
                </div>

                <div style={es.botones}>
                  <button
                    onClick={trasladar}
                    disabled={trasladando || destinoIds.size === 0}
                    style={{ ...es.btnPrimario, opacity: (trasladando || destinoIds.size === 0) ? 0.5 : 1 }}
                  >
                    {trasladando ? 'Trasladando...' : `Trasladar a ${destinoIds.size} grupo(s)`}
                  </button>
                </div>
              </>
            )}
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
  exito: { background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.8 },
  cargando: { textAlign: 'center', padding: '40px', color: '#888', fontSize: '15px' },
  textoGris: { color: '#888', fontSize: '14px', textAlign: 'center', padding: '20px 0' },
  sinDatos: { textAlign: 'center', padding: '32px', color: '#888' },

  card: { background: '#fff', borderRadius: '16px', padding: '22px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' },
  label: { fontSize: '12.5px', fontWeight: '600', color: '#666' },
  select: { padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', background: '#fff', maxWidth: '320px' },

  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: '11.5px', fontWeight: '700', color: '#fff', background: 'linear-gradient(135deg, #a084c9, #764ba2)', textAlign: 'left' },
  tr: { borderBottom: '1px solid #f0e9f7' },
  td: { padding: '9px 12px', fontSize: '13.5px', color: '#374151' },

  destinosGrid: { display: 'flex', flexDirection: 'column', border: '1px solid #f0e9f7', borderRadius: '8px', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' },
  destinoCheck: { display: 'flex', alignItems: 'center', padding: '9px 14px', fontSize: '13.5px', color: '#374151', cursor: 'pointer', borderBottom: '1px solid #f5f0fa' },
  destinoCheckActivo: { background: '#f8f4fc' },

  botones: { display: 'flex', justifyContent: 'flex-end', marginTop: '18px' },
  btnPrimario: { background: 'linear-gradient(135deg, #a084c9, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};
