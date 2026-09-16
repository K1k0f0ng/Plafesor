const db = require('../database');
const { obtenerAreas } = require('../utils/areasAcademicas');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/areas-academicas
async function listar(req, res) {
  try {
    const areas = await obtenerAreas(req.usuario.colegio_id);
    res.json({ data: areas });
  } catch (err) {
    console.error('Error al listar áreas académicas:', err);
    res.status(500).json({ error: 'Error al obtener las áreas académicas' });
  }
}

// POST /api/areas-academicas — body: { codigo, nombre }
async function crear(req, res) {
  const { codigo, nombre } = req.body;
  const colegio_id = req.usuario.colegio_id;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del área es obligatorio' });
  }
  if (!codigo || !codigo.trim()) {
    return res.status(400).json({ error: 'El código del área es obligatorio' });
  }
  try {
    const actuales = await obtenerAreas(colegio_id);
    const siguienteOrden = actuales.length > 0 ? Math.max(...actuales.map(a => a.orden)) + 1 : 0;
    const [result] = await db.query(
      'INSERT INTO areas_academicas (colegio_id, codigo, nombre, orden) VALUES (?, ?, ?, ?)',
      [colegio_id, codigo.trim(), nombre.trim(), siguienteOrden]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'area_academica_editada', entidad: 'area_academica', entidad_id: result.insertId,
      detalle: { nombre: nombre.trim(), codigo: codigo.trim(), tipo: 'creada' },
    });

    res.status(201).json({ mensaje: 'Área creada', data: { id: result.insertId, codigo: codigo.trim(), nombre: nombre.trim() } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un área con ese nombre' });
    }
    console.error('Error al crear área académica:', err);
    res.status(500).json({ error: 'Error al crear el área' });
  }
}

// PUT /api/areas-academicas/:id — body: { codigo?, nombre?, activo? }
async function actualizar(req, res) {
  const { id } = req.params;
  const { codigo, nombre, activo } = req.body;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[area]] = await db.query(
      'SELECT id FROM areas_academicas WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!area) return res.status(404).json({ error: 'Área no encontrada' });
    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del área no puede quedar vacío' });
    }
    if (codigo !== undefined && !codigo.trim()) {
      return res.status(400).json({ error: 'El código del área no puede quedar vacío' });
    }

    const campos = [];
    const valores = [];
    if (codigo !== undefined) { campos.push('codigo = ?'); valores.push(codigo.trim()); }
    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre.trim()); }
    if (activo !== undefined) { campos.push('activo = ?'); valores.push(!!activo); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    await db.query(
      `UPDATE areas_academicas SET ${campos.join(', ')} WHERE id = ? AND colegio_id = ?`,
      [...valores, id, colegio_id]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'area_academica_editada', entidad: 'area_academica', entidad_id: parseInt(id),
      detalle: { nombre, codigo, tipo: activo === false ? 'desactivada' : 'editada' },
    });

    res.json({ mensaje: 'Área actualizada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un área con ese nombre' });
    }
    console.error('Error al actualizar área académica:', err);
    res.status(500).json({ error: 'Error al actualizar el área' });
  }
}

module.exports = { listar, crear, actualizar };
