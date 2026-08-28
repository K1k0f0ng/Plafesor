import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../config/api';
import { NOMBRE_INSTITUCION } from '../config/tema';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [listo, setListo]       = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmar) return setError('Las contraseñas no coinciden');
    if (password.length < 6)   return setError('La contraseña debe tener al menos 6 caracteres');
    setCargando(true);
    try {
      await axios.post(`${API}/api/auth/resetear-password`, { token, password });
      setListo(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar. El enlace puede haber expirado.');
    } finally {
      setCargando(false);
    }
  }

  if (!token) {
    return (
      <div style={es.fondo}>
        <div style={es.tarjeta}>
          <div style={es.encabezado}>
            <img src="/logo-icon.png" alt={NOMBRE_INSTITUCION} style={{ width: '48px', height: '48px', marginBottom: '8px' }} />
            <h1 style={es.titulo}>{NOMBRE_INSTITUCION}</h1>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#c62828', marginBottom: '20px' }}>Enlace no válido o incompleto.</p>
            <Link to="/forgot-password" style={es.linkVolver}>Solicitar nuevo enlace</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={es.fondo}>
      <div style={es.tarjeta}>
        <div style={es.encabezado}>
          <div style={{ marginBottom: '12px' }}>
            <img src="/logo-icon.png" alt={NOMBRE_INSTITUCION} style={{ width: '48px', height: '48px' }} />
          </div>
          <h1 style={es.titulo}>{NOMBRE_INSTITUCION}</h1>
          <p style={es.subtitulo}>Nueva contraseña</p>
        </div>

        {listo ? (
          <div style={es.exito}>
            <div style={es.exitoIcono}>✓</div>
            <h3 style={es.exitoTitulo}>¡Contraseña actualizada!</h3>
            <p style={es.exitoTexto}>Tu contraseña ha sido cambiada correctamente.</p>
            <p style={es.exitoAyuda}>Redirigiendo al inicio de sesión...</p>
            <Link to="/login" style={es.btnVolver}>Ir al inicio de sesión →</Link>
          </div>
        ) : (
          <>
            <p style={es.instruccion}>Escribe tu nueva contraseña. Debe tener al menos 6 caracteres.</p>
            <form onSubmit={handleSubmit} style={es.form}>
              <div style={es.grupo}>
                <label style={es.etiqueta}>Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={es.input}
                />
              </div>
              <div style={es.grupo}>
                <label style={es.etiqueta}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={es.input}
                />
              </div>

              {error && <div style={es.error}>{error}</div>}

              <button type="submit" disabled={cargando} style={{ ...es.boton, opacity: cargando ? 0.7 : 1 }}>
                {cargando ? 'Guardando...' : 'Cambiar contraseña'}
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
  exitoIcono: {
    width: '56px', height: '56px', borderRadius: '50%',
    background: 'linear-gradient(135deg,#43e97b,#38f9d7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px', fontSize: '24px', color: '#fff', fontWeight: '700',
  },
  exitoTitulo: { fontSize: '20px', fontWeight: '700', color: '#333', margin: '0 0 12px' },
  exitoTexto: { color: '#555', fontSize: '14px', lineHeight: 1.6, marginBottom: '8px' },
  exitoAyuda: { color: '#888', fontSize: '13px', marginBottom: '24px' },
  btnVolver: { display: 'inline-block', color: 'var(--color-primario)', fontSize: '14px', fontWeight: '600', textDecoration: 'none' },
};
