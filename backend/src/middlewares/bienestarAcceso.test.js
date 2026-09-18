jest.mock('../database');
const db = require('../database');
const {
  cargarContextoBienestar, requiereModuloActivo, requiereEquipo, requiereAdminOEquipo, casoAccesible,
} = require('./bienestarAcceso');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// La bitácora también usa db.query; por defecto responde vacío
beforeEach(() => {
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('cargarContextoBienestar', () => {
  test('sin colegio en la sesión → 403', async () => {
    const res = mockRes(); const next = jest.fn();
    await cargarContextoBienestar({ usuario: { id: 1, rol: 'admin' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('si la base de datos falla, BLOQUEA (no deja pasar)', async () => {
    db.query.mockRejectedValueOnce(new Error('caída'));
    const res = mockRes(); const next = jest.fn();
    await cargarContextoBienestar({ usuario: { id: 1, rol: 'orientador', colegio_id: 5 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  test('usa el colegio de la sesión, no uno que venga en la petición', async () => {
    db.query.mockResolvedValueOnce([[{ colegio_id: 5, activo: 1 }]]).mockResolvedValueOnce([[{ nivel: 'lider' }]]);
    const req = { usuario: { id: 1, rol: 'orientador', colegio_id: 5 }, params: { colegio_id: 99 }, body: { colegio_id: 99 } };
    const next = jest.fn();
    await cargarContextoBienestar(req, mockRes(), next);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
    expect(req.bienestar).toEqual(expect.objectContaining({ activo: true, nivel: 'lider' }));
    expect(next).toHaveBeenCalled();
  });

  test('un admin nunca queda con nivel de equipo', async () => {
    db.query.mockResolvedValueOnce([[{ colegio_id: 5, activo: 1 }]]);
    const req = { usuario: { id: 2, rol: 'admin', colegio_id: 5 } };
    await cargarContextoBienestar(req, mockRes(), jest.fn());
    expect(req.bienestar.nivel).toBeNull();
  });
});

describe('requiereModuloActivo', () => {
  test('módulo apagado → 403', () => {
    const res = mockRes(); const next = jest.fn();
    requiereModuloActivo({ bienestar: { activo: false } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requiereEquipo', () => {
  const casos = [
    ['docente', { rol: 'docente', colegio_id: 5 }, null],
    ['admin', { rol: 'admin', colegio_id: 5 }, null],
    ['director', { rol: 'director', colegio_id: 5 }, null],
    ['padre', { rol: 'padre', colegio_id: 5 }, null],
    ['orientador que no está en el equipo', { rol: 'orientador', colegio_id: 5 }, null],
  ];
  test.each(casos)('%s → 403', (_, usuario, nivel) => {
    const res = mockRes(); const next = jest.fn();
    requiereEquipo()({ usuario, bienestar: { nivel } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('un rol que no es orientador no pasa aunque traiga nivel', () => {
    const res = mockRes(); const next = jest.fn();
    requiereEquipo()({ usuario: { rol: 'admin', colegio_id: 5 }, bienestar: { nivel: 'lider' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('orientador profesional pasa a lo general', () => {
    const next = jest.fn();
    requiereEquipo()({ usuario: { rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'profesional' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('profesional NO pasa a lo que es solo de líder', () => {
    const res = mockRes(); const next = jest.fn();
    requiereEquipo('lider')({ usuario: { rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'profesional' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('un acceso denegado queda en la bitácora', () => {
    requiereEquipo()({ usuario: { id: 7, rol: 'docente', colegio_id: 5 }, bienestar: { nivel: null } }, mockRes(), jest.fn());
    const insert = db.query.mock.calls.find(c => String(c[0]).includes('bienestar_auditoria'));
    expect(insert[1]).toEqual(expect.arrayContaining([5, 7, 'docente', 'acceso_denegado']));
  });
});

describe('requiereAdminOEquipo', () => {
  test('admin pasa (configuración)', () => {
    const next = jest.fn();
    requiereAdminOEquipo('lider')({ usuario: { rol: 'admin', colegio_id: 5 }, bienestar: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
  test('director no pasa', () => {
    const res = mockRes();
    requiereAdminOEquipo('lider')({ usuario: { rol: 'director', colegio_id: 5 }, bienestar: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('casoAccesible', () => {
  const caso = { id: 10, colegio_id: 5, responsable_id: 3 };

  test('admin NUNCA accede a un caso', async () => {
    expect(await casoAccesible({ usuario: { id: 2, rol: 'admin', colegio_id: 5 }, bienestar: { nivel: null } }, 10)).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('docente NUNCA accede a un caso', async () => {
    expect(await casoAccesible({ usuario: { id: 4, rol: 'docente', colegio_id: 5 }, bienestar: { nivel: null } }, 10)).toBeNull();
  });

  test('orientador de OTRO colegio no ve el caso (se filtra por su colegio)', async () => {
    db.query.mockResolvedValueOnce([[]]); // el caso no existe en el colegio 8
    const r = await casoAccesible({ usuario: { id: 3, rol: 'orientador', colegio_id: 8 }, bienestar: { nivel: 'lider' } }, 10);
    expect(r).toBeNull();
    expect(db.query.mock.calls[0][1]).toEqual([10, 8]);
  });

  test('líder ve cualquier caso de su colegio', async () => {
    db.query.mockResolvedValueOnce([[caso]]);
    expect(await casoAccesible({ usuario: { id: 9, rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'lider' } }, 10)).toEqual(caso);
  });

  test('profesional responsable ve su caso', async () => {
    db.query.mockResolvedValueOnce([[caso]]);
    expect(await casoAccesible({ usuario: { id: 3, rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'profesional' } }, 10)).toEqual(caso);
  });

  test('profesional NO asignado no ve el caso', async () => {
    db.query.mockResolvedValueOnce([[caso]]).mockResolvedValueOnce([[]]);
    expect(await casoAccesible({ usuario: { id: 6, rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'profesional' } }, 10)).toBeNull();
  });

  test('profesional con asignación vigente sí lo ve', async () => {
    db.query.mockResolvedValueOnce([[caso]]).mockResolvedValueOnce([[{ 1: 1 }]]);
    expect(await casoAccesible({ usuario: { id: 6, rol: 'orientador', colegio_id: 5 }, bienestar: { nivel: 'profesional' } }, 10)).toEqual(caso);
  });
});
