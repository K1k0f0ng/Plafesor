import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, variante }) {
  // El panel de Director trae su propio marco (barra superior + menú flotante)
  if (variante === 'director') return <>{children}</>;

  return (
    <div style={es.contenedor}>
      <Sidebar />
      <div style={es.principal}>
        {children}
      </div>
    </div>
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
};
