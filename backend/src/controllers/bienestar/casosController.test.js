jest.mock('../../database');
const db = require('../../database');
const casos = require('./casosController');
const seguimientos = require('./seguimientosController');
const { adjuntoAccesible } = require('./adjuntosController');
const { cifrar } = require('../../utils/cifrado');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockConn() {
  return { query: jest.fn().mockResolvedValue([{ insertId: 500, affectedRows: 1 }]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
}

const LIDER = { id: 9, rol: 'orientador', colegio_id: 5 };
const PROF = { id: 6, rol: 'orientador', colegio_id: 5 };
const ctxLider = (config = {}) => ({ nivel: 'lider', activo: true, config });
const ctxProf = { nivel: 'profesional', activo: true, config: {} };
const CASO = { id: 10, colegio_id: 5, estudiante_id: 20, responsable_id: 3, estado: 'en_seguimiento' };

const original = process.env.BIENESTAR_CLAVE_CIFRADO;
process.env.BIENESTAR_CLAVE_CIFRADO = 'e'.repeat(64);   // los datos de prueba se cifran al cargar el archivo
let conn;
beforeEach(() => {
  process.env.BIENESTAR_CLAVE_CIFRADO = 'e'.repeat(64);
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
  conn = mockConn();
  db.getConnection = jest.fn().mockResolvedValue(conn);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env.BIENESTAR_CLAVE_CIFRADO = original;
  console.error.mockRestore();
});
const auditorias = () => db.query.mock.calls.filter(c => String(c[0]).includes('bienestar_auditoria')).map(c => c[1][3]);

describe('abrir caso', () => {
  const cuerpo = { estudiante_id: 20, motivo_id: 3, prioridad: 'media', responsable_id: 99 };

  test('un profesional no puede abrir un caso a nombre de otro: queda como responsable él mismo', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 20 }]])      // estudiante
      .mockResolvedValueOnce([[{ id: 3 }]])       // motivo
      .mockResolvedValueOnce([[]]);               // no hay caso abierto
    const res = mockRes();
    await casos.abrir({ usuario: PROF, bienestar: ctxProf, body: cuerpo }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const insert = conn.query.mock.calls.find(c => String(c[0]).includes('INSERT INTO bienestar_casos'));
    expect(insert[1][2]).toBe(6);
  });

  test('no permite un segundo caso abierto para el mismo estudiante', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 20 }]])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([[{ id: 77 }]]);     // ya tiene uno abierto
    const res = mockRes();
    await casos.abrir({ usuario: LIDER, bienestar: ctxLider(), body: { ...cuerpo, responsable_id: undefined } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].caso_id).toBe(77);
  });

  test('estudiante de otro colegio → no encontrado', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = mockRes();
    await casos.abrir({ usuario: LIDER, bienestar: ctxLider(), body: cuerpo }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.query.mock.calls[0][1]).toEqual([20, 5]);
  });

  test('una remisión de otro estudiante no se puede usar para abrir el caso', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 20 }]])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 8, estudiante_id: 21, estado: 'recibida' }]]);
    const res = mockRes();
    await casos.abrir({ usuario: LIDER, bienestar: ctxLider(), body: { ...cuerpo, responsable_id: undefined, remision_id: 8 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('ver caso', () => {
  test('sin acceso → 404 y queda en bitácora', async () => {
    db.query.mockResolvedValueOnce([[]]);   // caso no existe en su colegio
    const res = mockRes();
    await casos.detalle({ usuario: PROF, bienestar: ctxProf, params: { id: '10' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(auditorias()).toContain('acceso_denegado');
  });

  test('el detalle NUNCA trae el texto de la nota privada', async () => {
    const segCifrado = { id: 1, caso_id: 10, autor_id: 3, fecha: '2026-09-24 10:00', resumen: cifrar('Resumen visible'), nota_privada: cifrar('TEXTO MUY PRIVADO'), participantes: '[]' };
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM bienestar_casos WHERE id = ? AND colegio_id = ?')) return [[CASO]];
      if (sql.includes('FROM bienestar_seguimientos s')) return [[segCifrado]];
      if (sql.includes('bienestar_caso_asignaciones WHERE caso_id = ? AND usuario_id')) return [[]];
      return [[{}]];
    });
    const res = mockRes();
    await casos.detalle({ usuario: LIDER, bienestar: ctxLider(), params: { id: '10' } }, res);
    const salida = JSON.stringify(res.json.mock.calls[0][0]);
    expect(salida).toContain('Resumen visible');
    expect(salida).not.toContain('TEXTO MUY PRIVADO');
    expect(res.json.mock.calls[0][0].data.seguimientos[0].tiene_nota_privada).toBe(true);
    expect(res.json.mock.calls[0][0].data.seguimientos[0].puede_ver_nota).toBe(false); // líder sin permiso del colegio
  });

  test('el director solo recibe estado genérico, sin motivo', async () => {
    db.query.mockResolvedValueOnce([[{ id: 10, estado: 'en_seguimiento', estudiante: 'Ana', responsable: 'Orient' }]]);
    const res = mockRes();
    await casos.estadoParaDirector({ usuario: { id: 2, rol: 'director', colegio_id: 5 }, bienestar: { activo: true } }, res);
    const fila = res.json.mock.calls[0][0].data[0];
    expect(fila.estado).toBe('en_acompanamiento');
    expect(fila).not.toHaveProperty('motivo');
    expect(db.query.mock.calls[0][0]).not.toMatch(/motivo|resumen|antecedentes|nota_privada/);
  });
});

describe('nota privada', () => {
  const seg = { id: 1, caso_id: 10, autor_id: 3, nota_privada: cifrar('nota') };

  function preparar({ asignado = false } = {}) {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM bienestar_seguimientos WHERE id')) return [[seg]];
      if (sql.includes('FROM bienestar_casos WHERE id = ? AND colegio_id = ?')) return [[CASO]];
      if (sql.includes('bienestar_caso_asignaciones')) return [asignado ? [{ 1: 1 }] : []];
      return [[]];
    });
  }

  test('líder sin permiso del colegio → 403', async () => {
    preparar();
    const res = mockRes();
    await seguimientos.notaPrivada({ usuario: LIDER, bienestar: ctxLider({ lider_lee_privadas: 0 }), params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(auditorias()).toContain('acceso_denegado');
  });

  test('líder con permiso del colegio → la lee y queda registrado', async () => {
    preparar();
    const res = mockRes();
    await seguimientos.notaPrivada({ usuario: LIDER, bienestar: ctxLider({ lider_lee_privadas: 1 }), params: { id: '1' } }, res);
    expect(res.json.mock.calls[0][0].data.nota_privada).toBe('nota');
    expect(auditorias()).toContain('nota_privada_ver');
  });

  test('el autor siempre la lee', async () => {
    preparar();
    const res = mockRes();
    await seguimientos.notaPrivada({ usuario: { id: 3, rol: 'orientador', colegio_id: 5 }, bienestar: ctxProf, params: { id: '1' } }, res);
    expect(res.json.mock.calls[0][0].data.nota_privada).toBe('nota');
  });

  test('profesional sin asignación al caso → no llega ni al caso', async () => {
    preparar({ asignado: false });
    const res = mockRes();
    await seguimientos.notaPrivada({ usuario: PROF, bienestar: ctxProf, params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('seguimientos y cierre', () => {
  test('solo el autor puede editar su seguimiento', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM bienestar_seguimientos WHERE id')) return [[{ id: 1, caso_id: 10, autor_id: 3 }]];
      if (sql.includes('FROM bienestar_casos WHERE id = ? AND colegio_id = ?')) return [[CASO]];
      return [[]];
    });
    const res = mockRes();
    await seguimientos.editar({ usuario: LIDER, bienestar: ctxLider(), params: { id: '1' }, body: { resumen: 'cambio' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('no se registran seguimientos en un caso cerrado', async () => {
    db.query.mockResolvedValueOnce([[{ ...CASO, estado: 'cerrado' }]]);
    const res = mockRes();
    await seguimientos.crear({ usuario: LIDER, bienestar: ctxLider(), params: { id: '10' }, body: { fecha: '2026-09-24T10:00', resumen: 'Algo', tipo_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('el resumen es obligatorio', async () => {
    const res = mockRes();
    await seguimientos.crear({ usuario: LIDER, bienestar: ctxLider(), params: { id: '10' }, body: { fecha: '2026-09-24T10:00', tipo_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('guarda el resumen y la nota privada cifrados', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM bienestar_casos WHERE id = ? AND colegio_id = ?')) return [[CASO]];
      if (sql.includes('FROM bienestar_catalogos')) return [[{ id: 1 }]];
      return [[]];
    });
    const res = mockRes();
    await seguimientos.crear({
      usuario: LIDER, bienestar: ctxLider(), params: { id: '10' },
      body: { fecha: '2026-09-24T10:00', tipo_id: 1, resumen: 'Resumen claro', nota_privada: 'Observación reservada',
        compromisos: [{ descripcion: 'Entregar tareas', responsable_tipo: 'estudiante' }] },
    }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const todo = JSON.stringify(conn.query.mock.calls);
    expect(todo).not.toContain('Resumen claro');
    expect(todo).not.toContain('Observación reservada');
    expect(todo).not.toContain('Entregar tareas');
  });

  test('cerrar exige motivo de cierre del catálogo', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM bienestar_casos WHERE id = ? AND colegio_id = ?')) return [[CASO]];
      return [[]];   // motivo de cierre no encontrado
    });
    const res = mockRes();
    await casos.cerrar({ usuario: LIDER, bienestar: ctxLider(), params: { id: '10' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('adjuntos', () => {
  test('un docente solo descarga lo que él mismo subió a su remisión', async () => {
    const docente = { usuario: { id: 4, rol: 'docente', colegio_id: 5 }, bienestar: { nivel: null } };
    expect(await adjuntoAccesible(docente, { remision_id: 8, subido_por: 4 })).toBe(true);
    expect(await adjuntoAccesible(docente, { remision_id: 8, subido_por: 9 })).toBe(false);
  });

  test('un docente nunca descarga documentos del caso', async () => {
    const docente = { usuario: { id: 4, rol: 'docente', colegio_id: 5 }, bienestar: { nivel: null } };
    expect(await adjuntoAccesible(docente, { caso_id: 10, subido_por: 4 })).toBe(false);
  });
});
