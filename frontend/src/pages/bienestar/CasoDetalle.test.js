import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axiosAuth from '../../config/axios';
import CasoDetalle from './CasoDetalle';
import { construirEventos } from './caso/LineaTiempo';

jest.mock('../../config/axios');

// Caso de ejemplo tal como lo entrega GET /api/bienestar/casos/:id
const CASO = {
  id: 10, estado: 'en_seguimiento', prioridad: 'alta', estudiante_id: 20,
  abierto_en: '2026-09-01T10:00:00Z', cerrado_en: null, responsable_id: 9, motivo_id: 3,
  estudiante: 'Ana Pérez', responsable: 'Laura Orientadora', motivo: 'Dificultades de convivencia', motivo_cierre: null,
  motivo_detalle: 'Conflictos en el descanso', antecedentes: '', cierre_detalle: null,
  contexto: {
    grupo: 'A', grado: '7', promedio_60_dias: 3.4, promedio_periodo_anterior: 4.1,
    ausencias_30_dias: 3, tardanzas_30_dias: 1, riesgo_academico: 'alto', materias_en_riesgo: 2,
    tiene_piar: false, anotaciones_mejora_30_dias: 2,
  },
  seguimientos: [{
    id: 1, fecha: '2026-09-10T15:00:00Z', tipo: 'Sesión con el estudiante', tipo_id: 5, autor: 'Laura Orientadora', autor_id: 9,
    participantes: ['Estudiante'], motivo: '', resumen: 'Se exploraron las situaciones del descanso.', acuerdos: 'Hablar con el director de grupo',
    proxima_accion: '', proxima_fecha: null, tiene_nota_privada: true, puede_ver_nota: true, puede_editar: true,
  }],
  compromisos: [{ id: 7, seguimiento_id: null, descripcion: 'Entregar las tareas pendientes', responsable_tipo: 'estudiante', fecha_limite: '2026-09-05', estado: 'pendiente', visible_familia: false, creado_en: '2026-09-02T10:00:00Z' }],
  remisiones: [{ id: 3, creado_en: '2026-08-30T10:00:00Z', prioridad: 'alta', estado: 'en_seguimiento', motivo: 'Dificultades de convivencia', remitente: 'Pedro Docente', remitente_rol: 'docente' }],
  asignaciones: [{ desde: '2026-09-01T10:00:00Z', hasta: null, orientador: 'Laura Orientadora', asignado_por: 'Laura Orientadora' }],
  adjuntos: [],
  permisos: { es_lider: true, editable: true },
};

function renderCaso() {
  return render(
    <MemoryRouter initialEntries={['/bienestar/casos/10']}>
      <Routes><Route path="/bienestar/casos/:id" element={<CasoDetalle />} /></Routes>
    </MemoryRouter>
  );
}

describe('Detalle del caso de orientación', () => {
  beforeEach(() => {
    axiosAuth.get.mockImplementation((url) => {
      if (url === '/api/bienestar/casos/10') return Promise.resolve({ data: { data: CASO } });
      if (url.includes('/nota-privada')) return Promise.resolve({ data: { data: { nota_privada: 'Nota reservada' } } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  test('muestra el encabezado, el contexto académico y la línea de tiempo', async () => {
    renderCaso();
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText(/Laura Orientadora/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('-0.7 vs. período anterior')).toBeInTheDocument();
    expect(screen.getByText('Caso abierto')).toBeInTheDocument();
    expect(screen.getByText(/Remisión de Docente Pedro Docente/)).toBeInTheDocument();
  });

  test('la nota privada NO se carga hasta que el orientador la pide', async () => {
    renderCaso();
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('tab', { name: /Seguimientos/ }));
    expect(axiosAuth.get).not.toHaveBeenCalledWith(expect.stringContaining('nota-privada'));
    fireEvent.click(screen.getByText(/Ver nota privada/));
    expect(await screen.findByText('Nota reservada')).toBeInTheDocument();
  });

  test('marca los compromisos vencidos', async () => {
    renderCaso();
    await screen.findByText('Ana Pérez');
    fireEvent.click(screen.getByRole('tab', { name: 'Compromisos' }));
    expect(screen.getByText('Entregar las tareas pendientes')).toBeInTheDocument();
    expect(screen.getByText(/vencido/)).toBeInTheDocument();
  });

  test('si el servidor niega el acceso, no muestra nada del caso', async () => {
    axiosAuth.get.mockImplementation(() => Promise.reject({ response: { data: { error: 'Caso no encontrado' } } }));
    renderCaso();
    expect(await screen.findByText('Caso no encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
  });
});

describe('línea de tiempo', () => {
  test('ordena del evento más reciente al más antiguo', () => {
    const eventos = construirEventos(CASO);
    const fechas = eventos.map(e => new Date(e.fecha).getTime());
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
    expect(eventos[0].tipo).toBe('seguimiento');
    expect(eventos[eventos.length - 1].tipo).toBe('remision');
  });
});
