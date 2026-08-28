const db = require('../database');

function nivelMEN(nota) {
  if (nota === null || nota === undefined) return 'Sin calificar';
  if (nota >= 4.6) return 'Superior';
  if (nota >= 4.0) return 'Alto';
  if (nota >= 3.5) return 'Básico';
  return 'Bajo';
}

// GET /api/boletin/mis-grupos
// Docente: sus grupos asignados. Director/Admin: todos los grupos del colegio.
async function getMisGrupos(req, res) {
  const { rol, id: userId, colegio_id } = req.usuario;
  try {
    if (rol === 'docente') {
      const [filas] = await db.query(`
        SELECT DISTINCT g.id, g.nombre, g.grado
        FROM docente_grupos_materias dgm
        JOIN grupos g ON g.id = dgm.grupo_id
        WHERE dgm.docente_id = ? AND g.activo = TRUE
        ORDER BY g.grado ASC, g.nombre ASC
      `, [userId]);
      return res.json({ data: filas });
    }
    const colegioId = colegio_id;
    if (!colegioId) return res.status(400).json({ error: 'No se pudo determinar el colegio' });
    const [filas] = await db.query(`
      SELECT id, nombre, grado
      FROM grupos
      WHERE colegio_id = ? AND activo = TRUE
      ORDER BY grado ASC, nombre ASC
    `, [colegioId]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error en getMisGrupos:', err);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
}

// GET /api/boletin/grupo/:grupo_id/periodo/:periodo
// Lista de estudiantes del grupo con su promedio en ese período
async function getEstudiantesGrupo(req, res) {
  const { grupo_id, periodo } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT
        u.id   AS estudiante_id,
        u.nombre,
        ROUND(AVG(ra.nota), 1) AS promedio
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      LEFT JOIN actividades a
        ON a.grupo_id = eg.grupo_id AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra
        ON ra.actividad_id = a.id AND ra.estudiante_id = u.id
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE eg.grupo_id = ?
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre ASC
    `, [periodo, grupo_id]);

    const conNivel = filas.map(f => ({ ...f, nivel: nivelMEN(f.promedio) }));
    res.json({ data: conNivel });
  } catch (err) {
    console.error('Error en getEstudiantesGrupo:', err);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
}

// GET /api/boletin/estudiante/:estudiante_id?grupo_id=X&periodo=Y
// Datos completos del boletín para un estudiante
async function getBoletinEstudiante(req, res) {
  const { estudiante_id } = req.params;
  const { grupo_id, periodo } = req.query;

  if (!grupo_id || !periodo) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id y periodo' });
  }

  try {
    // 1. Info del estudiante y colegio
    const [[info]] = await db.query(`
      SELECT
        u.nombre  AS estudiante_nombre,
        g.nombre  AS grupo_nombre,
        g.grado,
        c.nombre  AS colegio_nombre
      FROM usuarios u
      JOIN estudiante_grupos eg ON eg.estudiante_id = u.id AND eg.grupo_id = ?
      JOIN grupos g ON g.id = eg.grupo_id
      JOIN colegios c ON c.id = g.colegio_id
      WHERE u.id = ?
    `, [grupo_id, estudiante_id]);

    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });

    // 2. Materias con notas del período
    const [materias] = await db.query(`
      SELECT
        m.id   AS materia_id,
        m.nombre AS materia_nombre,
        MIN(u_doc.nombre) AS docente_nombre,
        ROUND(AVG(ra.nota), 1) AS nota_promedio,
        COUNT(DISTINCT a.id)   AS total_actividades,
        COUNT(DISTINCT ra.actividad_id) AS actividades_calificadas
      FROM docente_grupos_materias dgm
      JOIN materias m ON m.id = dgm.materia_id
      LEFT JOIN usuarios u_doc ON u_doc.id = dgm.docente_id
      LEFT JOIN actividades a
        ON a.grupo_id = dgm.grupo_id AND a.materia_id = dgm.materia_id
        AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra
        ON ra.actividad_id = a.id AND ra.estudiante_id = ?
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE dgm.grupo_id = ?
      GROUP BY m.id, m.nombre
      ORDER BY m.nombre ASC
    `, [periodo, estudiante_id, grupo_id]);

    const materiasConNivel = materias.map(m => ({
      ...m,
      nivel: nivelMEN(m.nota_promedio),
    }));

    const notas = materiasConNivel.map(m => m.nota_promedio).filter(n => n !== null);
    const promedio_general = notas.length
      ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
      : null;

    // 3. Asistencia del estudiante en el grupo
    const [[asistencia]] = await db.query(`
      SELECT
        COUNT(CASE WHEN estado = 'presente'    THEN 1 END) AS presentes,
        COUNT(CASE WHEN estado = 'ausente'     THEN 1 END) AS ausentes,
        COUNT(CASE WHEN estado = 'tardanza'    THEN 1 END) AS tardanzas,
        COUNT(CASE WHEN estado = 'justificado' THEN 1 END) AS justificados,
        COUNT(id) AS total_dias
      FROM asistencias
      WHERE estudiante_id = ? AND grupo_id = ?
    `, [estudiante_id, grupo_id]);

    const tasa_asistencia = asistencia.total_dias
      ? Math.round(((asistencia.presentes + asistencia.tardanzas) / asistencia.total_dias) * 100)
      : null;

    res.json({
      data: {
        estudiante: { id: parseInt(estudiante_id), nombre: info.estudiante_nombre },
        grupo:      { nombre: info.grupo_nombre, grado: info.grado },
        colegio:    { nombre: info.colegio_nombre },
        periodo:    parseInt(periodo),
        materias:   materiasConNivel,
        promedio_general,
        nivel_general: nivelMEN(promedio_general),
        asistencia:  { ...asistencia, tasa_asistencia },
      }
    });
  } catch (err) {
    console.error('Error en getBoletinEstudiante:', err);
    res.status(500).json({ error: 'Error al generar el boletín' });
  }
}

// GET /api/boletin/grupo/:grupo_id/periodo/:periodo/masivo
// Boletines de TODOS los estudiantes del grupo en una sola respuesta
async function getBoletinMasivoGrupo(req, res) {
  const { grupo_id, periodo } = req.params;
  try {
    // 1. Info del grupo y colegio
    const [[grupoInfo]] = await db.query(`
      SELECT g.nombre AS grupo_nombre, g.grado, c.nombre AS colegio_nombre
      FROM grupos g JOIN colegios c ON c.id = g.colegio_id
      WHERE g.id = ?
    `, [grupo_id]);

    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });

    // 2. Notas de todos los estudiantes (una sola query)
    const [calificaciones] = await db.query(`
      SELECT
        u.id   AS estudiante_id,
        u.nombre AS estudiante_nombre,
        m.id   AS materia_id,
        m.nombre AS materia_nombre,
        MIN(u_doc.nombre) AS docente_nombre,
        ROUND(AVG(ra.nota), 1) AS nota_promedio,
        COUNT(DISTINCT a.id)   AS total_actividades,
        COUNT(DISTINCT ra.actividad_id) AS actividades_calificadas
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      JOIN docente_grupos_materias dgm ON dgm.grupo_id = eg.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      LEFT JOIN usuarios u_doc ON u_doc.id = dgm.docente_id
      LEFT JOIN actividades a
        ON a.grupo_id = ? AND a.materia_id = m.id AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra
        ON ra.actividad_id = a.id AND ra.estudiante_id = u.id
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE eg.grupo_id = ?
      GROUP BY u.id, u.nombre, m.id, m.nombre
      ORDER BY u.nombre ASC, m.nombre ASC
    `, [grupo_id, periodo, grupo_id]);

    // 3. Asistencia de todos los estudiantes
    const [asistencias] = await db.query(`
      SELECT
        estudiante_id,
        COUNT(CASE WHEN estado = 'presente'    THEN 1 END) AS presentes,
        COUNT(CASE WHEN estado = 'ausente'     THEN 1 END) AS ausentes,
        COUNT(CASE WHEN estado = 'tardanza'    THEN 1 END) AS tardanzas,
        COUNT(CASE WHEN estado = 'justificado' THEN 1 END) AS justificados,
        COUNT(id) AS total_dias
      FROM asistencias
      WHERE grupo_id = ?
      GROUP BY estudiante_id
    `, [grupo_id]);

    // 4. Armar boletines
    const asistenciaMap = {};
    asistencias.forEach(a => { asistenciaMap[a.estudiante_id] = a; });

    // Agrupar calificaciones por estudiante
    const estudiantesMap = {};
    calificaciones.forEach(c => {
      if (!estudiantesMap[c.estudiante_id]) {
        estudiantesMap[c.estudiante_id] = { id: c.estudiante_id, nombre: c.estudiante_nombre, materias: [] };
      }
      estudiantesMap[c.estudiante_id].materias.push({
        materia_id:             c.materia_id,
        materia_nombre:         c.materia_nombre,
        docente_nombre:         c.docente_nombre,
        nota_promedio:          c.nota_promedio,
        total_actividades:      c.total_actividades,
        actividades_calificadas: c.actividades_calificadas,
        nivel:                  nivelMEN(c.nota_promedio),
      });
    });

    const boletines = Object.values(estudiantesMap).map(est => {
      const notas = est.materias.map(m => m.nota_promedio).filter(n => n !== null);
      const promedio_general = notas.length
        ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
        : null;

      const asistencia = asistenciaMap[est.id] || {
        presentes: 0, ausentes: 0, tardanzas: 0, justificados: 0, total_dias: 0,
      };
      const tasa_asistencia = asistencia.total_dias
        ? Math.round(((asistencia.presentes + asistencia.tardanzas) / asistencia.total_dias) * 100)
        : null;

      return {
        estudiante:      { id: est.id, nombre: est.nombre },
        grupo:           { nombre: grupoInfo.grupo_nombre, grado: grupoInfo.grado },
        colegio:         { nombre: grupoInfo.colegio_nombre },
        periodo:         parseInt(periodo),
        materias:        est.materias,
        promedio_general,
        nivel_general:   nivelMEN(promedio_general),
        asistencia:      { ...asistencia, tasa_asistencia },
      };
    });

    res.json({ data: boletines });
  } catch (err) {
    console.error('Error en getBoletinMasivoGrupo:', err);
    res.status(500).json({ error: 'Error al generar los boletines masivos' });
  }
}

// GET /api/boletin/pdf/estudiante/:estudiante_id?grupo_id=X&periodo=Y
// Genera y descarga el PDF de un boletín individual
async function getPDFEstudiante(req, res) {
  const { estudiante_id } = req.params;
  const { grupo_id, periodo } = req.query;
  if (!grupo_id || !periodo) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id y periodo' });
  }
  try {
    const [[info]] = await db.query(`
      SELECT u.nombre AS estudiante_nombre, g.nombre AS grupo_nombre, g.grado, c.nombre AS colegio_nombre
      FROM usuarios u
      JOIN estudiante_grupos eg ON eg.estudiante_id = u.id AND eg.grupo_id = ?
      JOIN grupos g ON g.id = eg.grupo_id
      JOIN colegios c ON c.id = g.colegio_id
      WHERE u.id = ?
    `, [grupo_id, estudiante_id]);
    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });

    const [materias] = await db.query(`
      SELECT m.id AS materia_id, m.nombre AS materia_nombre,
             MIN(u_doc.nombre) AS docente_nombre,
             ROUND(AVG(ra.nota), 1) AS nota_promedio,
             COUNT(DISTINCT a.id)   AS total_actividades,
             COUNT(DISTINCT ra.actividad_id) AS actividades_calificadas
      FROM docente_grupos_materias dgm
      JOIN materias m ON m.id = dgm.materia_id
      LEFT JOIN usuarios u_doc ON u_doc.id = dgm.docente_id
      LEFT JOIN actividades a ON a.grupo_id = dgm.grupo_id AND a.materia_id = dgm.materia_id AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id AND ra.estudiante_id = ?
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE dgm.grupo_id = ?
      GROUP BY m.id, m.nombre ORDER BY m.nombre ASC
    `, [periodo, estudiante_id, grupo_id]);

    const materiasConNivel = materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) }));
    const notas = materiasConNivel.map(m => m.nota_promedio).filter(n => n !== null);
    const promedio_general = notas.length
      ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
      : null;

    const [[asistencia]] = await db.query(`
      SELECT COUNT(CASE WHEN estado='presente' THEN 1 END) AS presentes,
             COUNT(CASE WHEN estado='ausente'  THEN 1 END) AS ausentes,
             COUNT(CASE WHEN estado='tardanza' THEN 1 END) AS tardanzas,
             COUNT(CASE WHEN estado='justificado' THEN 1 END) AS justificados,
             COUNT(id) AS total_dias
      FROM asistencias WHERE estudiante_id = ? AND grupo_id = ?
    `, [estudiante_id, grupo_id]);

    const tasa_asistencia = asistencia.total_dias
      ? Math.round(((asistencia.presentes + asistencia.tardanzas) / asistencia.total_dias) * 100)
      : null;

    const datos = {
      estudiante: { id: parseInt(estudiante_id), nombre: info.estudiante_nombre },
      grupo:      { nombre: info.grupo_nombre, grado: info.grado },
      colegio:    { nombre: info.colegio_nombre },
      periodo:    parseInt(periodo),
      materias:   materiasConNivel,
      promedio_general,
      nivel_general: nivelMEN(promedio_general),
      asistencia:  { ...asistencia, tasa_asistencia },
    };

    const { generarPDF } = require('../services/pdfService');
    const buf = await generarPDF(datos);
    const nombre = info.estudiante_nombre.replace(/\s+/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletin_${nombre}_P${periodo}.pdf"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('Error en getPDFEstudiante:', err);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
}

// GET /api/boletin/pdf/grupo/:grupo_id/periodo/:periodo
// Genera un PDF multi-página con los boletines de todo el grupo
async function getPDFGrupo(req, res) {
  const { grupo_id, periodo } = req.params;
  try {
    const [[grupoInfo]] = await db.query(`
      SELECT g.nombre AS grupo_nombre, g.grado, c.nombre AS colegio_nombre
      FROM grupos g JOIN colegios c ON c.id = g.colegio_id WHERE g.id = ?
    `, [grupo_id]);
    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const [calificaciones] = await db.query(`
      SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre,
             m.id AS materia_id, m.nombre AS materia_nombre,
             MIN(u_doc.nombre) AS docente_nombre,
             ROUND(AVG(ra.nota), 1) AS nota_promedio,
             COUNT(DISTINCT a.id)   AS total_actividades,
             COUNT(DISTINCT ra.actividad_id) AS actividades_calificadas
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      JOIN docente_grupos_materias dgm ON dgm.grupo_id = eg.grupo_id
      JOIN materias m ON m.id = dgm.materia_id
      LEFT JOIN usuarios u_doc ON u_doc.id = dgm.docente_id
      LEFT JOIN actividades a ON a.grupo_id = ? AND a.materia_id = m.id AND a.periodo = ? AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id AND ra.estudiante_id = u.id
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE eg.grupo_id = ?
      GROUP BY u.id, u.nombre, m.id, m.nombre ORDER BY u.nombre ASC, m.nombre ASC
    `, [grupo_id, periodo, grupo_id]);

    const [asistencias] = await db.query(`
      SELECT estudiante_id,
             COUNT(CASE WHEN estado='presente' THEN 1 END) AS presentes,
             COUNT(CASE WHEN estado='ausente'  THEN 1 END) AS ausentes,
             COUNT(CASE WHEN estado='tardanza' THEN 1 END) AS tardanzas,
             COUNT(CASE WHEN estado='justificado' THEN 1 END) AS justificados,
             COUNT(id) AS total_dias
      FROM asistencias WHERE grupo_id = ? GROUP BY estudiante_id
    `, [grupo_id]);

    const asistenciaMap = {};
    asistencias.forEach(a => { asistenciaMap[a.estudiante_id] = a; });

    const estudiantesMap = {};
    calificaciones.forEach(c => {
      if (!estudiantesMap[c.estudiante_id]) {
        estudiantesMap[c.estudiante_id] = { id: c.estudiante_id, nombre: c.estudiante_nombre, materias: [] };
      }
      estudiantesMap[c.estudiante_id].materias.push({
        materia_id: c.materia_id, materia_nombre: c.materia_nombre,
        docente_nombre: c.docente_nombre, nota_promedio: c.nota_promedio,
        total_actividades: c.total_actividades, actividades_calificadas: c.actividades_calificadas,
        nivel: nivelMEN(c.nota_promedio),
      });
    });

    const boletines = Object.values(estudiantesMap).map(est => {
      const notas = est.materias.map(m => m.nota_promedio).filter(n => n !== null);
      const promedio_general = notas.length
        ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
        : null;
      const asistencia = asistenciaMap[est.id] || { presentes: 0, ausentes: 0, tardanzas: 0, justificados: 0, total_dias: 0 };
      const tasa_asistencia = asistencia.total_dias
        ? Math.round(((asistencia.presentes + asistencia.tardanzas) / asistencia.total_dias) * 100)
        : null;
      return {
        estudiante:    { id: est.id, nombre: est.nombre },
        grupo:         { nombre: grupoInfo.grupo_nombre, grado: grupoInfo.grado },
        colegio:       { nombre: grupoInfo.colegio_nombre },
        periodo:       parseInt(periodo),
        materias:      est.materias,
        promedio_general,
        nivel_general: nivelMEN(promedio_general),
        asistencia:    { ...asistencia, tasa_asistencia },
      };
    });

    if (!boletines.length) return res.status(404).json({ error: 'No hay estudiantes en este grupo' });

    const { generarPDF } = require('../services/pdfService');
    const buf = await generarPDF(boletines);
    const nombreGrupo = grupoInfo.grupo_nombre.replace(/\s+/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletines_${nombreGrupo}_P${periodo}.pdf"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('Error en getPDFGrupo:', err);
    res.status(500).json({ error: 'Error al generar el PDF del grupo' });
  }
}

module.exports = { getMisGrupos, getEstudiantesGrupo, getBoletinEstudiante, getBoletinMasivoGrupo, getPDFEstudiante, getPDFGrupo };
