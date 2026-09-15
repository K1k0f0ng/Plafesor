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
  test('el hero muestra la captura real del panel del director', () => {
    const { container } = renderLanding();
    const hero = container.querySelector('.hero-section');

    expect(hero).toBeTruthy();
    const shot = hero.querySelector('.hero-shot-img');
    expect(shot).toBeTruthy();
    expect(shot).toHaveAttribute('src', '/hero-dashboard.jpg');
    expect(shot).toHaveAttribute('alt', expect.stringContaining('Panel del director'));
  });

  test('el hero comunica la promesa y ofrece el CTA de demo', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1 }))
      .toHaveTextContent('¿Y si pudieras detectar a tiempo qué estudiantes necesitan ayuda?');
    expect(screen.getByText('Playfesor · Sistema Inteligente de Gestión Académica')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solicitar demo/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('rector@micolegio.edu.co')).toBeInTheDocument();
  });

  test('la captura del panel mantiene la señal en vivo y la cinta de señales', () => {
    const { container } = renderLanding();

    expect(container.querySelector('.hero-shot-signal-text')).toBeTruthy();
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