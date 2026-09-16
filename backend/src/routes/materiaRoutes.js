const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { registrarAuditoria } = require('../utils/auditoria');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);

// GET /api/materias — cualquier usuario autenticado puede verlas. Incluye las
// del colegio del usuario más las históricas compartidas (colegio_id NULL).
router.get('/', async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT m.*, a.nombre AS nombre_area, a.codigo AS codigo_area
      FROM materias m
      LEFT JOIN areas_academicas a ON a.id = m.area_id
      WHERE m.activa = TRUE AND (m.colegio_id = ? OR m.colegio_id IS NULL)
      ORDER BY a.orden ASC, m.nombre ASC
    `, [req.usuario.colegio_id]);
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

// GET /api/materias/asignaciones — vista admin/director de las clases definidas (grupo+materia+docente) del colegio
router.get('/asignaciones', permitirRoles('admin', 'director'), permitirModulo('asignaturas'), async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT dgm.id, dgm.intensidad_horaria_semanal,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo,
             u.id AS docente_id, u.nombre AS nombre_docente
      FROM docente_grupos_materias dgm
      JOIN grupos g ON g.id = dgm.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      JOIN usuarios u ON u.id = dgm.docente_id
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      WHERE g.colegio_id = ?
      ORDER BY ga.orden ASC, g.nombre ASC, m.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener las asignaciones' });
  }
});

// POST /api/materias — crear nueva asignatura (admin o director)
router.post('/', permitirRoles('admin', 'director'), permitirModulo('asignaturas'), async (req, res) => {
  const { nombre, codigo, descripcion, area_id } = req.body;
  const colegio_id = req.usuario.colegio_id;
  if (!nombre || !codigo) {
    return res.status(400).json({ error: 'El nombre y el código son obligatorios' });
  }
  try {
    if (area_id) {
      const [[area]] = await db.query(
        'SELECT id FROM areas_academicas WHERE id = ? AND colegio_id = ?',
        [area_id, colegio_id]
      );
      if (!area) return res.status(400).json({ error: 'El área seleccionada no es válida' });
    }
    const [result] = await db.query(
      'INSERT INTO materias (nombre, codigo, descripcion, area_id, colegio_id, activa) VALUES (?, ?, ?, ?, ?, TRUE)',
      [nombre.trim(), codigo.trim().toUpperCase(), descripcion || null, area_id || null, colegio_id]
    );

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'asignatura_editada', entidad: 'materia', entidad_id: result.insertId,
      detalle: { nombre: nombre.trim(), codigo: codigo.trim().toUpperCase(), tipo: 'creada' },
    });

    res.status(201).json({ mensaje: 'Asignatura creada', data: { id: result.insertId, nombre, codigo } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una materia con ese código' });
    }
    res.status(500).json({ error: 'Error al crear la asignatura' });
  }
});

// PUT /api/materias/:id — editar una asignatura del propio colegio (admin o director)
router.put('/:id', permitirRoles('admin', 'director'), permitirModulo('asignaturas'), async (req, res) => {
  const { id } = req.params;
  const { nombre, codigo, descripcion, area_id } = req.body;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[materia]] = await db.query(
      'SELECT id FROM materias WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!materia) {
      return res.status(404).json({ error: 'Asignatura no encontrada, o pertenece al catálogo compartido de solo lectura' });
    }
    if (nombre !== undefined && !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la asignatura no puede quedar vacío' });
    }
    if (codigo !== undefined && !codigo.trim()) {
      return res.status(400).json({ error: 'El código de la asignatura no puede quedar vacío' });
    }
    if (area_id) {
      const [[area]] = await db.query(
        'SELECT id FROM areas_academicas WHERE id = ? AND colegio_id = ?',
        [area_id, colegio_id]
      );
      if (!area) return res.status(400).json({ error: 'El área seleccionada no es válida' });
    }

    const campos = [];
    const valores = [];
    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre.trim()); }
    if (codigo !== undefined) { campos.push('codigo = ?'); valores.push(codigo.trim().toUpperCase()); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion || null); }
    if (area_id !== undefined) { campos.push('area_id = ?'); valores.push(area_id || null); }
    if (campos.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    await db.query(`UPDATE materias SET ${campos.join(', ')} WHERE id = ? AND colegio_id = ?`, [...valores, id, colegio_id]);

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'asignatura_editada', entidad: 'materia', entidad_id: parseInt(id),
      detalle: { nombre, codigo, tipo: 'editada' },
    });

    res.json({ mensaje: 'Asignatura actualizada' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una materia con ese código' });
    }
    res.status(500).json({ error: 'Error al actualizar la asignatura' });
  }
});

// DELETE /api/materias/:id — desactivar asignatura del propio colegio (admin o director)
router.delete('/:id', permitirRoles('admin', 'director'), permitirModulo('asignaturas'), async (req, res) => {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [result] = await db.query(
      'UPDATE materias SET activa = FALSE WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asignatura no encontrada, o pertenece al catálogo compartido de solo lectura' });
    }

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'asignatura_editada', entidad: 'materia', entidad_id: parseInt(id),
      detalle: { tipo: 'desactivada' },
    });

    res.json({ mensaje: 'Materia desactivada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar la materia' });
  }
});

module.exports = router;
