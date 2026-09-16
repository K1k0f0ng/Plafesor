'use strict';
const db = require('../database');
const { obtenerSemanaAcademica } = require('../utils/semanaAcademica');

// GET /api/horarios/mio — horario semanal completo del docente autenticado
async function miHorario(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.salon_id,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo,
             s.nombre AS nombre_salon
      FROM horarios h
      JOIN grupos   g ON g.id = h.grupo_id
      JOIN materias m ON m.id = h.materia_id
      LEFT JOIN salones s ON s.id = h.salon_id
      WHERE h.docente_id = ? AND h.activo = TRUE
      ORDER BY h.dia_semana ASC, h.hora_inicio ASC
    `, [req.usuario.id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error en miHorario:', err);
    res.status(500).json({ error: 'Error al obtener el horario' });
  }
}

// GET /api/horarios/hoy — clases programadas para hoy (por día de semana)
// WEEKDAY(NOW()): 0=Lunes … 5=Sábado, 6=Domingo → nuestro dia_semana = WEEKDAY + 1
// (ya no se limita a Lunes-Viernes: algunos colegios sí tienen clase el sábado)
async function clasesHoy(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT h.id, h.dia_semana, h.hora_inicio, h.hora_fin, h.salon_id,
             g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
             m.id AS materia_id, m.nombre AS nombre_materia, m.codigo,
             s.nombre AS nombre_salon
      FROM horarios h
      JOIN grupos   g ON g.id = h.grupo_id
      JOIN materias m ON m.id = h.materia_id
      LEFT JOIN salones s ON s.id = h.salon_id
      WHERE h.docente_id = ? AND h.activo = TRUE
        AND h.dia_semana = WEEKDAY(NOW()) + 1
      ORDER BY h.hora_inicio ASC
    `, [req.usuario.id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error en clasesHoy:', err);
    res.status(500).json({ error: 'Error al obtener las clases de hoy' });
  }
}

// POST /api/horarios — agregar franja horaria
async function guardar(req, res) {
  const { grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, salon_id } = req.body;
  const docenteId = req.usuario.id;

  if (!grupo_id || !materia_id || !dia_semana || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: 'La hora de fin debe ser mayor que la de inicio' });
  }

  try {
    const diasActivos = await obtenerSemanaAcademica(req.usuario.colegio_id);
    const diaValido = diasActivos.some(d => d.dia_numero === Number(dia_semana) && d.activo);
    if (!diaValido) {
      return res.status(400).json({ error: 'Ese día no está habilitado en la semana académica del colegio' });
    }

    // Verificar que el docente realmente enseña esa materia en ese grupo
    const [[asig]] = await db.query(
      'SELECT id FROM docente_grupos_materias WHERE docente_id = ? AND grupo_id = ? AND materia_id = ?',
      [docenteId, grupo_id, materia_id]
    );
    if (!asig) {
      return res.status(403).json({ error: 'No tienes asignada esa materia en ese grupo' });
    }

    await db.query(`
      INSERT INTO horarios (docente_id, grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, salon_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE hora_fin = VALUES(hora_fin), salon_id = VALUES(salon_id), activo = TRUE
    `, [docenteId, grupo_id, materia_id, dia_semana, hora_inicio, hora_fin, salon_id || null]);

    res.status(201).json({ mensaje: 'Franja guardada' });
  } catch (err) {
    console.error('Error al guardar horario:', err);
    res.status(500).json({ error: 'Error al guardar la franja' });
  }
}

// DELETE /api/horarios/:id
async function eliminar(req, res) {
  try {
    await db.query(
      'UPDATE horarios SET activo = FALSE WHERE id = ? AND docente_id = ?',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensaje: 'Franja eliminada' });
  } catch (err) {
    console.error('Error al eliminar horario:', err);
    res.status(500).json({ error: 'Error al eliminar la franja' });
  }
}

module.exports = { miHorario, clasesHoy, guardar, eliminar };
