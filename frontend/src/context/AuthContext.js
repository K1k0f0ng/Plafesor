import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const AuthContext = createContext(null);

function tokenExpirado(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(true);
  const intervaloRef = useRef(null);

  function cerrarSesion() {
    localStorage.removeItem('playfesor_token');
    localStorage.removeItem('playfesor_usuario');
    setToken(null);
    setUsuario(null);
    if (intervaloRef.current) clearInterval(intervaloRef.current);
  }

  function iniciarVigilancia(tkn) {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    intervaloRef.current = setInterval(() => {
      if (tokenExpirado(tkn)) cerrarSesion();
    }, 60_000);
  }

  // Al arrancar la app, recupera la sesión guardada en el navegador
  useEffect(() => {
    const tokenGuardado = localStorage.getItem('playfesor_token');
    const usuarioGuardado = localStorage.getItem('playfesor_usuario');

    if (tokenGuardado && usuarioGuardado) {
      if (tokenExpirado(tokenGuardado)) {
        localStorage.removeItem('playfesor_token');
        localStorage.removeItem('playfesor_usuario');
      } else {
        try {
          setToken(tokenGuardado);
          setUsuario(JSON.parse(usuarioGuardado));
          iniciarVigilancia(tokenGuardado);
        } catch {
          localStorage.clear();
        }
      }
    }
    setCargando(false);
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, []);

  function iniciarSesion(nuevoToken, datosUsuario) {
    localStorage.setItem('playfesor_token', nuevoToken);
    localStorage.setItem('playfesor_usuario', JSON.stringify(datosUsuario));
    setToken(nuevoToken);
    setUsuario(datosUsuario);
    iniciarVigilancia(nuevoToken);
  }

  // Actualiza campos puntuales del usuario en sesión (ej. tras subir una foto)
  // sin necesidad de volver a iniciar sesión.
  function actualizarUsuario(cambios) {
    setUsuario(prev => {
      const actualizado = { ...prev, ...cambios };
      localStorage.setItem('playfesor_usuario', JSON.stringify(actualizado));
      return actualizado;
    });
  }

  return (
    <AuthContext.Provider value={{ usuario, token, iniciarSesion, actualizarUsuario, cerrarSesion, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
