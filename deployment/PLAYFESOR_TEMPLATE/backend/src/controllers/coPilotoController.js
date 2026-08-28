const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/copiloto/colegio/:colegio_id
async function preguntar(req, res) {
  const { colegio_id } = req.params;
  const { pregunta } = req.body;

  if (!pregunta || pregunta.trim().length < 3) {
    return res.status(400).json({ error: 'La pregunta no puede estar vacía' });
  }

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes consultar datos de tu colegio' });
  }

  try {
    const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [colegio_id]);
    const cid = parseInt(colegio_id);

    const [
      [metricasRows],
      [gruposRows],
      [materiasRows],
      [riesgoRows],
      [alertasRows],
      [asistenciaRows],
    ] = await Promise.all([

      db.query(`
        SELECT ROUND(AVG(ra.nota), 2) AS promedio, COUNT(ra.id) AS total,
          SUM(CASE WHEN ra.nota < 3.5              THEN 1 ELSE 0 END) AS bajo,
          SUM(CASE WHEN ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END) AS basico,
          SUM(CASE WHEN ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END) AS alto,
          SUM(CASE WHEN ra.nota > 4.5              THEN 1 ELSE 0 END) AS superior
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN grupos g ON g.id = a.grupo_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
      `, [cid]),

      db.query(`
        SELECT g.nombre AS grupo, g.grado,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(DISTINCT eg.estudiante_id) AS estudiantes
        FROM grupos g
        LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
        LEFT JOIN actividades a ON a.grupo_id = g.id AND a.activa = TRUE
        LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        WHERE g.colegio_id = ?
        GROUP BY g.id
        ORDER BY promedio ASC
      `, [cid]),

      db.query(`
        SELECT m.nombre,
          ROUND(AVG(ra.nota), 1) AS promedio,
          ROUND(SUM(CASE WHEN ra.nota >= 3.5 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ra.id), 0), 1) AS aprobacion
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN grupos g ON g.id = a.grupo_id
        JOIN materias m ON m.id = a.materia_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY m.id
        ORDER BY promedio ASC
      `, [cid]),

      db.query(`
        SELECT u.nombre AS estudiante, m.nombre AS materia,
          g.nombre AS grupo, g.grado, pr.score, pr.nivel
        FROM predicciones_riesgo pr
        JOIN usuarios u ON u.id  = pr.estudiante_id
        JOIN materias m ON m.id  = pr.materia_id
        JOIN grupos   g ON g.id  = pr.grupo_id
        WHERE pr.colegio_id = ? AND pr.nivel IN ('critico','alto')
        ORDER BY pr.score DESC
        LIMIT 15
      `, [cid]),

      db.query(`
        SELECT u.nombre AS estudiante, m.nombre AS materia,
          g.nombre AS grupo, g.grado,
          COUNT(DISTINCT a.id)         AS actividades_bajo,
          ROUND(MIN(mejores.nota), 1)  AS peor_nota
        FROM (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) mejores
        JOIN actividades a ON a.id = mejores.actividad_id AND a.activa = TRUE
        JOIN usuarios u ON u.id   = mejores.estudiante_id
        JOIN materias m ON m.id   = a.materia_id
        JOIN grupos   g ON g.id   = a.grupo_id
        WHERE g.colegio_id = ? AND mejores.nota < 3.5
        GROUP BY mejores.estudiante_id, a.materia_id, a.grupo_id
        HAVING COUNT(DISTINCT a.id) >= 2
        ORDER BY COUNT(DISTINCT a.id) DESC
        LIMIT 15
      `, [cid]),

      db.query(`
        SELECT
          ROUND(SUM(CASE WHEN ast.estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 1) AS tasa,
          COUNT(*) AS total_registros
        FROM asistencias ast
        JOIN grupos g ON g.id = ast.grupo_id
        WHERE g.colegio_id = ?
          AND ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [cid]),
    ]);

    const m = metricasRows[0] || {};
    const total = (m.bajo || 0) + (m.basico || 0) + (m.alto || 0) + (m.superior || 0);
    const pct = (n) => total ? `${Math.round(((n || 0) / total) * 100)}%` : '0%';

    const contexto = [
      `COLEGIO: ${colegio?.nombre || 'Sin nombre'}`,
      `FECHA: ${new Date().toLocaleDateString('es-CO')}`,
      '',
      'MÉTRICAS INSTITUCIONALES:',
      `- Promedio general: ${m.promedio ?? 'sin datos'}`,
      `- Total evaluaciones: ${m.total || 0}`,
      `- Distribución MEN: Bajo ${pct(m.bajo)} | Básico ${pct(m.basico)} | Alto ${pct(m.alto)} | Superior ${pct(m.superior)}`,
      `- Tasa de asistencia últimos 30 días: ${asistenciaRows[0]?.tasa ?? 'sin datos'}%`,
      '',
      'GRUPOS (de menor a mayor promedio):',
      gruposRows.length > 0
        ? gruposRows.map(g => `- Grado ${g.grado}° ${g.grupo}: promedio ${g.promedio ?? '—'}, ${g.estudiantes} estudiantes`).join('\n')
        : '- Sin grupos registrados',
      '',
      'MATERIAS (de menor a mayor promedio):',
      materiasRows.length > 0
        ? materiasRows.map(mat => `- ${mat.nombre}: promedio ${mat.promedio}, aprobación ${mat.aprobacion}%`).join('\n')
        : '- Sin datos de materias',
      '',
      'ESTUDIANTES EN RIESGO ALTO O CRÍTICO:',
      riesgoRows.length > 0
        ? riesgoRows.map(r => `- ${r.estudiante} en ${r.materia} (Grado ${r.grado}° ${r.grupo}) — score ${r.score} [${r.nivel}]`).join('\n')
        : '- Ninguno detectado (recalcula el motor de riesgo si hay datos)',
      '',
      'ALERTAS ACTIVAS (nota < 3.5 en 2+ actividades):',
      alertasRows.length > 0
        ? alertasRows.map(a => `- ${a.estudiante} en ${a.materia} (${a.grupo}): ${a.actividades_bajo} actividades bajo 3.5, peor nota ${a.peor_nota}`).join('\n')
        : '- Sin alertas activas',
    ].join('\n');

    const mensaje = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: `Eres el Copiloto Académico de ${colegio?.nombre || 'un colegio colombiano'}. Apoyas al rector y director con análisis de datos académicos reales. Responde siempre en español, de forma concisa y con recomendaciones concretas y accionables (máximo 220 palabras). Usa la escala MEN colombiana: Bajo (<3.0), Básico (3.0–3.9), Alto (4.0–4.5), Superior (4.6–5.0). Si la pregunta está fuera del contexto educativo, redirige amablemente. No inventes datos que no estén en el contexto.

CONTEXTO ACTUAL DEL COLEGIO:
${contexto}`,
      messages: [{ role: 'user', content: pregunta.trim() }],
    });

    res.json({ data: { respuesta: mensaje.content[0].text } });
  } catch (err) {
    console.error('Error en copiloto:', err);
    res.status(500).json({ error: 'Error al consultar el copiloto. Verifica la API key.' });
  }
}

// POST /api/copiloto/docente/:docente_id
async function preguntarDocente(req, res) {
  const { docente_id } = req.params;
  const { pregunta } = req.body;
  const did = parseInt(docente_id);

  if (!pregunta || pregunta.trim().length < 3) {
    return res.status(400).json({ error: 'La pregunta no puede estar vacía' });
  }
  if (req.usuario.rol === 'docente' && req.usuario.id !== did) {
    return res.status(403).json({ error: 'Solo puedes consultar tus propios datos' });
  }

  try {
    const [[docenteRow]] = await db.query(
      'SELECT u.nombre, c.nombre AS colegio FROM usuarios u JOIN colegios c ON c.id = u.colegio_id WHERE u.id = ?',
      [did]
    );

    const [
      [asignacionesRows],
      [rendimientoRows],
      [riesgoRows],
      [alertasRows],
      [asistenciaRows],
      [actividadesRows],
    ] = await Promise.all([

      // 1. Grupos y materias del docente
      db.query(`
        SELECT g.nombre AS grupo, g.grado, m.nombre AS materia,
          COUNT(DISTINCT eg.estudiante_id) AS estudiantes
        FROM docente_grupos_materias dgm
        JOIN grupos g ON g.id = dgm.grupo_id
        JOIN materias m ON m.id = dgm.materia_id
        LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
        WHERE dgm.docente_id = ?
        GROUP BY g.id, m.id
        ORDER BY g.grado ASC, g.nombre ASC, m.nombre ASC
      `, [did]),

      // 2. Promedio por grupo × materia
      db.query(`
        SELECT g.nombre AS grupo, g.grado, m.nombre AS materia,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(ra.nota) AS total_notas,
          SUM(CASE WHEN ra.nota < 3.5 THEN 1 ELSE 0 END) AS bajo,
          ROUND(SUM(CASE WHEN ra.nota >= 3.5 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ra.nota),0), 0) AS pct_aprobacion
        FROM actividades a
        JOIN grupos g ON g.id = a.grupo_id
        JOIN materias m ON m.id = a.materia_id
        LEFT JOIN (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) ra ON ra.actividad_id = a.id
        WHERE a.docente_id = ? AND a.activa = TRUE
        GROUP BY g.id, m.id
        ORDER BY promedio ASC
      `, [did]),

      // 3. Estudiantes en riesgo alto/crítico del docente
      db.query(`
        SELECT DISTINCT u.nombre AS estudiante, m.nombre AS materia,
          g.nombre AS grupo, g.grado, pr.score, pr.nivel
        FROM predicciones_riesgo pr
        JOIN docente_grupos_materias dgm ON dgm.grupo_id = pr.grupo_id AND dgm.materia_id = pr.materia_id
        JOIN usuarios u ON u.id = pr.estudiante_id
        JOIN materias m ON m.id = pr.materia_id
        JOIN grupos g ON g.id = pr.grupo_id
        WHERE dgm.docente_id = ? AND pr.nivel IN ('critico','alto')
        ORDER BY pr.score DESC
        LIMIT 10
      `, [did]),

      // 4. Alertas: nota < 3.5 en 2+ actividades del docente
      db.query(`
        SELECT u.nombre AS estudiante, m.nombre AS materia,
          g.nombre AS grupo, g.grado,
          COUNT(DISTINCT a.id) AS actividades_bajo,
          ROUND(MIN(mejores.nota), 1) AS peor_nota
        FROM (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) mejores
        JOIN actividades a ON a.id = mejores.actividad_id AND a.activa = TRUE AND a.docente_id = ?
        JOIN usuarios u ON u.id = mejores.estudiante_id
        JOIN materias m ON m.id = a.materia_id
        JOIN grupos g ON g.id = a.grupo_id
        WHERE mejores.nota < 3.5
        GROUP BY mejores.estudiante_id, a.materia_id, a.grupo_id
        HAVING COUNT(DISTINCT a.id) >= 2
        ORDER BY COUNT(DISTINCT a.id) DESC
        LIMIT 10
      `, [did]),

      // 5. Asistencia últimos 30 días en los grupos del docente
      db.query(`
        SELECT g.nombre AS grupo, g.grado,
          COUNT(*) AS total,
          ROUND(SUM(CASE WHEN ast.estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0), 1) AS tasa
        FROM asistencias ast
        JOIN grupos g ON g.id = ast.grupo_id
        JOIN docente_grupos_materias dgm ON dgm.grupo_id = g.id AND dgm.docente_id = ?
        WHERE ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY g.id
      `, [did]),

      // 6. Actividades recientes: cuántas completadas vs pendientes
      db.query(`
        SELECT a.titulo, a.periodo, g.nombre AS grupo, g.grado, m.nombre AS materia,
          COUNT(DISTINCT eg.estudiante_id) AS total_estudiantes,
          COUNT(DISTINCT ra.estudiante_id) AS completaron,
          ROUND(AVG(ra.nota), 1) AS promedio
        FROM actividades a
        JOIN grupos g ON g.id = a.grupo_id
        JOIN materias m ON m.id = a.materia_id
        LEFT JOIN estudiante_grupos eg ON eg.grupo_id = a.grupo_id
        LEFT JOIN (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) ra ON ra.actividad_id = a.id
        WHERE a.docente_id = ? AND a.activa = TRUE
          AND a.creado_en >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
        GROUP BY a.id
        ORDER BY a.creado_en DESC
        LIMIT 8
      `, [did]),
    ]);

    const contexto = [
      `DOCENTE: ${docenteRow?.nombre || 'Sin nombre'} — Colegio: ${docenteRow?.colegio || ''}`,
      `FECHA: ${new Date().toLocaleDateString('es-CO')}`,
      '',
      'GRUPOS Y MATERIAS ASIGNADOS:',
      asignacionesRows.length > 0
        ? asignacionesRows.map(a => `- Grado ${a.grado}° ${a.grupo} · ${a.materia} (${a.estudiantes} estudiantes)`).join('\n')
        : '- Sin asignaciones',
      '',
      'RENDIMIENTO POR GRUPO/MATERIA (de menor a mayor promedio):',
      rendimientoRows.length > 0
        ? rendimientoRows.map(r =>
            `- Grado ${r.grado}° ${r.grupo} · ${r.materia}: promedio ${r.promedio ?? '—'}, aprobación ${r.pct_aprobacion ?? 0}%, ${r.bajo || 0} en Bajo`
          ).join('\n')
        : '- Sin datos de calificaciones',
      '',
      'ASISTENCIA ÚLTIMOS 30 DÍAS:',
      asistenciaRows.length > 0
        ? asistenciaRows.map(a => `- Grado ${a.grado}° ${a.grupo}: ${a.tasa}% (${a.total} registros)`).join('\n')
        : '- Sin registros de asistencia',
      '',
      'ESTUDIANTES EN RIESGO ALTO O CRÍTICO:',
      riesgoRows.length > 0
        ? riesgoRows.map(r => `- ${r.estudiante} en ${r.materia} (Grado ${r.grado}° ${r.grupo}) — score ${r.score} [${r.nivel}]`).join('\n')
        : '- Ninguno detectado',
      '',
      'ALERTAS ACTIVAS (nota < 3.5 en 2+ actividades):',
      alertasRows.length > 0
        ? alertasRows.map(a => `- ${a.estudiante} en ${a.materia} (${a.grupo}): ${a.actividades_bajo} actividades bajo 3.5, peor nota ${a.peor_nota}`).join('\n')
        : '- Sin alertas activas',
      '',
      'ACTIVIDADES RECIENTES (últimas 4 semanas):',
      actividadesRows.length > 0
        ? actividadesRows.map(a =>
            `- "${a.titulo}" (${a.materia} · P${a.periodo} · Grado ${a.grado}° ${a.grupo}): ${a.completaron}/${a.total_estudiantes} completaron, promedio ${a.promedio ?? '—'}`
          ).join('\n')
        : '- Sin actividades recientes',
    ].join('\n');

    const mensaje = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: `Eres el Copiloto Académico personal del docente ${docenteRow?.nombre || ''} del colegio ${docenteRow?.colegio || ''}. Ayudas al docente con análisis de sus propios grupos y estudiantes. Responde siempre en español, de forma concisa y con recomendaciones concretas y accionables (máximo 220 palabras). Usa la escala MEN colombiana: Bajo (<3.0), Básico (3.0–3.9), Alto (4.0–4.5), Superior (4.6–5.0). Si la pregunta está fuera del contexto educativo, redirige amablemente. No inventes datos que no estén en el contexto.

CONTEXTO ACTUAL DEL DOCENTE:
${contexto}`,
      messages: [{ role: 'user', content: pregunta.trim() }],
    });

    res.json({ data: { respuesta: mensaje.content[0].text } });
  } catch (err) {
    console.error('Error en copiloto docente:', err);
    res.status(500).json({ error: 'Error al consultar el copiloto. Verifica la API key.' });
  }
}

module.exports = { preguntar, preguntarDocente };
