import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBot, IconZap } from '../components/Icons';

const SUGERENCIAS = [
  '¿Cuál es el resumen académico del colegio?',
  '¿Qué grupo tiene el menor promedio?',
  '¿Cuáles son los estudiantes más en riesgo?',
  '¿Qué materia está más crítica?',
  '¿Cómo está la asistencia este mes?',
  '¿Qué acciones recomiendas tomar urgentemente?',
];

function Burbuja({ mensaje }) {
  const esUsuario = mensaje.rol === 'usuario';
  return (
    <div style={{
      display: 'flex',
      justifyContent: esUsuario ? 'flex-end' : 'flex-start',
      alignItems: 'flex-end',
      gap: '8px',
      marginBottom: '16px',
    }}>
      {!esUsuario && <div style={es.avatar}><IconBot size={16} style={{ color: '#fff' }} /></div>}
      <div style={{
        ...es.burbuja,
        ...(esUsuario ? es.burbujaUsuario : es.burbujaBot),
        ...(mensaje.error ? es.burbujaError : {}),
      }}>
        {mensaje.texto}
      </div>
    </div>
  );
}

export default function CoPiloto() {
  const { usuario }  = useAuth();
  const navigate     = useNavigate();
  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);

  const [mensajes, setMensajes] = useState([{
    rol: 'asistente',
    texto: '¡Hola! Soy tu Copiloto Académico. Tengo acceso a los datos reales de tu colegio en tiempo real.\n\nPuedes preguntarme sobre promedios, grupos en riesgo, asistencia, alertas académicas, o pedirme recomendaciones concretas. ¿En qué te ayudo hoy?',
  }]);
  const [pregunta,  setPregunta]  = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [puntos,    setPuntos]    = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (!cargando) { setPuntos(''); return; }
    const id = setInterval(() => setPuntos(p => p.length >= 3 ? '' : p + '.'), 500);
    return () => clearInterval(id);
  }, [cargando]);

  const enviar = useCallback(async (texto) => {
    const q = (texto || pregunta).trim();
    if (!q || cargando) return;
    setPregunta('');
    setMensajes(prev => [...prev, { rol: 'usuario', texto: q }]);
    setCargando(true);
    try {
      const resp = await axiosAuth.post(`/api/copiloto/colegio/${usuario.colegio_id}`, { pregunta: q });
      setMensajes(prev => [...prev, { rol: 'asistente', texto: resp.data.data.respuesta }]);
    } catch {
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        texto: 'Hubo un error al consultar el copiloto. Verifica tu conexión e intenta de nuevo.',
        error: true,
      }]);
    } finally {
      setCargando(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [pregunta, cargando, usuario.colegio_id]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <div style={es.pagina}>
      <Navbar titulo="Copiloto de Rectoría" />
      <div style={es.layout}>

        {/* Sidebar */}
        <div style={es.sidebar}>
          <button onClick={() => navigate('/dashboard-director')} style={es.btnVolver}>← Volver</button>

          <p style={es.sidebarTitulo}>Preguntas frecuentes</p>
          <div style={es.sugerenciasLista}>
            {SUGERENCIAS.map((s, i) => (
              <button
                key={i}
                onClick={() => enviar(s)}
                disabled={cargando}
                style={es.btnSugerencia}
              >
                {s}
              </button>
            ))}
          </div>

          <div style={es.infoBadge}>
            <IconZap size={20} style={{ color: '#667eea' }} />
            <div>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: '#555' }}>Datos en tiempo real</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#999', lineHeight: '1.4' }}>
                El copiloto consulta tu base de datos antes de cada respuesta
              </p>
            </div>
          </div>
        </div>

        {/* Área de chat */}
        <div style={es.chatWrap}>
          <div style={es.mensajesArea}>
            {mensajes.map((m, i) => <Burbuja key={i} mensaje={m} />)}

            {cargando && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                <div style={es.avatar}><IconBot size={16} style={{ color: '#fff' }} /></div>
                <div style={{ ...es.burbuja, ...es.burbujaBot, color: '#bbb', fontStyle: 'italic' }}>
                  Analizando datos{puntos}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={es.inputWrap}>
            <textarea
              ref={textareaRef}
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu pregunta... (Enter para enviar, Shift+Enter para nueva línea)"
              disabled={cargando}
              rows={2}
              style={es.textarea}
            />
            <button
              onClick={() => enviar()}
              disabled={cargando || !pregunta.trim()}
              style={{
                ...es.btnEnviar,
                opacity: (cargando || !pregunta.trim()) ? 0.5 : 1,
                cursor: (cargando || !pregunta.trim()) ? 'not-allowed' : 'pointer',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const es = {
  pagina: { minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column' },
  layout: {
    display: 'flex', flex: 1, maxWidth: '1200px', width: '100%',
    margin: '0 auto', padding: '24px', gap: '20px', alignItems: 'flex-start',
  },
  sidebar: {
    width: '240px', flexShrink: 0, background: '#fff', borderRadius: '16px',
    padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', position: 'sticky', top: '24px',
  },
  btnVolver: {
    background: 'none', border: 'none', color: '#667eea', cursor: 'pointer',
    fontSize: '13px', fontWeight: '700', padding: '0 0 16px', fontFamily: 'inherit', display: 'block',
  },
  sidebarTitulo: { fontSize: '11px', fontWeight: '700', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' },
  sugerenciasLista: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' },
  btnSugerencia: {
    background: '#f7f8ff', border: '1px solid #e8eaf6', borderRadius: '10px',
    padding: '9px 12px', fontSize: '12px', color: '#555', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'inherit', lineHeight: '1.4',
    transition: 'background 0.15s',
  },
  infoBadge: {
    display: 'flex', gap: '10px', alignItems: 'flex-start',
    background: '#f7f8ff', borderRadius: '12px', padding: '12px',
  },
  chatWrap: {
    flex: 1, background: '#fff', borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex',
    flexDirection: 'column', overflow: 'hidden', minHeight: '600px',
  },
  mensajesArea: {
    flex: 1, overflowY: 'auto', padding: '24px', display: 'flex',
    flexDirection: 'column',
  },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', flexShrink: 0,
  },
  burbuja: {
    maxWidth: '72%', padding: '12px 16px', borderRadius: '18px',
    fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
  },
  burbujaUsuario: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', borderBottomRightRadius: '4px',
  },
  burbujaBot: {
    background: '#f4f6fb', color: '#333',
    border: '1px solid #e8eaf6', borderBottomLeftRadius: '4px',
  },
  burbujaError: { background: '#fff0f0', color: '#c62828', border: '1px solid #ffcdd2' },
  inputWrap: {
    display: 'flex', gap: '10px', padding: '16px 20px',
    borderTop: '1px solid #f0f0f0', background: '#fafafa',
  },
  textarea: {
    flex: 1, borderRadius: '12px', border: '2px solid #e8eaf6',
    padding: '10px 14px', fontSize: '14px', fontFamily: 'inherit',
    resize: 'none', outline: 'none', lineHeight: '1.5',
    background: '#fff',
  },
  btnEnviar: {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', fontSize: '18px',
    fontFamily: 'inherit', alignSelf: 'flex-end',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
