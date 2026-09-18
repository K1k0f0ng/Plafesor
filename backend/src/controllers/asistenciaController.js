const db = require('../database');
const { ordenApellido } = require('../utils/ordenNombre');

// POST /api/asistencias — guardar asistencia masiva de un grupo en una fecha
async function registrar(req, res) {
  const { grupo_id, fecha, registros } = req.body;

  if (!grupo_id || !fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  if (req.usuario.rol === 'docente') {
    const [asig] = await db.query(
      'SELECT id FROM docente_grupos_materias WHERE docente_id = ? AND grupo_id = ? LIMIT 1',
      [req.usuario.id, grupo_id]
    );
    if (asig.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }
  }

  try {
    for (const r of registros) {
      await db.query(`
        INSERT INTO asistencias (estudiante_id, grupo_id, fecha, estado, registrado_por)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          estado = VALUES(estado),
          registrado_por = VALUES(registrado_por)
      `, [r.estudiante_id, grupo_id, fecha, r.estado, req.usuario.id]);
    }
    res.json({ data: { guardado: true, total: registros.length } });
  } catch (err) {
    console.error('Error al registrar asistencia:', err);
    res.status(500).json({ error: 'Error al guardar la asistencia' });
  }
}

// GET /api/asistencias/grupo/:grupo_id?fecha=YYYY-MM-DD
// Devuelve todos los estudiantes del grupo con su estado en esa fecha
async function obtenerPorFecha(req, res) {
  const { grupo_id } = req.params;
  const { fecha } = req.query;
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

  try {
    const [filas] = await db.query(`
      SELECT
        u.id   AS estudiante_id,
        u.nombre,
        COALESCE(a.estado, 'pendiente') AS estado
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      LEFT JOIN asistencias a
        ON a.estudiante_id = u.id AND a.grupo_id = ? AND a.fecha = ?
      WHERE eg.grupo_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [grupo_id, fechaConsulta, grupo_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener asistencia:', err);
    res.status(500).json({ error: 'Error al obtener la asistencia' });
  }
}

// GET /api/asistencias/grupo/:grupo_id/resumen
// Totales por estudiante: cuántos presentes, ausentes, tardanzas, justificados
async function resumenGrupo(req, res) {
  const { grupo_id } = req.params;

  try {
    const [filas] = await db.query(`
      SELECT
        u.id AS estudiante_id,
        u.nombre,
        COUNT(CASE WHEN a.estado = 'presente'    THEN 1 END) AS presentes,
        COUNT(CASE WHEN a.estado = 'ausente'     THEN 1 END) AS ausentes,
        COUNT(CASE WHEN a.estado = 'tardanza'    THEN 1 END) AS tardanzas,
        COUNT(CASE WHEN a.estado = 'justificado' THEN 1 END) AS justificados,
        COUNT(a.id) AS total_dias,
        ROUND(
          COUNT(CASE WHEN a.estado IN ('presente','tardanza') THEN 1 END)
          / NULLIF(COUNT(a.id), 0) * 100
        , 1) AS tasa_asistencia
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      LEFT JOIN asistencias a ON a.estudiante_id = u.id AND a.grupo_id = ?
      WHERE eg.grupo_id = ?
      GROUP BY u.id, u.nombre
      ORDER BY ausentes DESC, ${ordenApellido('u.nombre')} ASC
    `, [grupo_id, grupo_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en resumen de asistencia:', err);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
}

// GET /api/asistencias/alertas/colegio/:colegio_id
// Estudiantes con 3 o más ausencias en los últimos 30 días
// El colegio se toma siempre de la sesión (antes venía de la URL sin validar
// y un admin/director podía ver los estudiantes con ausencias de otro colegio).
async function alertasAsistencia(req, res) {
  const colegio_id = req.usuario.colegio_id;

  try {
    const [filas] = await db.query(`
      SELECT
        u.nombre AS nombre_estudiante,
        g.nombre AS nombre_grupo,
        g.grado,
        COUNT(CASE WHEN a.estado = 'ausente' THEN 1 END) AS ausencias,
        MAX(a.fecha) AS ultima_ausencia
      FROM asistencias a
      JOIN usuarios u  ON u.id = a.estudiante_id
      JOIN grupos g    ON g.id = a.grupo_id
      WHERE g.colegio_id = ?
        AND a.estado = 'ausente'
        AND a.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY a.estudiante_id, a.grupo_id
      HAVING COUNT(CASE WHEN a.estado = 'ausente' THEN 1 END) >= 3
      ORDER BY ausencias DESC
    `, [colegio_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en alertas de asistencia:', err);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
}

// GET /api/asistencias/hoy/docente/:docente_id
// Para cada grupo del docente: ¿pasó lista hoy?
async function resumenHoyDocente(req, res) {
  const { docente_id } = req.params;
  if (req.usuario.rol === 'docente' && req.usuario.id !== parseInt(docente_id)) {
    return res.status(403).json({ error: 'Acceso no permitido' });
  }
  try {
    const [filas] = await db.query(`
      SELECT
        g.id          AS grupo_id,
        g.nombre      AS nombre_grupo,
        g.grado,
        CASE WHEN COUNT(a.id) > 0 THEN 1 ELSE 0 END AS lista_pasada,
        COUNT(a.id)   AS registros_hoy
      FROM docente_grupos_materias dgm
      JOIN grupos g ON g.id = dgm.grupo_id
      LEFT JOIN asistencias a
        ON a.grupo_id = g.id AND a.fecha = CURDATE()
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      WHERE dgm.docente_id = ?
      GROUP BY g.id, g.nombre, g.grado, ga.orden
      ORDER BY lista_pasada ASC, ga.orden ASC, g.nombre ASC
    `, [docente_id]);

    // Deduplicar grupos (un docente puede tener varias materias en el mismo grupo)
    const vistos = new Set();
    const grupos = filas.filter(g => {
      if (vistos.has(g.grupo_id)) return false;
      vistos.add(g.grupo_id);
      return true;
    });

    res.json({ data: grupos });
  } catch (err) {
    console.error('Error en resumen hoy docente:', err);
    res.status(500).json({ error: 'Error al obtener el resumen de hoy' });
  }
}

module.exports = { registrar, obtenerPorFecha, resumenGrupo, alertasAsistencia, resumenHoyDocente };
