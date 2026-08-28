const db = require('../database');
const { ordenApellido } = require('../utils/ordenNombre');

// GET /api/grupos — solo los grupos del colegio del admin
async function listar(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT g.*, c.nombre AS nombre_colegio,
             COUNT(eg.estudiante_id) AS total_estudiantes
      FROM grupos g
      JOIN colegios c ON c.id = g.colegio_id
      LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
      WHERE g.activo = TRUE AND g.colegio_id = ?
      GROUP BY g.id
      ORDER BY g.grado ASC, g.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar grupos:', err);
    res.status(500).json({ error: 'Error al obtener los grupos' });
  }
}

// POST /api/grupos — colegio_id viene del JWT, nunca del body
async function crear(req, res) {
  const { nombre, grado, ano_lectivo } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !grado) {
    return res.status(400).json({ error: 'Nombre y grado son obligatorios' });
  }
  if (!colegio_id) {
    return res.status(400).json({ error: 'Tu usuario no tiene un colegio asignado' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO grupos (nombre, grado, colegio_id, ano_lectivo) VALUES (?, ?, ?, ?)',
      [nombre, grado, colegio_id, ano_lectivo || 2025]
    );
    res.status(201).json({ mensaje: 'Grupo creado', data: { id: result.insertId, nombre, grado, colegio_id } });
  } catch (err) {
    console.error('Error al crear grupo:', err);
    res.status(500).json({ error: 'Error al crear el grupo' });
  }
}

// GET /api/grupos/:id/estudiantes
async function listarEstudiantes(req, res) {
  const { id } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre, u.email, u.activo
      FROM usuarios u
      JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      WHERE eg.grupo_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar estudiantes del grupo:', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes del grupo' });
  }
}

// DELETE /api/grupos/:id/estudiante/:estudianteId
async function quitarEstudiante(req, res) {
  const { id, estudianteId } = req.params;
  try {
    await db.query(
      'DELETE FROM estudiante_grupos WHERE grupo_id = ? AND estudiante_id = ?',
      [id, estudianteId]
    );
    res.json({ mensaje: 'Alumno quitado del grupo' });
  } catch (err) {
    console.error('Error al quitar estudiante del grupo:', err);
    res.status(500).json({ error: 'Error al quitar el alumno del grupo' });
  }
}

// DELETE /api/grupos/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await db.query('UPDATE grupos SET activo = FALSE WHERE id = ? AND colegio_id = ?', [id, req.usuario.colegio_id]);
    res.json({ mensaje: 'Grupo desactivado' });
  } catch (err) {
    console.error('Error al desactivar grupo:', err);
    res.status(500).json({ error: 'Error al desactivar el grupo' });
  }
}

module.exports = { listar, crear, listarEstudiantes, quitarEstudiante, eliminar };
