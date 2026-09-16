const db = require('../database');
const { obtenerSemanaAcademica } = require('../utils/semanaAcademica');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/semana-academica
async function listar(req, res) {
  try {
    const dias = await obtenerSemanaAcademica(req.usuario.colegio_id);
    res.json({ data: dias });
  } catch (err) {
    console.error('Error al listar la semana académica:', err);
    res.status(500).json({ error: 'Error al obtener la semana académica' });
  }
}

// PUT /api/semana-academica/:id — body: { nombre?, activo? }
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, activo } = req.body;
  const colegio_id = req.usuario.colegio_id;

  try {
    const [[dia]] = await db.query(
      'SELECT id FROM semana_academica WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!dia) return res.status(404).json({ error: 'Día no encontrado' });
    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del día no puede quedar vacío' });
    }

    const campos = [];
    const valores = [];
    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre.trim()); }
    if (activo !== undefined) { campos.push('activo = ?'); valores.push(!!activo); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    await db.query(
      `UPDATE semana_academica SET ${campos.join(', ')} WHERE id = ? AND colegio_id = ?`,
      [...valores, id, colegio_id]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'semana_academica_editada', entidad: 'semana_academica', entidad_id: parseInt(id),
      detalle: { nombre, activo },
    });

    res.json({ mensaje: 'Día actualizado' });
  } catch (err) {
    console.error('Error al actualizar la semana académica:', err);
    res.status(500).json({ error: 'Error al actualizar el día' });
  }
}

module.exports = { listar, actualizar };
