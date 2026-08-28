import React from 'react';

export default function Navbar({ titulo }) {
  if (!titulo) return null;
  return (
    <header style={es.header}>
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
    padding: '0 28px',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    flexShrink: 0,
  },
  titulo: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.2px',
  },
};
