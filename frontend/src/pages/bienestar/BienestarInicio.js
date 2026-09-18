import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import axiosAuth from '../../config/axios';
import { useAuth } from '../../context/AuthContext';
import {
  IconInbox, IconClipboard, IconCheckSquare, IconCalendar, IconUsers,
  IconAlertCircle, IconBarChart, IconBot, IconShield,
} from '../../components/Icons';

// Panel de inicio del orientador. En esta fase (base técnica) muestra el
// estado de acceso y las secciones que se irán habilitando por fases.
const SECCIONES = [
  { Icono: IconInbox,       titulo: 'Remisiones',   desc: 'Remisiones de docentes pendientes de revisión.', ruta: '/bienestar/remisiones' },
  { Icono: IconClipboard,   titulo: 'Casos',        desc: 'Casos abiertos, responsables y línea de tiempo.', ruta: '/bienestar/casos' },
  { Icono: IconCheckSquare, titulo: 'Seguimientos', desc: 'Sesiones, acuerdos y compromisos (dentro de cada caso).', ruta: '/bienestar/casos' },
  { Icono: IconCalendar,    titulo: 'Agenda',       desc: 'Citas con estudiantes, familias y docentes.' },
  { Icono: IconUsers,       titulo: 'Familias',     desc: 'Comunicaciones autorizadas con acudientes.' },
  { Icono: IconAlertCircle, titulo: 'Señales',      desc: 'Cambios registrados que conviene revisar.' },
  { Icono: IconBarChart,    titulo: 'Indicadores',  desc: 'Cifras agregadas del colegio.' },
  { Icono: IconBot,         titulo: 'Asistente IA', desc: 'Resúmenes y borradores, sin diagnósticos.' },
];

export default function BienestarInicio() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosAuth.get('/api/bienestar/estado')
      .then(r => {
        setEstado(r.data.data);
        if (r.data.data?.activo && r.data.data?.es_equipo) {
          axiosAuth.get('/api/bienestar/remisiones?estado=pendiente')
            .then(rr => setPendientes((rr.data.data || []).length))
            .catch(() => setPendientes(null));
        }
      })
      .catch(() => setError('No fue posible consultar el módulo. Intenta de nuevo más tarde.'));
  }, []);

  const primerNombre = usuario?.nombre?.split(' ')[0] || '';

  return (
    <div style={es.pagina}>
      <Navbar titulo="Bienestar y Orientación" />
      <div style={es.contenido}>
        <div style={es.encabezado}>
          <div>
            <h2 style={es.titulo}>Hola{primerNombre ? `, ${primerNombre}` : ''}</h2>
            <p style={es.subtitulo}>Panel de orientación escolar</p>
          </div>
          {estado?.nivel && (
            <span style={es.chipNivel}>{estado.nivel === 'lider' ? 'Orientador líder' : 'Orientador'}</span>
          )}
        </div>

        {error && <div style={es.aviso}>{error}</div>}

        {!error && !estado && <p style={es.textoGris}>Cargando...</p>}

        {estado && !estado.activo && (
          <div style={es.aviso}>
            <strong>El módulo todavía no está activo en tu colegio.</strong>
            <br />El administrador lo activa desde “Configuración de bienestar”.
          </div>
        )}

        {estado && estado.activo && !estado.es_equipo && (
          <div style={es.aviso}>
            <strong>Tu cuenta aún no hace parte del equipo de orientación.</strong>
            <br />Pide al administrador que te agregue desde “Configuración de bienestar”.
          </div>
        )}

        {estado?.activo && estado?.es_equipo && (
          <>
            <div style={es.recordatorio}>
              <IconShield size={18} style={{ flexShrink: 0, color: '#5a4fcf' }} />
              <span>
                La información de este módulo es confidencial y cada consulta queda registrada.
                Playfesor apoya la gestión de la orientación; no emite diagnósticos ni reemplaza el criterio profesional.
              </span>
            </div>

            <div style={es.grid}>
              {SECCIONES.map(({ Icono, titulo, desc, ruta }) => {
                const contenido = (
                  <>
                    <span style={es.cardIcono}><Icono size={20} /></span>
                    <div style={es.cardTitulo}>{titulo}</div>
                    <div style={es.cardDesc}>{desc}</div>
                    {ruta
                      ? (titulo === 'Remisiones' && pendientes > 0
                          ? <span style={es.chipPendientes}>{pendientes} pendiente{pendientes === 1 ? '' : 's'}</span>
                          : <span style={es.chipAbrir}>Abrir →</span>)
                      : <span style={es.chipPronto}>Próximamente</span>}
                  </>
                );
                return ruta ? (
                  <button key={titulo} onClick={() => navigate(ruta)} style={{ ...es.card, ...es.cardBoton }}>{contenido}</button>
                ) : (
                  <div key={titulo} style={{ ...es.card, opacity: 0.75 }}>{contenido}</div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5' },
  contenido: { padding: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' },
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' },
  titulo: { fontSize: '22px', fontWeight: 800, color: '#1a1a2e', margin: 0 },
  subtitulo: { fontSize: '13px', color: '#999', margin: '2px 0 0' },
  chipNivel: { background: '#e8eaf6', color: '#3949ab', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 },
  aviso: { background: '#fff8e1', border: '1px solid #ffe082', color: '#8a5a00', borderRadius: '12px', padding: '16px 18px', fontSize: '14px', lineHeight: 1.6 },
  recordatorio: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#f3f1ff', border: '1px solid #e0dcff', color: '#4a4380', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', lineHeight: 1.5, marginBottom: '18px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: '14px' },
  card: { background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' },
  cardIcono: { width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' },
  cardTitulo: { fontSize: '15px', fontWeight: 700, color: '#1a1a2e' },
  cardDesc: { fontSize: '12.5px', color: '#888', lineHeight: 1.5, flex: 1 },
  cardBoton: { border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  chipAbrir: { alignSelf: 'flex-start', color: '#667eea', fontSize: '12.5px', fontWeight: 700, marginTop: '4px' },
  chipPendientes: { alignSelf: 'flex-start', background: '#fff3e0', color: '#b45309', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, marginTop: '4px' },
  chipPronto: { alignSelf: 'flex-start', background: '#f0f2f5', color: '#999', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, marginTop: '4px' },
  textoGris: { color: '#888', fontSize: '14px' },
};
