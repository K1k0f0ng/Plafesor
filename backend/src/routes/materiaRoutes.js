const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

// GET /api/materias — cualquier usuario autenticado puede verlas
router.get('/', async (req, res) => {
  try {
    const [filas] = await db.query('SELECT * FROM materias WHERE activa = TRUE ORDER BY nombre ASC');
    res.json({ data: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener las materias' });
  }
});

// GET /api/materias/mis-materias — materias del estudiante según su grupo, incluye nombre del docente
router.get('/mis-materias', async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT m.id, m.nombre, m.codigo,
             MIN(u.nombre) AS nombre_docente
      FROM materias m
      JOIN docente_grupos_materias dgm ON dgm.materia_id = m.id
      JOIN estudiante_grupos eg ON eg.grupo_id = dgm.grupo_id
      JOIN usuarios u ON u.id = dgm.docente_id
      WHERE eg.estudiante_id = ?
        AND m.activa = TRUE
      GROUP BY m.id, m.nombre, m.codigo
      ORDER BY m.nombre ASC
    `, [req.usuario.id]);
    res.json({ data: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener las materias del estudiante' });
  }
});

// GET /api/materias/asignaciones — vista admin de todas las asignaciones grupo+materia+docente
router.get('/asignaciones', permitirRoles('admin'), async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT dgm.id,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo,
             u.id AS docente_id, u.nombre AS nombre_docente
      FROM docente_grupos_materias dgm
      JOIN grupos g ON g.id = dgm.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      JOIN usuarios u ON u.id = dgm.docente_id
      ORDER BY g.grado ASC, g.nombre ASC, m.nombre ASC
    `);
    res.json({ data: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener las asignaciones' });
  }
});

// POST /api/materias — crear nueva materia (solo admin)
router.post('/', permitirRoles('admin'), async (req, res) => {
  const { nombre, codigo, descripcion } = req.body;
  if (!nombre || !codigo) {
    return res.status(400).json({ error: 'El nombre y el código son obligatorios' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO materias (nombre, codigo, descripcion, activa) VALUES (?, ?, ?, TRUE)',
      [nombre.trim(), codigo.trim().toUpperCase(), descripcion || null]
    );
    res.status(201).json({ mensaje: 'Materia creada', data: { id: result.insertId, nombre, codigo } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una materia con ese código' });
    }
    res.status(500).json({ error: 'Error al crear la materia' });
  }
});

// DELETE /api/materias/:id — desactivar materia (solo admin)
router.delete('/:id', permitirRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE materias SET activa = FALSE WHERE id = ?', [id]);
    res.json({ mensaje: 'Materia desactivada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar la materia' });
  }
});

module.exports = router;
