const { cifrar, descifrar, claveConfigurada, cifrarBuffer, descifrarBuffer } = require('./cifrado');

const CLAVE_PRUEBA = 'a'.repeat(64);
const OTRA_CLAVE   = 'b'.repeat(64);

describe('cifrado de Bienestar', () => {
  const original = process.env.BIENESTAR_CLAVE_CIFRADO;
  let errorSpy;

  beforeEach(() => {
    process.env.BIENESTAR_CLAVE_CIFRADO = CLAVE_PRUEBA;
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.BIENESTAR_CLAVE_CIFRADO = original;
    errorSpy.mockRestore();
  });

  test('cifra y descifra el mismo texto (con tildes y ñ)', () => {
    const texto = 'Reunión con acudiente: el niño llegó tarde 4 veces.';
    const guardado = cifrar(texto);
    expect(guardado.startsWith('v1:')).toBe(true);
    expect(guardado).not.toContain('Reunión');
    expect(descifrar(guardado)).toBe(texto);
  });

  test('el mismo texto cifrado dos veces da resultados distintos', () => {
    expect(cifrar('igual')).not.toBe(cifrar('igual'));
  });

  test('vacío o null se guarda como null', () => {
    expect(cifrar('')).toBeNull();
    expect(cifrar('   ')).toBeNull();
    expect(cifrar(null)).toBeNull();
    expect(descifrar(null)).toBeNull();
  });

  test('sin clave configurada se niega a guardar (nunca texto plano)', () => {
    delete process.env.BIENESTAR_CLAVE_CIFRADO;
    expect(claveConfigurada()).toBe(false);
    expect(() => cifrar('dato sensible')).toThrow('BIENESTAR_CLAVE_CIFRADO');
  });

  test('una clave inválida (corta) cuenta como no configurada', () => {
    process.env.BIENESTAR_CLAVE_CIFRADO = 'abc123';
    expect(claveConfigurada()).toBe(false);
  });

  test('con otra clave no se puede leer', () => {
    const guardado = cifrar('secreto');
    process.env.BIENESTAR_CLAVE_CIFRADO = OTRA_CLAVE;
    expect(descifrar(guardado)).toBeNull();
  });

  test('si alguien altera el dato en la base, no se entrega', () => {
    const guardado = cifrar('secreto');
    const alterado = guardado.slice(0, -4) + (guardado.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(descifrar(alterado)).toBeNull();
  });

  test('archivos: cifra y recupera los mismos bytes', () => {
    const original = Buffer.from('%PDF-1.4 contenido de prueba con ñ', 'utf8');
    const enDisco = cifrarBuffer(original);
    expect(enDisco.includes(Buffer.from('contenido de prueba'))).toBe(false);
    expect(descifrarBuffer(enDisco).equals(original)).toBe(true);
  });

  test('archivos: con otra clave o alterados no se entregan', () => {
    const enDisco = cifrarBuffer(Buffer.from('secreto'));
    const alterado = Buffer.from(enDisco); alterado[alterado.length - 1] ^= 1;
    expect(descifrarBuffer(alterado)).toBeNull();
    process.env.BIENESTAR_CLAVE_CIFRADO = OTRA_CLAVE;
    expect(descifrarBuffer(enDisco)).toBeNull();
  });

  test('archivos: sin clave no se guardan', () => {
    delete process.env.BIENESTAR_CLAVE_CIFRADO;
    expect(() => cifrarBuffer(Buffer.from('x'))).toThrow('BIENESTAR_CLAVE_CIFRADO');
  });

  test('los errores no imprimen el contenido', () => {
    const guardado = cifrar('contenido muy sensible');
    process.env.BIENESTAR_CLAVE_CIFRADO = OTRA_CLAVE;
    descifrar(guardado);
    const impreso = errorSpy.mock.calls.flat().join(' ');
    expect(impreso).not.toContain('contenido muy sensible');
  });
});
