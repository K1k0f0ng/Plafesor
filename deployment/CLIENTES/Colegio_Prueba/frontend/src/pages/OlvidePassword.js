import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../config/api';
import { NOMBRE_INSTITUCION } from '../config/tema';

export default function OlvidePassword() {
  const [email, setEmail]       = useState('');
  const [enviado, setEnviado]   = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await axios.post(`${API}/api/auth/solicitar-reset`, { email });
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={es.fondo}>
      <div style={es.tarjeta}>
        <div style={es.encabezado}>
          <div style={es.logoCirculo}>
            <img src="/logo-icon.png" alt={NOMBRE_INSTITUCION} style={{ width: '48px', height: '48px' }} />
          </div>
          <h1 style={es.titulo}>{NOMBRE_INSTITUCION}</h1>
          <p style={es.subtitulo}>Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div style={es.exito}>
            <div style={es.exitoIcono}>✉</div>
            <h3 style={es.exitoTitulo}>Revisa tu correo</h3>
            <p style={es.exitoTexto}>
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <p style={es.exitoAyuda}>
              Revisa también la carpeta de <strong>spam</strong> o correo no deseado.
            </p>
            <Link to="/login" style={es.btnVolver}>← Volver al inicio de sesión</Link>
          </div>
        ) : (
          <>
            <p style={es.instruccion}>
              Escribe tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <form onSubmit={handleSubmit} style={es.form}>
              <div style={es.grupo}>
                <label style={es.etiqueta}>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@correo.com"
                  required
                  style={es.input}
                />
              </div>

              {error && <div style={es.error}>{error}</div>}

              <button type="submit" disabled={cargando} style={{ ...es.boton, opacity: cargando ? 0.7 : 1 }}>
                {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <div style={es.pie}>
              <Link to="/login" style={es.linkVolver}>← Volver al inicio de sesión</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const es = {
  fondo: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  },
  tarjeta: {
    background: '#fff', borderRadius: '20px', padding: '48px 40px',
    width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  encabezado: { textAlign: 'center', marginBottom: '28px' },
  logoCirculo: { display: 'block', marginBottom: '12px', textAlign: 'center' },
  titulo: { fontSize: '32px', fontWeight: '800', color: 'var(--color-primario)', margin: '0 0 4px' },
  subtitulo: { color: '#888', fontSize: '14px', margin: 0 },
  instruccion: { color: '#555', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  grupo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  etiqueta: { fontSize: '14px', fontWeight: '600', color: '#444' },
  input: {
    padding: '12px 16px', borderRadius: '10px', border: '2px solid #e8e8e8',
    fontSize: '15px', outline: 'none', fontFamily: 'inherit',
  },
  error: {
    background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
  },
  boton: {
    background: 'linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%)',
    color: '#fff', border: 'none', borderRadius: '10px', padding: '14px',
    fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
  },
  pie: { textAlign: 'center', marginTop: '20px' },
  linkVolver: { color: 'var(--color-primario)', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },

  exito: { textAlign: 'center' },
  exitoIcono: { fontSize: '48px', marginBottom: '16px' },
  exitoTitulo: { fontSize: '20px', fontWeight: '700', color: '#333', margin: '0 0 12px' },
  exitoTexto: { color: '#555', fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' },
  exitoAyuda: { color: '#888', fontSize: '13px', marginBottom: '28px' },
  btnVolver: {
    display: 'inline-block', color: 'var(--color-primario)', fontSize: '14px',
    fontWeight: '600', textDecoration: 'none',
  },
};
