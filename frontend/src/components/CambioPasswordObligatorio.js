import React, { useState } from 'react';
import axiosAuth from '../config/axios';
import { useAuth } from '../context/AuthContext';

// Bloquea la navegación cuando el colegio exige rotación de contraseña y el
// usuario ya venció su plazo. Se muestra sobre cualquier pantalla privada,
// sin necesidad de que cada página lo revise por su cuenta.
export default function CambioPasswordObligatorio() {
  const { usuario, actualizarUsuario, cerrarSesion } = useAuth();
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!usuario?.debe_cambiar_password) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (passwordNueva.length < 6) {
      return setError('La nueva contraseña debe tener al menos 6 caracteres');
    }
    if (passwordNueva !== passwordConfirmar) {
      return setError('Las contraseñas no coinciden');
    }
    setGuardando(true);
    try {
      await axiosAuth.put('/api/auth/cambiar-password', {
        password_actual: passwordActual,
        password_nueva: passwordNueva,
      });
      actualizarUsuario({ debe_cambiar_password: false });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div style={es.fondo} />
      <div style={es.modal}>
        <div style={es.cabecera}>
          <div style={{ fontWeight: '800', fontSize: '15px' }}>Debes actualizar tu contraseña</div>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
            Tu colegio exige cambiarla periódicamente por seguridad.
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          {error && <div style={es.errorBox}>{error}</div>}

          <label style={es.label}>Contraseña actual</label>
          <input
            type="password"
            value={passwordActual}
            onChange={e => setPasswordActual(e.target.value)}
            style={es.input}
            required
          />

          <label style={es.label}>Nueva contraseña</label>
          <input
            type="password"
            value={passwordNueva}
            onChange={e => setPasswordNueva(e.target.value)}
            style={es.input}
            required
          />

          <label style={es.label}>Confirmar nueva contraseña</label>
          <input
            type="password"
            value={passwordConfirmar}
            onChange={e => setPasswordConfirmar(e.target.value)}
            style={es.input}
            required
          />

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" onClick={cerrarSesion} style={es.btnSec}>Cerrar sesión</button>
            <button type="submit" disabled={guardando} style={{ ...es.btnPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const es = {
  fondo: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 500 },
  modal: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '420px', maxWidth: '92vw', background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', zIndex: 501, overflow: 'hidden' },
  cabecera: { padding: '18px 22px', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' },
  label: { display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#555', margin: '12px 0 6px' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box' },
  errorBox: { background: '#fff0f0', color: '#c62828', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '6px' },
  btnPrimario: { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { background: '#f0f2f5', color: '#666', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
};
