const { permitirRoles } = require('./auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('permitirRoles', () => {
  test('rechaza con 401 si no hay usuario autenticado', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    permitirRoles('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza con 403 si el rol del usuario no está permitido', () => {
    const req = { usuario: { rol: 'estudiante' } };
    const res = mockRes();
    const next = jest.fn();

    permitirRoles('admin', 'director')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('deja pasar si el rol del usuario está permitido', () => {
    const req = { usuario: { rol: 'docente' } };
    const res = mockRes();
    const next = jest.fn();

    permitirRoles('admin', 'docente')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
