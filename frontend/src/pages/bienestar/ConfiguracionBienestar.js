import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';

// Configuración del módulo Bienestar y Orientación (solo admin).
// El admin configura y activa el módulo, pero nunca ve casos ni notas.

const OPCIONES = [
  { clave: 'devolucion_docente', titulo: 'Devolución al docente',
    desc: 'Orientación puede enviar al docente que remitió una nota breve y no confidencial (por ejemplo, una sugerencia para el aula).' },
  { clave: 'lider_lee_privadas', titulo: 'El orientador líder puede leer notas privadas de otros',
    desc: 'Útil si el líder supervisa al equipo. Si está apagado, cada nota privada solo la leen su autor y los orientadores asignados al caso.' },
  { clave: 'portal_familia', titulo: 'Portal de familia para orientación',
    desc: 'Los acudientes ven en su portal las citas y compromisos que el orientador marque como “visible para la familia”. Nada más.' },
  { clave: 'adjuntos_remision', titulo: 'Adjuntos en remisiones',
    desc: 'Permite que el docente adjunte evidencias (documentos o imágenes) al remitir.' },
  { clave: 'ia_activa', titulo: 'Asistente IA de orientación',
    desc: 'Resúmenes y borradores con datos sin nombres. Nunca diagnostica; todo texto es un borrador que el orientador revisa.' },
];

const TIPOS_CATALOGO = [
  { tipo: 'motivo_remision',  nombre: 'Motivos de remisión' },
  { tipo: 'tipo_seguimiento', nombre: 'Tipos de seguimiento' },
  { tipo: 'tipo_cita',        nombre: 'Tipos de cita' },
  { tipo: 'tipo_contacto',    nombre: 'Tipos de contacto con familia' },
  { tipo: 'motivo_cierre',    nombre: 'Motivos de cierre' },
];

const ACCIONES_BITACORA = {
  modulo_activado: 'Activó el módulo', modulo_desactivado: 'Desactivó el módulo',
  configuracion_editada: 'Editó la configuración', equipo_editado: 'Editó el equipo',
  catalogo_creado: 'Agregó una opción de catálogo', catalogo_editado: 'Editó una opción de catálogo',
  acceso_denegado: 'Intento de acceso denegado', bitacora_ver: 'Consultó la bitácora',
};

function formatearFecha(f) {
  try { return new Date(f).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return f; }
}

export default function ConfiguracionBienestar() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [config, setConfig] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [catalogos, setCatalogos] = useState([]);
  const [tipoCatalogo, setTipoCatalogo] = useState('motivo_remision');
  const [nuevaOpcion, setNuevaOpcion] = useState('');
  const [bitacora, setBitacora] = useState(null);
  const [guardando, setGuardando] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const avisar = (texto) => { setMensaje(texto); setError(''); setTimeout(() => setMensaje(''), 3500); };
  const fallar = (err, texto) => { setError(err?.response?.data?.error || texto); setMensaje(''); };

  const cargar = useCallback(async () => {
    try {
      const r = await axiosAuth.get('/api/bienestar/configuracion');
      setDatos(r.data.data);
      setConfig(r.data.data.configuracion);
      setEquipo(r.data.data.orientadores.map(o => ({ ...o, nivel: o.nivel || 'profesional' })));
    } catch (err) {
      fallar(err, 'No se pudo cargar la configuración');
    }
  }, []);

  const cargarCatalogos = useCallback(async () => {
    try {
      const r = await axiosAuth.get('/api/bienestar/catalogos');
      setCatalogos(r.data.data || []);
    } catch { setCatalogos([]); }
  }, []);

  useEffect(() => { cargar(); cargarCatalogos(); }, [cargar, cargarCatalogos]);

  async function guardarConfig(cambios) {
    const nueva = { ...config, ...cambios };
    setGuardando('config');
    try {
      await axiosAuth.put('/api/bienestar/configuracion', nueva);
      setConfig(nueva);
      avisar('Configuración guardada');
      cargarCatalogos(); // la primera vez se crean los catálogos iniciales
    } catch (err) {
      fallar(err, 'No se pudo guardar la configuración');
    } finally {
      setGuardando('');
    }
  }

  async function guardarEquipo() {
    setGuardando('equipo');
    try {
      await axiosAuth.put('/api/bienestar/equipo', {
        miembros: equipo.map(o => ({ usuario_id: o.id, en_equipo: o.en_equipo, nivel: o.nivel })),
      });
      avisar('Equipo de orientación actualizado');
      cargar();
    } catch (err) {
      fallar(err, 'No se pudo guardar el equipo');
    } finally {
      setGuardando('');
    }
  }

  async function agregarOpcion(e) {
    e.preventDefault();
    if (!nuevaOpcion.trim()) return;
    try {
      await axiosAuth.post('/api/bienestar/catalogos', { tipo: tipoCatalogo, nombre: nuevaOpcion.trim() });
      setNuevaOpcion('');
      cargarCatalogos();
    } catch (err) {
      fallar(err, 'No se pudo agregar la opción');
    }
  }

  async function alternarOpcion(op) {
    try {
      await axiosAuth.patch(`/api/bienestar/catalogos/${op.id}`, { activo: !op.activo });
      cargarCatalogos();
    } catch (err) {
      fallar(err, 'No se pudo actualizar la opción');
    }
  }

  async function verBitacora() {
    try {
      const r = await axiosAuth.get('/api/bienestar/auditoria');
      setBitacora(r.data.data || []);
    } catch (err) {
      fallar(err, 'No se pudo cargar la bitácora');
    }
  }

  if (!config) {
    return (
      <div style={es.pagina}>
        <Navbar titulo="Configuración de bienestar" />
        <div style={es.contenido}>
          {error ? <div style={es.errorBox}>{error}</div> : <p style={es.textoGris}>Cargando...</p>}
        </div>
      </div>
    );
  }

  const hayLider = equipo.some(o => o.en_equipo && o.nivel === 'lider') || equipo.filter(o => o.en_equipo).length === 1;
  const opcionesTipo = catalogos.filter(c => c.tipo === tipoCatalogo);

  return (
    <div style={es.pagina}>
      <Navbar titulo="Configuración de bienestar" />
      <div style={es.contenido}>
        <button onClick={() => navigate('/dashboard')} style={es.btnVolver}>← Volver al panel</button>

        {mensaje && <div style={es.exito}>{mensaje}</div>}
        {error && <div style={es.errorBox}>{error}</div>}

        {/* Estado del módulo */}
        <div style={es.card}>
          <div style={es.filaTitulo}>
            <div>
              <h3 style={es.cardTitulo}>Módulo Bienestar y Orientación</h3>
              <p style={es.ayuda}>Remisiones, casos, seguimientos y planes de acompañamiento. Como administrador lo configuras, pero no ves la información de los casos.</p>
            </div>
            <span style={{ ...es.chip, ...(config.activo ? es.chipOn : es.chipOff) }}>{config.activo ? 'Activo' : 'Apagado'}</span>
          </div>

          {!datos.clave_configurada && (
            <div style={es.alerta}>
              Falta la <strong>clave de cifrado</strong> en el servidor. Sin ella el módulo no se puede activar,
              porque no habría cómo proteger la información sensible.
            </div>
          )}
          {datos.clave_configurada && !config.activo && !hayLider && (
            <div style={es.alerta}>Para activarlo, primero agrega al menos un orientador <strong>líder</strong> al equipo (abajo).</div>
          )}

          <button
            onClick={() => guardarConfig({ activo: !config.activo })}
            disabled={guardando === 'config' || (!config.activo && (!datos.clave_configurada || !hayLider))}
            style={{ ...(config.activo ? es.btnSecundario : es.btnPrimario), marginTop: '12px', opacity: (!config.activo && (!datos.clave_configurada || !hayLider)) ? 0.5 : 1 }}
          >
            {config.activo ? 'Apagar el módulo' : 'Activar el módulo'}
          </button>
        </div>

        {/* Equipo */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Equipo de orientación</h3>
          <p style={es.ayuda}>
            Solo aparecen las cuentas con rol <strong>Orientador / Psicólogo</strong>, que se crean en “Usuarios del Sistema”.
            El <strong>líder</strong> ve todos los casos del colegio; el <strong>profesional</strong> solo los que tiene asignados.
          </p>

          {equipo.length === 0 ? (
            <div style={es.vacio}>
              Aún no hay cuentas de orientador.{' '}
              <button onClick={() => navigate('/personal')} style={es.enlace}>Crear una en Usuarios del Sistema</button>
            </div>
          ) : (
            <>
              <div style={es.lista}>
                {equipo.map(o => (
                  <div key={o.id} style={es.filaMiembro}>
                    <label style={es.checkLabel}>
                      <input
                        type="checkbox" checked={o.en_equipo}
                        onChange={e => setEquipo(prev => prev.map(x => x.id === o.id ? { ...x, en_equipo: e.target.checked } : x))}
                      />
                      <span>
                        <strong style={{ color: '#333' }}>{o.nombre}</strong>
                        <span style={es.email}>{o.email}{!o.cuenta_activa ? ' · cuenta inactiva' : ''}</span>
                      </span>
                    </label>
                    <select
                      style={es.select} value={o.nivel} disabled={!o.en_equipo}
                      onChange={e => setEquipo(prev => prev.map(x => x.id === o.id ? { ...x, nivel: e.target.value } : x))}
                    >
                      <option value="lider">Líder</option>
                      <option value="profesional">Profesional</option>
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={guardarEquipo} disabled={guardando === 'equipo'} style={{ ...es.btnPrimario, marginTop: '14px' }}>
                {guardando === 'equipo' ? 'Guardando...' : 'Guardar equipo'}
              </button>
            </>
          )}
        </div>

        {/* Opciones */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Opciones y privacidad</h3>
          <p style={es.ayuda}>Todas empiezan apagadas. Enciende solo lo que el colegio necesite.</p>

          <div style={es.opcion}>
            <div style={{ flex: 1 }}>
              <div style={es.opcionTitulo}>¿Quién puede remitir a orientación?</div>
              <div style={es.opcionDesc}>El director siempre puede remitir.</div>
            </div>
            <select
              style={es.select} value={config.remiten} disabled={guardando === 'config'}
              onChange={e => guardarConfig({ remiten: e.target.value })}
            >
              <option value="todos">Todos los docentes</option>
              <option value="directores_grupo">Solo directores de grupo</option>
            </select>
          </div>

          {OPCIONES.map(op => (
            <div key={op.clave} style={es.opcion}>
              <div style={{ flex: 1 }}>
                <div style={es.opcionTitulo}>{op.titulo}</div>
                <div style={es.opcionDesc}>{op.desc}</div>
              </div>
              <button
                role="switch" aria-checked={config[op.clave]} aria-label={op.titulo}
                disabled={guardando === 'config'}
                onClick={() => guardarConfig({ [op.clave]: !config[op.clave] })}
                style={{ ...es.switch, background: config[op.clave] ? '#667eea' : '#d5d8e0' }}
              >
                <span style={{ ...es.switchBola, transform: config[op.clave] ? 'translateX(20px)' : 'none' }} />
              </button>
            </div>
          ))}
        </div>

        {/* Catálogos */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Catálogos</h3>
          <p style={es.ayuda}>
            Las opciones que verán docentes y orientadores en los formularios. Describe situaciones observables,
            nunca condiciones clínicas. Las opciones no se borran: se desactivan.
          </p>

          {catalogos.length === 0 ? (
            <div style={es.vacio}>Los catálogos iniciales se crean la primera vez que guardes cualquier opción de arriba.</div>
          ) : (
            <>
              <div style={es.tabs}>
                {TIPOS_CATALOGO.map(t => (
                  <button key={t.tipo} onClick={() => setTipoCatalogo(t.tipo)}
                    style={{ ...es.tab, ...(tipoCatalogo === t.tipo ? es.tabActiva : {}) }}>
                    {t.nombre}
                  </button>
                ))}
              </div>
              <div style={es.lista}>
                {opcionesTipo.map(op => (
                  <div key={op.id} style={es.filaMiembro}>
                    <span style={{ color: op.activo ? '#333' : '#aaa', textDecoration: op.activo ? 'none' : 'line-through', fontSize: '14px' }}>{op.nombre}</span>
                    <button onClick={() => alternarOpcion(op)} style={es.btnMini}>{op.activo ? 'Desactivar' : 'Activar'}</button>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarOpcion} style={es.formLinea}>
                <input style={es.input} value={nuevaOpcion} maxLength={120}
                  onChange={e => setNuevaOpcion(e.target.value)} placeholder="Nueva opción" />
                <button type="submit" style={es.btnPrimario}>Agregar</button>
              </form>
            </>
          )}
        </div>

        {/* Bitácora */}
        <div style={es.card}>
          <h3 style={es.cardTitulo}>Bitácora del módulo</h3>
          <p style={es.ayuda}>Quién hizo qué y cuándo. Nunca muestra el contenido de los casos.</p>
          {bitacora === null ? (
            <button onClick={verBitacora} style={es.btnSecundario}>Ver últimos movimientos</button>
          ) : bitacora.length === 0 ? (
            <div style={es.vacio}>Sin movimientos registrados.</div>
          ) : (
            <table style={es.tabla}>
              <thead>
                <tr>{['Fecha', 'Usuario', 'Acción', 'IP'].map(h => <th key={h} style={es.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {bitacora.map(b => (
                  <tr key={b.id}>
                    <td style={es.td}>{formatearFecha(b.creado_en)}</td>
                    <td style={es.td}>{b.usuario_nombre || '—'}<span style={es.email}>{b.usuario_rol}</span></td>
                    <td style={es.td}>{ACCIONES_BITACORA[b.accion] || b.accion}</td>
                    <td style={{ ...es.td, color: '#999' }}>{b.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '860px', margin: '0 auto', width: '100%' },
  btnVolver: { background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginBottom: '20px', padding: 0, fontFamily: 'inherit' },
  card: { background: '#fff', borderRadius: '16px', padding: '22px', marginBottom: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  filaTitulo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  cardTitulo: { fontSize: '17px', fontWeight: 700, color: '#333', margin: '0 0 6px' },
  ayuda: { fontSize: '13px', color: '#888', margin: '0 0 12px', lineHeight: 1.5 },
  chip: { borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  chipOn: { background: '#e8f5e9', color: '#2e7d32' },
  chipOff: { background: '#f0f2f5', color: '#888' },
  alerta: { background: '#fff8e1', border: '1px solid #ffe082', color: '#8a5a00', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.5, marginTop: '8px' },
  vacio: { background: '#fafbff', border: '1px dashed #dde0f0', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#888' },
  enlace: { background: 'none', border: 'none', color: '#667eea', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: '13px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  filaMiembro: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: '1px solid #eee', borderRadius: '10px', flexWrap: 'wrap' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', minWidth: 0 },
  email: { display: 'block', fontSize: '12px', color: '#999' },
  select: { padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', background: '#fff' },
  opcion: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderTop: '1px solid #f2f2f5' },
  opcionTitulo: { fontSize: '14px', fontWeight: 700, color: '#333' },
  opcionDesc: { fontSize: '12.5px', color: '#888', marginTop: '2px', lineHeight: 1.5 },
  switch: { position: 'relative', width: '46px', height: '26px', borderRadius: '999px', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'background 0.15s' },
  switchBola: { position: 'absolute', top: '3px', left: '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.15s' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
  tab: { background: '#f0f2f5', border: 'none', borderRadius: '999px', padding: '6px 12px', fontSize: '12.5px', fontWeight: 600, color: '#666', cursor: 'pointer', fontFamily: 'inherit' },
  tabActiva: { background: '#667eea', color: '#fff' },
  btnMini: { background: '#fff', border: '1px solid #dde0f0', color: '#667eea', borderRadius: '8px', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  formLinea: { display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: '180px', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '14px', fontFamily: 'inherit', outline: 'none' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: '12px', fontWeight: 700, color: '#888', borderBottom: '2px solid #f0f0f0' },
  td: { padding: '10px', fontSize: '13px', color: '#333', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  exito: { background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  errorBox: { background: '#fff0f0', color: '#c62828', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' },
  textoGris: { color: '#888', fontSize: '14px' },
};
