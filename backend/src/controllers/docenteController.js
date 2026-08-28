const bcrypt = require('bcryptjs');
const db = require('../database');

// GET /api/docentes — solo los del colegio del admin
async function listar(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre, u.email, u.activo, u.creado_en,
             c.nombre AS nombre_colegio,
             u.grupo_dirigido_id,
             g.nombre AS nombre_grupo_dirigido,
             g.grado  AS grado_grupo_dirigido
      FROM usuarios u
      LEFT JOIN colegios c ON c.id = u.colegio_id
      LEFT JOIN grupos g ON g.id = u.grupo_dirigido_id
      WHERE u.rol = 'docente' AND u.colegio_id = ?
      ORDER BY u.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar docentes:', err);
    res.status(500).json({ error: 'Error al obtener los docentes' });
  }
}

// POST /api/docentes — colegio_id viene del JWT
async function crear(req, res) {
  const { nombre, email, password, grupo_dirigido_id } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }
  if (!colegio_id) {
    return res.status(400).json({ error: 'Tu usuario no tiene un colegio asignado' });
  }

  let grupoDirigido = null;
  if (grupo_dirigido_id) {
    const [[grupo]] = await db.query('SELECT id FROM grupos WHERE id = ? AND colegio_id = ?', [grupo_dirigido_id, colegio_id]);
    if (!grupo) return res.status(400).json({ error: 'El grupo seleccionado no existe en tu colegio' });
    grupoDirigido = grupo.id;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO usuarios (nombre, email, password, rol, colegio_id, grupo_dirigido_id) VALUES (?, ?, ?, "docente", ?, ?)',
      [nombre, email, hash, colegio_id, grupoDirigido]
    );
    res.status(201).json({ mensaje: 'Docente creado', data: { id: result.insertId, nombre, email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('unique_director_grupo')) {
        return res.status(409).json({ error: 'Ese grupo ya tiene un director de grupo asignado' });
      }
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear docente:', err);
    res.status(500).json({ error: 'Error al crear el docente' });
  }
}

// POST /api/docentes/asignar
async function asignar(req, res) {
  const { docente_id, grupo_id, materia_id } = req.body;

  if (!docente_id || !grupo_id || !materia_id) {
    return res.status(400).json({ error: 'docente_id, grupo_id y materia_id son obligatorios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO docente_grupos_materias (docente_id, grupo_id, materia_id) VALUES (?, ?, ?)',
      [docente_id, grupo_id, materia_id]
    );
    res.status(201).json({ mensaje: 'Asignación creada', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esta asignación ya existe' });
    }
    console.error('Error al asignar docente:', err);
    res.status(500).json({ error: 'Error al crear la asignación' });
  }
}

// GET /api/docentes/:id/asignaciones
async function obtenerAsignaciones(req, res) {
  const { id } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT dgm.id, dgm.docente_id,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo
      FROM docente_grupos_materias dgm
      JOIN grupos g ON g.id = dgm.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      WHERE dgm.docente_id = ?
      ORDER BY g.grado ASC, g.nombre ASC, m.nombre ASC
    `, [id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener asignaciones:', err);
    res.status(500).json({ error: 'Error al obtener las asignaciones' });
  }
}

// DELETE /api/docentes/asignacion/:id
async function eliminarAsignacion(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM docente_grupos_materias WHERE id = ?', [id]);
    res.json({ mensaje: 'Asignación eliminada' });
  } catch (err) {
    console.error('Error al eliminar asignación:', err);
    res.status(500).json({ error: 'Error al eliminar la asignación' });
  }
}

// DELETE /api/docentes/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE usuarios SET activo = FALSE WHERE id = ? AND rol = "docente" AND colegio_id = ?',
      [id, req.usuario.colegio_id]
    );
    res.json({ mensaje: 'Docente desactivado' });
  } catch (err) {
    console.error('Error al desactivar docente:', err);
    res.status(500).json({ error: 'Error al desactivar el docente' });
  }
}

module.exports = { listar, crear, asignar, obtenerAsignaciones, eliminarAsignacion, eliminar };
