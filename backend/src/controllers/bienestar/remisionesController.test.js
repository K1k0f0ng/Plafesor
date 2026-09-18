jest.mock('../../database');
const db = require('../../database');
const ctrl = require('./remisionesController');
const { descifrar } = require('../../utils/cifrado');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const esperar = () => new Promise(r => setImmediate(r));

const DOCENTE = { id: 4, rol: 'docente', colegio_id: 5, nombre: 'Doc' };
const LIDER = { id: 9, rol: 'orientador', colegio_id: 5 };
const PROFESIONAL = { id: 6, rol: 'orientador', colegio_id: 5 };
const CUERPO_VALIDO = {
  estudiante_id: 20, motivo_id: 3, prioridad: 'alta',
  descripcion: 'Desde hace tres semanas no entrega tareas y se aísla en el descanso.',
};

const original = process.env.BIENESTAR_CLAVE_CIFRADO;
beforeEach(() => {
  process.env.BIENESTAR_CLAVE_CIFRADO = 'd'.repeat(64);
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env.BIENESTAR_CLAVE_CIFRADO = original;
  console.error.mockRestore();
});

function llamadasCon(texto) {
  return db.query.mock.calls.filter(c => String(c[0]).includes(texto));
}

describe('crear remisión', () => {
  test('docente no puede remitir a un estudiante que no es de sus grupos', async () => {
    db.query
      .mockResolvedValueOnce([[{ grupo_dirigido_id: null }]])   // docente
      .mockResolvedValueOnce([[]]);                              // estudiantes permitidos: ninguno
    const res = mockRes();
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: { remiten: 'todos' } }, body: CUERPO_VALIDO }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(llamadasCon('INSERT INTO bienestar_remisiones')).toHaveLength(0);
  });

  test('la búsqueda de estudiantes siempre filtra por el colegio de la sesión', async () => {
    db.query.mockResolvedValueOnce([[{ grupo_dirigido_id: null }]]).mockResolvedValueOnce([[]]);
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: { remiten: 'todos' } }, body: CUERPO_VALIDO }, mockRes());
    const consulta = db.query.mock.calls[1];
    expect(consulta[1].slice(0, 2)).toEqual([5, 5]);
    expect(consulta[1]).toContain(4);   // id del docente para sus grupos
  });

  test('con "solo directores de grupo", el docente solo ve su grupo dirigido', async () => {
    db.query.mockResolvedValueOnce([[{ grupo_dirigido_id: 77 }]]).mockResolvedValueOnce([[]]);
    await ctrl.estudiantesDisponibles({ usuario: DOCENTE, bienestar: { activo: true, config: { remiten: 'directores_grupo' } } }, mockRes());
    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('AND g.id = ?');
    expect(sql).not.toContain('docente_grupos_materias');
    expect(params).toEqual([5, 5, 77]);
  });

  test('rechaza una descripción demasiado corta', async () => {
    const res = mockRes();
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: {} }, body: { ...CUERPO_VALIDO, descripcion: 'mal' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rechaza un motivo que no es del catálogo del colegio', async () => {
    db.query
      .mockResolvedValueOnce([[{ grupo_dirigido_id: null }]])
      .mockResolvedValueOnce([[{ id: 20, grupo_id: 30 }]])
      .mockResolvedValueOnce([[]]);                               // motivo no encontrado en colegio 5
    const res = mockRes();
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: {} }, body: CUERPO_VALIDO }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query.mock.calls[2][1]).toEqual([3, 5]);
  });

  test('guarda la descripción CIFRADA y notifica al equipo sin contenido', async () => {
    db.query
      .mockResolvedValueOnce([[{ grupo_dirigido_id: null }]])
      .mockResolvedValueOnce([[{ id: 20, grupo_id: 30 }]])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([{ insertId: 101 }])                 // INSERT remisión
      .mockResolvedValueOnce([[]])                                // bitácora
      .mockResolvedValueOnce([[{ usuario_id: 9 }]])               // equipo
      .mockResolvedValue([[]]);
    const res = mockRes();
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: {} }, body: CUERPO_VALIDO }, res);
    await esperar();

    expect(res.status).toHaveBeenCalledWith(201);
    const [, params] = llamadasCon('INSERT INTO bienestar_remisiones')[0];
    expect(params.join(' ')).not.toContain('no entrega tareas');
    expect(descifrar(params[5])).toBe(CUERPO_VALIDO.descripcion);

    const notif = llamadasCon('INSERT IGNORE INTO notificaciones')[0];
    expect(JSON.stringify(notif[1])).not.toContain('tareas');
    expect(JSON.stringify(notif[1])).not.toContain('Doc');
  });

  test('sin clave de cifrado no guarda nada en texto plano', async () => {
    delete process.env.BIENESTAR_CLAVE_CIFRADO;
    db.query
      .mockResolvedValueOnce([[{ grupo_dirigido_id: null }]])
      .mockResolvedValueOnce([[{ id: 20, grupo_id: 30 }]])
      .mockResolvedValueOnce([[{ id: 3 }]]);
    const res = mockRes();
    await ctrl.crear({ usuario: DOCENTE, bienestar: { activo: true, config: {} }, body: CUERPO_VALIDO }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(llamadasCon('INSERT INTO bienestar_remisiones')).toHaveLength(0);
  });
});

describe('mis remisiones (remitente)', () => {
  test('ve estado simplificado y nunca quién la atiende', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1, creado_en: '2026-09-24', estado: 'en_seguimiento', prioridad: 'alta',
      descripcion: null, devolucion: null, estudiante: 'Ana', grupo: 'A', grado: '7', motivo: 'Otro',
    }]]);
    const res = mockRes();
    await ctrl.mias({ usuario: DOCENTE, bienestar: { config: {} } }, res);
    const fila = res.json.mock.calls[0][0].data[0];
    expect(fila.estado).toBe('en_atencion');
    expect(fila).not.toHaveProperty('recibida_por');
    expect(fila).not.toHaveProperty('caso_id');
    expect(db.query.mock.calls[0][1]).toEqual([5, 4]);   // solo las suyas, de su colegio
  });

  test('no ve la devolución si el colegio no la habilitó', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, estado: 'recibida', devolucion: 'v1:xxx', descripcion: null }]]);
    const res = mockRes();
    await ctrl.mias({ usuario: DOCENTE, bienestar: { config: { devolucion_docente: 0 } } }, res);
    expect(res.json.mock.calls[0][0].data[0].devolucion).toBeNull();
  });
});

describe('bandeja y acciones del equipo', () => {
  test('profesional: la consulta limita a pendientes, las suyas y sus casos', async () => {
    await ctrl.bandeja({ usuario: PROFESIONAL, bienestar: { nivel: 'profesional' }, query: {} }, mockRes());
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("r.estado = 'pendiente' OR r.recibida_por = ?");
    expect(params).toEqual([5, 6, 6, 6]);
  });

  test('líder: ve todas las del colegio', async () => {
    await ctrl.bandeja({ usuario: LIDER, bienestar: { nivel: 'lider' }, query: {} }, mockRes());
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).not.toContain('r.recibida_por = ?');
    expect(params).toEqual([5]);
  });

  test('una remisión de otro colegio o no visible → 404 y queda registrado', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = mockRes();
    await ctrl.detalle({ usuario: PROFESIONAL, bienestar: { nivel: 'profesional' }, params: { id: '50' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.query.mock.calls[0][1].slice(0, 2)).toEqual([50, 5]);
    expect(llamadasCon('bienestar_auditoria')[0][1]).toContain('acceso_denegado');
  });

  test('si otro orientador la recibió al mismo tiempo → 409', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 8, estado: 'pendiente', remitente_id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = mockRes();
    await ctrl.recibir({ usuario: LIDER, bienestar: { nivel: 'lider' }, params: { id: '8' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('recibir notifica al remitente sin contenido', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 8, estado: 'pendiente', remitente_id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValue([[]]);
    const res = mockRes();
    await ctrl.recibir({ usuario: LIDER, bienestar: { nivel: 'lider' }, params: { id: '8' } }, res);
    await esperar();
    const notif = llamadasCon('INSERT IGNORE INTO notificaciones')[0];
    expect(notif[1][0][0]).toEqual([4, 'bienestar_remision', 'remision_recibida_8', 'Tu remisión fue recibida por orientación', null]);
  });

  test('devolución bloqueada si el colegio no la habilitó', async () => {
    const res = mockRes();
    await ctrl.devolucion({ usuario: LIDER, bienestar: { nivel: 'lider', config: { devolucion_docente: 0 } }, params: { id: '8' }, body: { texto: 'Sugerencia para el aula' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('archivar exige motivo', async () => {
    const res = mockRes();
    await ctrl.archivar({ usuario: LIDER, bienestar: { nivel: 'lider' }, params: { id: '8' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
