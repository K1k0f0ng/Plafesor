import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

// El botón ☰ vive en la Navbar de cada página; este contexto le da acceso
// al menú lateral sin tener que pasar props por todas las páginas.
const MenuContext = createContext(null);
export function useMenuLateral() {
  return useContext(MenuContext);
}

const QUERY_MOVIL = '(max-width: 900px)';
const CLAVE_MENU = 'playfesor_menu_abierto';

export function useEsMovil() {
  const [esMovil, setEsMovil] = useState(() => !!window.matchMedia?.(QUERY_MOVIL).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY_MOVIL);
    const handler = e => setEsMovil(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return esMovil;
}

function leerPreferencia() {
  try { return localStorage.getItem(CLAVE_MENU) !== 'false'; } catch { return true; }
}

export default function Layout({ children, variante }) {
  const esMovil = useEsMovil();
  const location = useLocation();
  // En computador se recuerda si el usuario dejó el menú abierto o cerrado;
  // en celular siempre arranca cerrado y se abre encima del contenido.
  const [abiertoEscritorio, setAbiertoEscritorio] = useState(leerPreferencia);
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  // Al navegar desde el menú en el celular, se cierra solo
  useEffect(() => { setAbiertoMovil(false); }, [location.pathname]);

  // El panel de Director trae su propio marco (barra superior + menú flotante)
  if (variante === 'director') return <>{children}</>;

  const abierto = esMovil ? abiertoMovil : abiertoEscritorio;

  function alternar() {
    if (esMovil) return setAbiertoMovil(v => !v);
    setAbiertoEscritorio(v => {
      try { localStorage.setItem(CLAVE_MENU, String(!v)); } catch { /* sin almacenamiento */ }
      return !v;
    });
  }

  return (
    <MenuContext.Provider value={{ abierto, alternar }}>
      <div style={es.contenedor} className="pf-app">
        {!esMovil && abierto && <Sidebar />}

        {esMovil && abierto && (
          <>
            <div style={es.fondo} onClick={() => setAbiertoMovil(false)} />
            <div style={es.cajon}>
              <Sidebar />
            </div>
          </>
        )}

        <div style={es.principal} className="pf-principal">
          {children}
        </div>
      </div>
    </MenuContext.Provider>
  );
}

const es = {
  contenedor: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f0f2f5',
  },
  principal: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  fondo: {
    position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.45)', zIndex: 900,
  },
  cajon: {
    position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 901,
    maxWidth: '85vw', display: 'flex', boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
  },
};
