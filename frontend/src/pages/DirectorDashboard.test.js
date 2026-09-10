import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axiosAuth from '../config/axios';
import { AuthProvider, useAuth } from '../context/AuthContext';
import DirectorDashboard from './DirectorDashboard';

jest.mock('../config/axios');

const GRUPOS = [
  { grupo_id: 1, nombre_grupo: '6-1', grado: 6, total_estudiantes: 32, total_actividades: 68, promedio: '3.7', nivel_bajo: 0, nivel_basico: 0, nivel_alto: 0, nivel_superior: 0 },
  { grupo_id: 2, nombre_grupo: '7-2', grado: 6, total_estudiantes: 28, total_actividades: 59, promedio: '3.9', nivel_bajo: 1, nivel_basico: 3, nivel_alto: 15, nivel_superior: 7 },
];

const ALERTAS = [
  { estudiante_id: 11, nombre_estudiante: 'María C.', nombre_materia: 'Física', nombre_grupo: '7-2', grado: 6, actividades_bajo: 3, peor_nota: 2.1 },
  { estudiante_id: 12, nombre_estudiante: 'Andrés P.', nombre_materia: 'Matemáticas', nombre_grupo: '6-1', grado: 6, actividades_bajo: 2, peor_nota: 2.8 },
];

const RESPUESTAS = [
  { ruta: /\/api\/reportes\/colegio\/\d+\/resumen/, cuerpo: { data: { colegio: 'Colegio Moderno del Sur', grupos: GRUPOS } } },
  { ruta: /\/api\/reportes\/alertas\/colegio\/\d+/, cuerpo: { data: ALERTAS } },
  { ruta: /\/api\/briefing\/colegio\/\d+/, cuerpo: { data: { texto: 'Resumen ejecutivo del día para rectoría.' } } },
  { ruta: /\/api\/mensajes\/no-leidos/, cuerpo: { data: { total: 0 } } },
  { ruta: /\/api\/notificaciones/, cuerpo: { data: [], sinLeer: 0 } },
];

function tokenFalso() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecera.${payload}.firma`;
}

/* Reproduce la protección de RutaPrivada: la página solo se monta con sesión */
function ConSesion({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando || !usuario) return null;
  return children;
}

function renderPanel() {
  localStorage.setItem('playfesor_token', tokenFalso());
  localStorage.setItem('playfesor_usuario', JSON.stringify({
    id: 9, nombre: 'Carlos Ramirez', email: 'carlos@colegio.edu.co', rol: 'director', colegio_id: 7,
  }));

  return render(
    <MemoryRouter initialEntries={['/dashboard-director']}>
      <AuthProvider>
        <ConSesion>
          <DirectorDashboard />
        </ConSesion>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Panel del Director', () => {
  beforeEach(() => {
    localStorage.clear();
    axiosAuth.get.mockImplementation((url) => {
      const encontrada = RESPUESTAS.find(r => r.ruta.test(url));
      return Promise.resolve({ data: encontrada ? encontrada.cuerpo : { data: [] } });
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('saluda al director y muestra el colegio en la barra superior', async () => {
    renderPanel();

    // El nombre del colegio llega con el resumen: esperarlo primero deja que la
    // respuesta del mock se aplique dentro del ciclo async de la librería
    expect(await screen.findByText('Colegio Moderno del Sur')).toBeInTheDocument();
    expect(screen.getByText('Bienvenido, Director del Colegio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Carlos Ramirez');
    // El logo vive solo en la barra superior: el menú lateral ya no lo repite
    expect(screen.getAllByAltText('Playfesor')).toHaveLength(1);
  });

  test('el aviso de riesgo resume los estudiantes detectados', async () => {
    renderPanel();

    expect(await screen.findByText(/Playfesor ha identificado 2 estudiantes con posible riesgo académico/))
      .toBeInTheDocument();
    expect(screen.getByText(/Resumen ejecutivo del día para rectoría/)).toBeInTheDocument();
    expect(screen.getByText('Ver estudiantes →')).toBeInTheDocument();
    // La tabla solo se dibuja cuando la carga terminó: evita actualizaciones fuera de act()
    expect(await screen.findByText('Rendimiento por grupo')).toBeInTheDocument();
  });

  test('muestra los accesos rápidos, el resumen y el rendimiento por grupo', async () => {
    const { container } = renderPanel();

    // La nota del promedio solo se dibuja cuando el resumen ya cargó
    expect(await screen.findByText('Escala MEN: Básico')).toBeInTheDocument();

    expect(screen.getByText('Centro de Métricas →')).toBeInTheDocument();
    expect(screen.getByText('PIAR (Ajustes Razonables) →')).toBeInTheDocument();
    expect(screen.getByText('Gemelo Digital →')).toBeInTheDocument();

    ['Grupos activos', 'Estudiantes totales', 'Actividades', 'Promedio colegio']
      .forEach(texto => expect(screen.getByText(texto)).toBeInTheDocument());

    expect(screen.getByText('Rendimiento por grupo')).toBeInTheDocument();
    expect(screen.getByText('Ver todos los grupos →')).toBeInTheDocument();
    expect(screen.getByText('6-1')).toBeInTheDocument();
    expect(screen.getByText('7-2')).toBeInTheDocument();

    // Cada tarjeta de resumen dibuja su curva
    expect(container.querySelectorAll('svg polyline').length).toBeGreaterThanOrEqual(4);
  });

  test('conserva el menú lateral y retira la barra anterior', async () => {
    renderPanel();

    // Espera a que el resumen llegue para no dejar actualizaciones fuera de act()
    await screen.findByText('Colegio Moderno del Sur');
    expect(screen.getByText('Inteligencia Institucional')).toBeInTheDocument();
    expect(screen.getByText('Motor de Riesgo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText('Panel Director')).not.toBeInTheDocument();
  });
});