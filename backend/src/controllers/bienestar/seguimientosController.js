const db = require('../../database');
const { cifrar, descifrar } = require('../../utils/cifrado');
const { registrarBienestar } = require('../../utils/bienestarAuditoria');
const { casoAccesible } = require('../../middlewares/bienestarAcceso');
const { puedeVerNotaPrivada, ABIERTOS, manejarError, catalogoValido } = require('./casosController');

// Seguimientos (incluyen las sesiones) y compromisos de un caso (Fase 4).
// Ver docs/BIENESTAR_MAPA_FUNCIONAL.md §4.4 y §4.5.

const RESPONSABLES = ['estudiante', 'familia', 'docente', 'orientacion', 'otro'];
const ESTADOS_COMPROMISO = ['pendiente', 'cumplido', 'incumplido', 'cancelado'];
const MAX = { texto: 4000, nota: 8000, compromiso: 500, participante: 100 };

function t(v, max) {
  if (v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > max ? null : s;
}
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const esFechaHora = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(v);

function participantesValidos(v) {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 15) return null;
  const lista = v.map(p => String(p || '').trim()).filter(Boolean);
  return lista.some(p => p.length > MAX.participante) ? null : lista;
}

function validarCompromiso(k) {
  const descripcion = t(k?.descripcion, MAX.compromiso);
  if (!descripcion) return { error: 'Cada compromiso necesita una descripción (máximo 500 caracteres)' };
  const responsable = RESPONSABLES.includes(k.responsable_tipo) ? k.responsable_tipo : null;
  if (!responsable) return { error: 'Responsable del compromiso inválido' };
  if (k.fecha_limite && !esFecha(k.fecha_limite)) return { error: 'Fecha límite inválida' };
  return { descripcion, responsable, fecha: k.fecha_limite || null, visible: k.visible_familia === true };
}

async function casoEditable(req, res, casoId) {
  const caso = await casoAccesible(req, casoId);
  if (!caso) { registrarBienestar(req, 'acceso_denegado', 'caso', casoId); res.status(404).json({ error: 'Caso no encontrado' }); return null; }
  if (!ABIERTOS.includes(caso.estado)) { res.status(409).json({ error: 'El caso está cerrado' }); return null; }
  return caso;
}

// POST /api/bienestar/casos/:id/seguimientos
// body: { fecha, tipo_id, participantes[], motivo, resumen, acuerdos, proxima_accion, proxima_fecha, nota_privada, compromisos[] }
async function crear(req, res) {
  const casoId = parseInt(req.params.id);
  const b = req.body || {};
  const campos = {
    motivo: t(b.motivo, MAX.texto), resumen: t(b.resumen, MAX.texto), acuerdos: t(b.acuerdos, MAX.texto),
    proxima_accion: t(b.proxima_accion, MAX.texto), nota_privada: t(b.nota_privada, MAX.nota),
  };
  const participantes = participantesValidos(b.participantes);
  const compromisos = Array.isArray(b.compromisos) ? b.compromisos : [];

  if (!esFechaHora(b.fecha)) return res.status(400).json({ error: 'Indica la fecha y hora del seguimiento' });
  if (!campos.resumen) return res.status(400).json({ error: 'El resumen profesional es obligatorio' });
  if (Object.values(campos).includes(null)) return res.status(400).json({ error: 'Algún texto supera el tamaño permitido' });
  if (participantes === null) return res.status(400).json({ error: 'Lista de participantes inválida' });
  if (b.proxima_fecha && !esFecha(b.proxima_fecha)) return res.status(400).json({ error: 'Próxima fecha inválida' });
  if (compromisos.length > 20) return res.status(400).json({ error: 'Máximo 20 compromisos por seguimiento' });
  const compValidos = compromisos.map(validarCompromiso);
  const errComp = compValidos.find(c => c.error);
  if (errComp) return res.status(400).json({ error: errComp.error });

  try {
    const caso = await casoEditable(req, res, casoId);
    if (!caso) return;
    const tipoId = parseInt(b.tipo_id);
    if (!(await catalogoValido(req.usuario.colegio_id, tipoId, 'tipo_seguimiento'))) {
      return res.status(400).json({ error: 'Selecciona el tipo de seguimiento' });
    }

    const conn = await db.getConnection();
    let segId;
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT INTO bienestar_seguimientos
           (caso_id, colegio_id, autor_id, fecha, tipo_id, participantes, motivo, resumen, acuerdos, proxima_accion, proxima_fecha, nota_privada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [casoId, caso.colegio_id, req.usuario.id, b.fecha.replace('T', ' '), tipoId, JSON.stringify(participantes || []),
          cifrar(campos.motivo), cifrar(campos.resumen), cifrar(campos.acuerdos), cifrar(campos.proxima_accion),
          b.proxima_fecha || null, cifrar(campos.nota_privada)]
      );
      segId = ins.insertId;
      for (const k of compValidos) {
        await conn.query(
          `INSERT INTO bienestar_compromisos (caso_id, seguimiento_id, descripcion, responsable_tipo, fecha_limite, visible_familia)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [casoId, segId, cifrar(k.descripcion), k.responsable, k.fecha, k.visible]
        );
      }
      // El primer seguimiento pasa el caso de "abierto" a "en seguimiento"
      if (caso.estado === 'abierto') {
        await conn.query(`UPDATE bienestar_casos SET estado = 'en_seguimiento' WHERE id = ?`, [casoId]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    registrarBienestar(req, 'seguimiento_creado', 'seguimiento', segId, casoId);
    res.status(201).json({ mensaje: 'Seguimiento registrado', data: { id: segId } });
  } catch (err) {
    manejarError(res, err, 'Error al registrar el seguimiento');
  }
}

// PATCH /api/bienestar/seguimientos/:id — solo el autor, con el caso abierto
async function editar(req, res) {
  const id = parseInt(req.params.id);
  const b = req.body || {};
  try {
    const [[seg]] = await db.query('SELECT * FROM bienestar_seguimientos WHERE id = ? AND colegio_id = ?', [id, req.usuario.colegio_id]);
    if (!seg) return res.status(404).json({ error: 'Seguimiento no encontrado' });
    const caso = await casoEditable(req, res, seg.caso_id);
    if (!caso) return;
    if (seg.autor_id !== req.usuario.id) return res.status(403).json({ error: 'Solo quien registró el seguimiento puede editarlo' });

    const cambios = []; const valores = [];
    if (b.fecha !== undefined) {
      if (!esFechaHora(b.fecha)) return res.status(400).json({ error: 'Fecha inválida' });
      cambios.push('fecha = ?'); valores.push(b.fecha.replace('T', ' '));
    }
    if (b.tipo_id !== undefined) {
      if (!(await catalogoValido(req.usuario.colegio_id, parseInt(b.tipo_id), 'tipo_seguimiento'))) return res.status(400).json({ error: 'Tipo inválido' });
      cambios.push('tipo_id = ?'); valores.push(parseInt(b.tipo_id));
    }
    const part = participantesValidos(b.participantes);
    if (part === null) return res.status(400).json({ error: 'Lista de participantes inválida' });
    if (part !== undefined) { cambios.push('participantes = ?'); valores.push(JSON.stringify(part)); }
    if (b.proxima_fecha !== undefined) {
      if (b.proxima_fecha && !esFecha(b.proxima_fecha)) return res.status(400).json({ error: 'Próxima fecha inválida' });
      cambios.push('proxima_fecha = ?'); valores.push(b.proxima_fecha || null);
    }
    for (const [campo, max] of [['motivo', MAX.texto], ['resumen', MAX.texto], ['acuerdos', MAX.texto], ['proxima_accion', MAX.texto], ['nota_privada', MAX.nota]]) {
      const v = t(b[campo], max);
      if (v === null) return res.status(400).json({ error: 'Algún texto supera el tamaño permitido' });
      if (campo === 'resumen' && v === '') return res.status(400).json({ error: 'El resumen profesional es obligatorio' });
      if (v !== undefined) { cambios.push(`${campo} = ?`); valores.push(cifrar(v)); }
    }
    if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });

    await db.query(`UPDATE bienestar_seguimientos SET ${cambios.join(', ')} WHERE id = ?`, [...valores, id]);
    registrarBienestar(req, 'seguimiento_editado', 'seguimiento', id, seg.caso_id);
    res.json({ mensaje: 'Seguimiento actualizado' });
  } catch (err) {
    manejarError(res, err, 'Error al actualizar el seguimiento');
  }
}

// GET /api/bienestar/seguimientos/:id/nota-privada — siempre queda en bitácora
async function notaPrivada(req, res) {
  const id = parseInt(req.params.id);
  try {
    const [[seg]] = await db.query('SELECT * FROM bienestar_seguimientos WHERE id = ? AND colegio_id = ?', [id, req.usuario.colegio_id]);
    const caso = seg ? await casoAccesible(req, seg.caso_id) : null;
    if (!seg || !caso || !(await puedeVerNotaPrivada(req, caso, seg))) {
      registrarBienestar(req, 'acceso_denegado', 'nota_privada', id, seg?.caso_id || null);
      return res.status(403).json({ error: 'No tienes acceso a esta nota privada' });
    }
    registrarBienestar(req, 'nota_privada_ver', 'seguimiento', id, seg.caso_id);
    res.json({ data: { nota_privada: descifrar(seg.nota_privada) } });
  } catch (err) {
    manejarError(res, err, 'Error al obtener la nota privada');
  }
}

// POST /api/bienestar/casos/:id/compromisos  body: { descripcion, responsable_tipo, fecha_limite?, visible_familia? }
async function crearCompromiso(req, res) {
  const casoId = parseInt(req.params.id);
  const k = validarCompromiso(req.body || {});
  if (k.error) return res.status(400).json({ error: k.error });
  try {
    const caso = await casoEditable(req, res, casoId);
    if (!caso) return;
    const [ins] = await db.query(
      `INSERT INTO bienestar_compromisos (caso_id, descripcion, responsable_tipo, fecha_limite, visible_familia) VALUES (?, ?, ?, ?, ?)`,
      [casoId, cifrar(k.descripcion), k.responsable, k.fecha, k.visible]
    );
    registrarBienestar(req, 'compromiso_creado', 'compromiso', ins.insertId, casoId);
    res.status(201).json({ mensaje: 'Compromiso agregado', data: { id: ins.insertId } });
  } catch (err) {
    manejarError(res, err, 'Error al crear el compromiso');
  }
}

// PATCH /api/bienestar/compromisos/:id  body: { estado?, descripcion?, fecha_limite?, visible_familia? }
async function editarCompromiso(req, res) {
  const id = parseInt(req.params.id);
  const b = req.body || {};
  try {
    const [[k]] = await db.query(
      `SELECT k.* FROM bienestar_compromisos k JOIN bienestar_casos c ON c.id = k.caso_id
       WHERE k.id = ? AND c.colegio_id = ?`,
      [id, req.usuario.colegio_id]
    );
    if (!k) return res.status(404).json({ error: 'Compromiso no encontrado' });
    const caso = await casoEditable(req, res, k.caso_id);
    if (!caso) return;

    const cambios = []; const valores = [];
    if (b.estado !== undefined) {
      if (!ESTADOS_COMPROMISO.includes(b.estado)) return res.status(400).json({ error: 'Estado inválido' });
      cambios.push('estado = ?'); valores.push(b.estado);
    }
    if (b.descripcion !== undefined) {
      const d = t(b.descripcion, MAX.compromiso);
      if (!d) return res.status(400).json({ error: 'Descripción inválida' });
      cambios.push('descripcion = ?'); valores.push(cifrar(d));
    }
    if (b.fecha_limite !== undefined) {
      if (b.fecha_limite && !esFecha(b.fecha_limite)) return res.status(400).json({ error: 'Fecha inválida' });
      cambios.push('fecha_limite = ?'); valores.push(b.fecha_limite || null);
    }
    if (b.visible_familia !== undefined) { cambios.push('visible_familia = ?'); valores.push(b.visible_familia === true); }
    if (!cambios.length) return res.status(400).json({ error: 'No hay cambios' });

    await db.query(`UPDATE bienestar_compromisos SET ${cambios.join(', ')} WHERE id = ?`, [...valores, id]);
    registrarBienestar(req, 'compromiso_editado', 'compromiso', id, k.caso_id);
    res.json({ mensaje: 'Compromiso actualizado' });
  } catch (err) {
    manejarError(res, err, 'Error al actualizar el compromiso');
  }
}

module.exports = { crear, editar, notaPrivada, crearCompromiso, editarCompromiso };
