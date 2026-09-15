const db = require('../database');
const { obtenerGrados, NIVEL_LABEL } = require('../utils/gradoAcademico');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/grados-academicos
async function listar(req, res) {
  try {
    const grados = await obtenerGrados(req.usuario.colegio_id);
    const conEtiqueta = grados.map(g => ({ ...g, nivel_label: NIVEL_LABEL[g.nivel] || g.nivel }));
    res.json({ data: conEtiqueta });
  } catch (err) {
    console.error('Error al obtener los grados académicos:', err);
    res.status(500).json({ error: 'Error al obtener los grados académicos' });
  }
}

// PUT /api/grados-academicos/:id
// Solo se edita lo que el colegio puede personalizar: nombre y límites.
// El código, nivel y orden quedan fijos porque de ahí depende la promoción
// de año lectivo y la relación con los grupos ya creados.
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, intensidad_horaria, max_tareas, max_evaluaciones } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  try {
    const [[grado]] = await db.query(
      'SELECT id FROM grados_academicos WHERE id = ? AND colegio_id = ?',
      [id, req.usuario.colegio_id]
    );
    if (!grado) return res.status(404).json({ error: 'Grado no encontrado' });

    await db.query(
      `UPDATE grados_academicos
       SET nombre = ?, intensidad_horaria = ?, max_tareas = ?, max_evaluaciones = ?
       WHERE id = ?`,
      [nombre.trim(), intensidad_horaria || null, max_tareas || null, max_evaluaciones || null, id]
    );

    registrarAuditoria({
      colegio_id: req.usuario.colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'grado_academico_editado', entidad: 'grado_academico', entidad_id: parseInt(id),
      detalle: { nombre, intensidad_horaria, max_tareas, max_evaluaciones },
    });

    res.json({ mensaje: 'Grado académico actualizado' });
  } catch (err) {
    console.error('Error al actualizar el grado académico:', err);
    res.status(500).json({ error: 'Error al actualizar el grado académico' });
  }
}

module.exports = { listar, actualizar };
