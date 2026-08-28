import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { IconBot } from '../components/Icons';

const SUGERENCIAS = [
  '¿Puedes explicarme las fracciones?',
  '¿Qué es la fotosíntesis?',
  '¿Cómo se resuelve una ecuación?',
  '¿Qué fue la Independencia de Colombia?',
  '¿Cómo puedo mejorar mi nota?',
  '¿Puedes ayudarme a entender un tema?',
];

export default function TutorIA() {
  const { usuario } = useAuth();
  const navigate    = useNavigate();
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  const [historial, setHistorial]     = useState([]);
  const [mensajes,  setMensajes]      = useState([{
    rol: 'tutor',
    texto: `¡Hola, ${usuario.nombre}! Soy tu Tutor IA.\n\nEstoy aquí para ayudarte a entender cualquier tema de tus materias. No te voy a dar las respuestas directas — te voy a guiar para que las descubras tú mismo.\n\n¿Sobre qué quieres aprender hoy?`,
  }]);
  const [pregunta,   setPregunta]     = useState('');
  const [cargando,   setCargando]     = useState(false);
  const [puntos,     setPuntos]       = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (!cargando) { setPuntos(''); return; }
    const id = setInterval(() => setPuntos(p => p.length >= 3 ? '' : p + '.'), 450);
    return () => clearInterval(id);
  }, [cargando]);

  const enviar = useCallback(async (texto) => {
    const q = (texto || pregunta).trim();
    if (!q || cargando) return;
    setPregunta('');

    const nuevaMensaje = { rol: 'estudiante', texto: q };
    const nuevoHistorial = [...historial, nuevaMensaje];

    setMensajes(prev => [...prev, nuevaMensaje]);
    setHistorial(nuevoHistorial);
    setCargando(true);

    try {
      const resp = await axiosAuth.post('/api/tutor/preguntar', {
        pregunta: q,
        historial: nuevoHistorial.slice(-6),
      });
      const respuestaTutor = { rol: 'tutor', texto: resp.data.data.respuesta };
      setMensajes(prev => [...prev, respuestaTutor]);
      setHistorial(prev => [...prev, respuestaTutor]);
    } catch {
      const err = { rol: 'tutor', texto: 'Tuve un problema al responder. Intenta de nuevo.', error: true };
      setMensajes(prev => [...prev, err]);
    } finally {
      setCargando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pregunta, cargando, historial]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  return (
    <div style={es.pagina}>
      <Navbar titulo="Tutor IA" />
      <div style={es.layout}>

        {/* Sidebar */}
        <div style={es.sidebar}>
          <button onClick={() => navigate('/dashboard-estudiante')} style={es.btnVolver}>
            ← Volver
          </button>
          <div style={es.tutorCard}>
            <IconBot size={36} style={{ color: '#43e97b' }} />
            <p style={es.tutorNombre}>Tutor IA</p>
            <p style={es.tutorDesc}>Tu asistente personal de aprendizaje</p>
          </div>

          <p style={es.sidebarTitulo}>Preguntas de ejemplo</p>
          <div style={es.sugerenciasLista}>
            {SUGERENCIAS.map((s, i) => (
              <button key={i} onClick={() => enviar(s)} disabled={cargando} style={es.btnSugerencia}>
                {s}
              </button>
            ))}
          </div>

          <div style={es.tipCard}>
            <p style={es.tipTitulo}>Consejo</p>
            <p style={es.tipTexto}>
              Mientras más detalles le des al tutor sobre lo que no entiendes, mejor te puede ayudar.
            </p>
          </div>
        </div>

        {/* Chat */}
        <div style={es.chatWrap}>
          <div style={es.mensajesArea}>
            {mensajes.map((m, i) => {
              const esTutor = m.rol === 'tutor';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: esTutor ? 'flex-start' : 'flex-end',
                    alignItems: 'flex-end',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  {esTutor && <div style={es.avatarTutor}><IconBot size={15} style={{ color: '#fff' }} /></div>}
                  <div style={{
                    ...es.burbuja,
                    ...(esTutor ? es.burbujaTutor : es.burbujaEstudiante),
                    ...(m.error ? { background: '#fff0f0', color: '#c62828', border: '1px solid #ffcdd2' } : {}),
                  }}>
                    {m.texto}
                  </div>
                </div>
              );
            })}

            {cargando && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '14px' }}>
                <div style={es.avatarTutor}><IconBot size={15} style={{ color: '#fff' }} /></div>
                <div style={{ ...es.burbuja, ...es.burbujaTutor, color: '#bbb', fontStyle: 'italic' }}>
                  Pensando{puntos}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={es.inputWrap}>
            <textarea
              ref={inputRef}
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu pregunta aquí... (Enter para enviar)"
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
                cursor:  (cargando || !pregunta.trim()) ? 'not-allowed' : 'pointer',
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
    display: 'flex', flex: 1, maxWidth: '1100px', width: '100%',
    margin: '0 auto', padding: '24px', gap: '20px', alignItems: 'flex-start',
  },
  sidebar: {
    width: '230px', flexShrink: 0, background: '#fff', borderRadius: '16px',
    padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    position: 'sticky', top: '24px',
  },
  btnVolver: {
    background: 'none', border: 'none', color: 'var(--color-primario)', cursor: 'pointer',
    fontSize: '13px', fontWeight: '700', padding: '0 0 16px',
    fontFamily: 'inherit', display: 'block',
  },
  tutorCard: {
    background: 'linear-gradient(135deg, var(--color-primario)11, var(--color-secundario)11)',
    borderRadius: '12px', padding: '16px', textAlign: 'center',
    marginBottom: '20px',
  },
  tutorNombre: { fontSize: '14px', fontWeight: '800', color: '#333', margin: '8px 0 2px' },
  tutorDesc:   { fontSize: '11px', color: '#888', margin: 0 },
  sidebarTitulo: {
    fontSize: '11px', fontWeight: '700', color: '#bbb',
    textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px',
  },
  sugerenciasLista: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' },
  btnSugerencia: {
    background: '#f7f8ff', border: '1px solid #e8eaf6', borderRadius: '8px',
    padding: '8px 10px', fontSize: '11px', color: '#555', cursor: 'pointer',
    textAlign: 'left', fontFamily: 'inherit', lineHeight: '1.4',
  },
  tipCard: { background: '#fffde7', borderRadius: '10px', padding: '12px', border: '1px solid #fff176' },
  tipTitulo: { fontSize: '12px', fontWeight: '700', color: '#f57f17', margin: '0 0 4px' },
  tipTexto:  { fontSize: '11px', color: '#795548', margin: 0, lineHeight: '1.5' },

  chatWrap: {
    flex: 1, background: '#fff', borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '580px',
  },
  mensajesArea: {
    flex: 1, overflowY: 'auto', padding: '24px',
    display: 'flex', flexDirection: 'column',
  },
  avatarTutor: {
    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  },
  burbuja: {
    maxWidth: '74%', padding: '11px 15px', borderRadius: '16px',
    fontSize: '14px', lineHeight: '1.65', whiteSpace: 'pre-wrap',
  },
  burbujaTutor: {
    background: '#f0fdf4', color: '#1b4332',
    border: '1px solid #bbf7d0', borderBottomLeftRadius: '4px',
  },
  burbujaEstudiante: {
    background: 'linear-gradient(135deg, var(--color-primario), var(--color-secundario))',
    color: '#fff', borderBottomRightRadius: '4px',
  },
  inputWrap: {
    display: 'flex', gap: '10px', padding: '14px 18px',
    borderTop: '1px solid #f0f0f0', background: '#fafafa',
  },
  textarea: {
    flex: 1, borderRadius: '10px', border: '2px solid #e8eaf6',
    padding: '9px 13px', fontSize: '14px', fontFamily: 'inherit',
    resize: 'none', outline: 'none', lineHeight: '1.5', background: '#fff',
  },
  btnEnviar: {
    width: '42px', height: '42px', borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    color: '#fff', fontSize: '16px', fontFamily: 'inherit',
    alignSelf: 'flex-end',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
