import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { NOMBRE_INSTITUCION } from '../config/tema';

// Debe coincidir con RUTAS_POR_ROL en App.js. Antes le faltaban 'director' y
// 'padre': funcionaba solo porque la ruta "/" (antes la página de marketing)
// volvía a redirigir con el mapa completo. En esta plantilla "/" ya no hace
// ese doble chequeo, así que este mapa debe estar completo por sí solo.
const RUTA_POR_ROL = {
  admin: '/dashboard',
  docente: '/dashboard-docente',
  estudiante: '/dashboard-estudiante',
  director: '/dashboard-director',
  padre: '/dashboard-padre',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const resp = await axios.post(`${API}/api/auth/login`, { email, password });
      const { token, usuario } = resp.data;
      iniciarSesion(token, usuario);
      navigate(RUTA_POR_ROL[usuario.rol] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={estilos.fondo}>
      <div style={estilos.tarjeta}>
        {/* Logo / Encabezado */}
        <div style={estilos.encabezado}>
          <div style={estilos.logoCirculo}>
            <img src="/logo-icon.png" alt={NOMBRE_INSTITUCION} style={{ width: '48px', height: '48px' }} />
          </div>
          <h1 style={estilos.titulo}>{NOMBRE_INSTITUCION}</h1>
          <p style={estilos.subtitulo}>Plataforma educativa</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={estilos.formulario}>
          <div style={estilos.grupo}>
            <label style={estilos.etiqueta}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@correo.com"
              required
              style={estilos.input}
            />
          </div>

          <div style={estilos.grupo}>
            <label style={estilos.etiqueta}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={estilos.input}
            />
          </div>

          {error && <div style={estilos.error}>{error}</div>}

          <button
            type="submit"
            disabled={cargando}
            style={{ ...estilos.boton, opacity: cargando ? 0.7 : 1 }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link to="/forgot-password" style={estilos.linkOlvide}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <p style={estilos.pie}>
          Acceso para docentes, estudiantes y administradores
        </p>
      </div>
    </div>
  );
}

const estilos = {
  fondo: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  tarjeta: {
    background: '#fff',
    borderRadius: '20px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  encabezado: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  logoCirculo: {
    display: 'block',
    marginBottom: '12px',
    textAlign: 'center',
  },
  titulo: {
    fontSize: '32px',
    fontWeight: '800',
    color: 'var(--color-primario)',
    margin: '0 0 4px',
  },
  subtitulo: {
    color: '#888',
    fontSize: '14px',
    margin: 0,
  },
  formulario: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  grupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  etiqueta: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#444',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '2px solid #e8e8e8',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  error: {
    background: '#fff0f0',
    border: '1px solid #ffcdd2',
    color: '#c62828',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
  },
  boton: {
    background: 'linear-gradient(135deg, var(--color-primario) 0%, var(--color-secundario) 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '4px',
    fontFamily: 'inherit',
  },
  pie: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: '13px',
    marginTop: '24px',
    marginBottom: 0,
  },
  linkOlvide: {
    color: '#888',
    fontSize: '13px',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
