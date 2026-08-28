const { normalizarTelefono } = require('./whatsappService');

describe('normalizarTelefono', () => {
  test('vacío o nulo da null', () => {
    expect(normalizarTelefono(null)).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
    expect(normalizarTelefono('')).toBeNull();
  });

  test('número colombiano de 10 dígitos agrega el prefijo 57', () => {
    expect(normalizarTelefono('3001234567')).toBe('+573001234567');
  });

  test('número que ya trae el prefijo 57 se respeta', () => {
    expect(normalizarTelefono('573001234567')).toBe('+573001234567');
  });

  test('quita espacios, guiones y el símbolo + antes de normalizar', () => {
    expect(normalizarTelefono('+57 300-123-4567')).toBe('+573001234567');
    expect(normalizarTelefono('300 123 4567')).toBe('+573001234567');
  });

  test('número demasiado corto da null', () => {
    expect(normalizarTelefono('12345')).toBeNull();
  });
});
