import React from 'react';
import { useMenuLateral } from './Layout';
import { IconMenu } from './Icons';

export default function Navbar({ titulo }) {
  const menu = useMenuLateral();
  if (!titulo) return null;
  return (
    <header style={es.header} className="pf-navbar">
      {menu && (
        <button
          onClick={menu.alternar}
          style={es.btnMenu}
          title={menu.abierto ? 'Ocultar menú' : 'Mostrar menú'}
          aria-label={menu.abierto ? 'Ocultar menú' : 'Mostrar menú'}
          aria-expanded={menu.abierto}
        >
          <IconMenu size={20} />
        </button>
      )}
      <span style={es.titulo}>{titulo}</span>
    </header>
  );
}

const es = {
  header: {
    height: '54px',
    background: '#ffffff',
    borderBottom: '1px solid #eeeff3',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 28px',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    flexShrink: 0,
  },
  btnMenu: {
    background: 'transparent', border: 'none', color: '#5b6478', cursor: 'pointer',
    width: '38px', height: '38px', marginLeft: '-10px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  titulo: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
