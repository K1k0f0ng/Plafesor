jest.mock('../database');
const { nivelMEN } = require('./boletinController');

describe('nivelMEN', () => {
  test('sin nota da "Sin calificar"', () => {
    expect(nivelMEN(null)).toBe('Sin calificar');
    expect(nivelMEN(undefined)).toBe('Sin calificar');
  });

  test('clasifica los 4 niveles de la escala MEN colombiana', () => {
    expect(nivelMEN(1.0)).toBe('Bajo');
    expect(nivelMEN(3.4)).toBe('Bajo');
    expect(nivelMEN(3.5)).toBe('Básico');
    expect(nivelMEN(3.9)).toBe('Básico');
    expect(nivelMEN(4.0)).toBe('Alto');
    expect(nivelMEN(4.5)).toBe('Alto');
    expect(nivelMEN(4.6)).toBe('Superior');
    expect(nivelMEN(5.0)).toBe('Superior');
  });
});
