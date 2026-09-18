jest.mock('../../database');
const db = require('../../database');
const ctrl = require('./configuracionController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const original = process.env.BIENESTAR_CLAVE_CIFRADO;
beforeEach(() => {
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env.BIENESTAR_CLAVE_CIFRADO = original;
  console.error.mockRestore();
});

describe('configuración de Bienestar', () => {
  test('sin fila de configuración, todo arranca apagado', () => {
    expect(ctrl.normalizarConfig(null)).toEqual({
      remiten: 'todos', activo: false, devolucion_docente: false, lider_lee_privadas: false,
      portal_familia: false, adjuntos_remision: false, ia_activa: false,
    });
  });

  test('no deja activar el módulo si falta la clave de cifrado', async () => {
    delete process.env.BIENESTAR_CLAVE_CIFRADO;
    const res = mockRes();
    await ctrl.guardar({ usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { config: null }, body: { activo: true } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('no deja activar el módulo sin un orientador líder', async () => {
    process.env.BIENESTAR_CLAVE_CIFRADO = 'c'.repeat(64);
    db.query.mockResolvedValueOnce([[{ n: 0 }]]);
    const res = mockRes();
    await ctrl.guardar({ usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { config: null }, body: { activo: true } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('rechaza opción de remisión inválida', async () => {
    const res = mockRes();
    await ctrl.guardar({ usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { config: null }, body: { remiten: 'cualquiera' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('no deja meter al equipo a alguien de otro colegio o que no es orientador', async () => {
    db.query.mockResolvedValueOnce([[{ id: 11 }]]); // de los 2 pedidos, solo 1 es orientador de este colegio
    const res = mockRes();
    await ctrl.guardarEquipo({
      usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { config: null },
      body: { miembros: [{ usuario_id: 11, en_equipo: true, nivel: 'lider' }, { usuario_id: 99, en_equipo: true, nivel: 'profesional' }] },
    }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query.mock.calls[0][1]).toEqual([5, 11, 99]);
  });

  test('con el módulo activo no deja el equipo sin líder', async () => {
    db.query.mockResolvedValueOnce([[{ id: 11 }, { id: 12 }]]);
    const res = mockRes();
    await ctrl.guardarEquipo({
      usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { config: { activo: 1 } },
      body: { miembros: [{ usuario_id: 11, en_equipo: true, nivel: 'profesional' }, { usuario_id: 12, en_equipo: true, nivel: 'profesional' }] },
    }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('el estado solo le dice al admin si falta la clave', async () => {
    const resDocente = mockRes();
    await ctrl.estado({ usuario: { id: 4, rol: 'docente', colegio_id: 5 }, bienestar: { activo: false, nivel: null, config: null } }, resDocente);
    expect(resDocente.json.mock.calls[0][0].data).not.toHaveProperty('clave_configurada');

    const resAdmin = mockRes();
    await ctrl.estado({ usuario: { id: 1, rol: 'admin', colegio_id: 5 }, bienestar: { activo: false, nivel: null, config: null } }, resAdmin);
    expect(resAdmin.json.mock.calls[0][0].data).toHaveProperty('clave_configurada');
  });
});
