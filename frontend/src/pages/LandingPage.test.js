import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

/* jsdom no implementa las APIs del navegador que usa el hero. */
beforeAll(() => {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('LandingPage · hero', () => {
  test('el hero ya no usa imágenes', () => {
    const { container } = renderLanding();
    const hero = container.querySelector('.hero-section');

    expect(hero).toBeTruthy();
    expect(hero.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('.hero-marquee, .hero-banner')).toHaveLength(0);
  });

  test('el hero comunica la promesa y ofrece el CTA de demo', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 }))
      .toHaveTextContent('¿Y si pudieras detectar a tiempo qué estudiantes necesitan ayuda?');
    expect(screen.getByText('Playfesor · Sistema Inteligente de Gestión Académica')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solicitar demo/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('rector@micolegio.edu.co')).toBeInTheDocument();
  });

  test('muestra el panel institucional con el riesgo por grado', () => {
    const { container } = renderLanding();

    expect(container.querySelectorAll('.hero-heatmap-cell')).toHaveLength(7);
    expect(container.querySelectorAll('.hero-ticker-item').length).toBeGreaterThan(0);
  });

  test('el correo escrito en el hero precarga el formulario de demo', () => {
    renderLanding();
    const emailHero = screen.getByPlaceholderText('rector@micolegio.edu.co');

    fireEvent.change(emailHero, { target: { value: 'rector@colegio.edu.co' } });
    fireEvent.submit(emailHero.closest('form'));

    expect(screen.getByPlaceholderText('tu@email.com')).toHaveValue('rector@colegio.edu.co');
  });
});