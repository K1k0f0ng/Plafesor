const db = require('../database');
const { obtenerMotivos } = require('../utils/motivoRetiro');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/motivos-retiro
async function listar(req, res) {
  try {
    const motivos = await obtenerMotivos(req.usuario.colegio_id);
    res.json({ data: motivos });
  } catch (err) {
    console.error('Error al listar motivos de retiro:', err);
    res.status(500).json({ error: 'Error al obtener el catálogo de motivos de retiro' });
  }
}

// POST /api/motivos-retiro — body: { nombre }
async function crear(req, res) {
  const { nombre } = req.body;
  const colegio_id = req.usuario.colegio_id;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del motivo es obligatorio' });
  }
  try {
    const actuales = await obtenerMotivos(colegio_id);
    const siguienteOrden = actuales.length > 0 ? Math.max(...actuales.map(m => m.orden)) + 1 : 0;
    const [result] = await db.query(
      'INSERT INTO motivos_retiro (colegio_id, nombre, orden) VALUES (?, ?, ?)',
      [colegio_id, nombre.trim(), siguienteOrden]
    );
    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'motivo_retiro_editado', entidad: 'motivo_retiro', entidad_id: result.insertId,
      detalle: { nombre: nombre.trim(), tipo: 'creado' },
    });
    res.status(201).json({ mensaje: 'Motivo de retiro creado', data: { id: result.insertId, nombre: nombre.trim() } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un motivo con ese nombre' });
    }
    console.error('Error al crear motivo de retiro:', err);
    res.status(500).json({ error: 'Error al crear el motivo de retiro' });
  }
}

// PUT /api/motivos-retiro/:id — body: { nombre?, activo? }
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, activo } = req.body;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[motivo]] = await db.query(
      'SELECT id FROM motivos_retiro WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!motivo) return res.status(404).json({ error: 'Motivo de retiro no encontrado' });

    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del motivo no puede quedar vacío' });
    }

    const campos = [];
    const valores = [];
    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre.trim()); }
    if (activo !== undefined) { campos.push('activo = ?'); valores.push(!!activo); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    await db.query(
      `UPDATE motivos_retiro SET ${campos.join(', ')} WHERE id = ? AND colegio_id = ?`,
      [...valores, id, colegio_id]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'motivo_retiro_editado', entidad: 'motivo_retiro', entidad_id: parseInt(id),
      detalle: { nombre: nombre !== undefined ? nombre.trim() : undefined, tipo: activo === false ? 'desactivado' : 'editado' },
    });

    res.json({ mensaje: 'Motivo de retiro actualizado' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un motivo con ese nombre' });
    }
    console.error('Error al actualizar motivo de retiro:', err);
    res.status(500).json({ error: 'Error al actualizar el motivo de retiro' });
  }
}

module.exports = { listar, crear, actualizar };
