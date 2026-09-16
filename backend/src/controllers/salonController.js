const db = require('../database');
const { obtenerSalones } = require('../utils/salones');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/salones
async function listar(req, res) {
  try {
    const salones = await obtenerSalones(req.usuario.colegio_id);
    res.json({ data: salones });
  } catch (err) {
    console.error('Error al listar salones:', err);
    res.status(500).json({ error: 'Error al obtener los salones' });
  }
}

// POST /api/salones — body: { nombre, permite_clases_simultaneas }
async function crear(req, res) {
  const { nombre, permite_clases_simultaneas } = req.body;
  const colegio_id = req.usuario.colegio_id;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del salón es obligatorio' });
  }
  try {
    const actuales = await obtenerSalones(colegio_id);
    const siguienteOrden = actuales.length > 0 ? Math.max(...actuales.map(s => s.orden)) + 1 : 0;
    const [result] = await db.query(
      'INSERT INTO salones (colegio_id, nombre, permite_clases_simultaneas, orden) VALUES (?, ?, ?, ?)',
      [colegio_id, nombre.trim(), !!permite_clases_simultaneas, siguienteOrden]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'salon_editado', entidad: 'salon', entidad_id: result.insertId,
      detalle: { nombre: nombre.trim(), tipo: 'creado' },
    });

    res.status(201).json({ mensaje: 'Salón creado', data: { id: result.insertId, nombre: nombre.trim() } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un salón con ese nombre' });
    }
    console.error('Error al crear salón:', err);
    res.status(500).json({ error: 'Error al crear el salón' });
  }
}

// PUT /api/salones/:id — body: { nombre?, permite_clases_simultaneas?, activo? }
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, permite_clases_simultaneas, activo } = req.body;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[salon]] = await db.query(
      'SELECT id FROM salones WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!salon) return res.status(404).json({ error: 'Salón no encontrado' });
    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del salón no puede quedar vacío' });
    }

    const campos = [];
    const valores = [];
    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre.trim()); }
    if (permite_clases_simultaneas !== undefined) { campos.push('permite_clases_simultaneas = ?'); valores.push(!!permite_clases_simultaneas); }
    if (activo !== undefined) { campos.push('activo = ?'); valores.push(!!activo); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    await db.query(
      `UPDATE salones SET ${campos.join(', ')} WHERE id = ? AND colegio_id = ?`,
      [...valores, id, colegio_id]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'salon_editado', entidad: 'salon', entidad_id: parseInt(id),
      detalle: { nombre, tipo: activo === false ? 'desactivado' : 'editado' },
    });

    res.json({ mensaje: 'Salón actualizado' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un salón con ese nombre' });
    }
    console.error('Error al actualizar salón:', err);
    res.status(500).json({ error: 'Error al actualizar el salón' });
  }
}

module.exports = { listar, crear, actualizar };
