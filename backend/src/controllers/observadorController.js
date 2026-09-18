const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/observador/colegio/:colegio_id/grupos-materias
async function listarGruposYMaterias(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes consultar datos de tu colegio' });
  }

  try {
    const [rows] = await db.query(`
      SELECT DISTINCT
        g.id   AS grupo_id,
        g.nombre AS nombre_grupo,
        g.grado,
        m.id   AS materia_id,
        m.nombre AS nombre_materia
      FROM actividades a
      JOIN grupos   g ON g.id = a.grupo_id
      JOIN materias m ON m.id = a.materia_id
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      WHERE g.colegio_id = ? AND a.activa = TRUE
      ORDER BY ga.orden ASC, g.nombre ASC, m.nombre ASC
    `, [colegio_id]);

    const grupoMap = {};
    for (const row of rows) {
      if (!grupoMap[row.grupo_id]) {
        grupoMap[row.grupo_id] = {
          grupo_id:  row.grupo_id,
          nombre:    row.nombre_grupo,
          grado:     row.grado,
          materias:  [],
        };
      }
      grupoMap[row.grupo_id].materias.push({
        materia_id: row.materia_id,
        nombre:     row.nombre_materia,
      });
    }

    res.json({ data: Object.values(grupoMap) });
  } catch (err) {
    console.error('Error en listarGruposYMaterias:', err);
    res.status(500).json({ error: 'Error al cargar grupos' });
  }
}

// POST /api/observador/grupo/:grupo_id/materia/:materia_id
async function generarObservacion(req, res) {
  const { grupo_id, materia_id } = req.params;

  try {
    const [[grupoInfo]] = await db.query(`
      SELECT g.nombre AS grupo, g.grado, c.nombre AS colegio
      FROM grupos g JOIN colegios c ON c.id = g.colegio_id
      WHERE g.id = ?
    `, [grupo_id]);

    const [[materiaInfo]] = await db.query(
      'SELECT nombre FROM materias WHERE id = ?', [materia_id]
    );

    if (!grupoInfo || !materiaInfo) {
      return res.status(404).json({ error: 'Grupo o materia no encontrados' });
    }

    const [
      [statsRows],
      [estudiantesRows],
      [tendenciaRows],
      [actDificilesRows],
      [asistenciaRows],
      [comparacionRows],
    ] = await Promise.all([

      // Estadísticas generales
      db.query(`
        SELECT
          ROUND(AVG(ra.nota), 2)                                                         AS promedio,
          COUNT(ra.id)                                                                    AS total,
          COUNT(DISTINCT ra.estudiante_id)                                               AS estudiantes,
          SUM(CASE WHEN ra.nota < 3.5              THEN 1 ELSE 0 END)                  AS bajo,
          SUM(CASE WHEN ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END)          AS basico,
          SUM(CASE WHEN ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END)          AS alto,
          SUM(CASE WHEN ra.nota > 4.5              THEN 1 ELSE 0 END)                  AS superior,
          ROUND(SUM(CASE WHEN ra.nota >= 3.5 THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(ra.id), 0), 1)                                               AS tasa_aprobacion
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE a.grupo_id = ? AND a.materia_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
      `, [grupo_id, materia_id]),

      // Promedio por estudiante
      db.query(`
        SELECT
          u.nombre,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(DISTINCT ra.actividad_id) AS actividades_completadas
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN usuarios   u ON u.id  = ra.estudiante_id
        WHERE a.grupo_id = ? AND a.materia_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY ra.estudiante_id, u.nombre
        ORDER BY promedio ASC
      `, [grupo_id, materia_id]),

      // Tendencia semanal
      db.query(`
        SELECT
          YEARWEEK(ra.completada_en, 1)    AS semana,
          DATE(MIN(ra.completada_en))      AS fecha,
          ROUND(AVG(ra.nota), 2)           AS promedio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE a.grupo_id = ? AND a.materia_id = ?
          AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY YEARWEEK(ra.completada_en, 1)
        ORDER BY semana ASC
      `, [grupo_id, materia_id]),

      // Actividades con menor desempeño
      db.query(`
        SELECT
          a.titulo,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(ra.id)           AS respuestas
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE a.grupo_id = ? AND a.materia_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY a.id, a.titulo
        ORDER BY promedio ASC
        LIMIT 4
      `, [grupo_id, materia_id]),

      // Asistencia últimos 30 días
      db.query(`
        SELECT
          COUNT(*) AS total,
          ROUND(SUM(CASE WHEN estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 1) AS tasa
        FROM asistencias
        WHERE grupo_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [grupo_id]),

      // Promedio del colegio en la misma materia
      db.query(`
        SELECT ROUND(AVG(ra.nota), 2) AS promedio_colegio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN grupos g ON g.id = a.grupo_id
        WHERE a.materia_id = ?
          AND g.colegio_id = (SELECT colegio_id FROM grupos WHERE id = ?)
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
      `, [materia_id, grupo_id]),
    ]);

    const stats = statsRows[0] || {};
    const total = (stats.bajo || 0) + (stats.basico || 0) + (stats.alto || 0) + (stats.superior || 0);
    const pct = (n) => total ? `${Math.round(((n || 0) / total) * 100)}%` : '0%';

    const estudiantesRiesgo = estudiantesRows.filter(e => parseFloat(e.promedio) < 3.0);
    const estudiantesBuenos = estudiantesRows.filter(e => parseFloat(e.promedio) >= 4.0);

    let tendenciaTexto = 'Sin suficientes datos de tendencia';
    if (tendenciaRows.length >= 2) {
      const primero = tendenciaRows[0];
      const ultimo  = tendenciaRows[tendenciaRows.length - 1];
      const diferencia = (parseFloat(ultimo.promedio) - parseFloat(primero.promedio)).toFixed(2);
      const direccion  = diferencia > 0 ? '↑ ascendente' : diferencia < 0 ? '↓ descendente' : '→ estable';
      tendenciaTexto = `${direccion} (${primero.promedio} → ${ultimo.promedio}, cambio: ${diferencia > 0 ? '+' : ''}${diferencia}) en ${tendenciaRows.length} semanas`;
    } else if (tendenciaRows.length === 1) {
      tendenciaTexto = `Solo 1 semana de datos: promedio ${tendenciaRows[0].promedio}`;
    }

    const contexto = [
      `COLEGIO: ${grupoInfo.colegio}`,
      `GRUPO: Grado ${grupoInfo.grado}° ${grupoInfo.grupo}`,
      `MATERIA: ${materiaInfo.nombre}`,
      `FECHA DEL ANÁLISIS: ${new Date().toLocaleDateString('es-CO')}`,
      '',
      'ESTADÍSTICAS DEL GRUPO EN ESTA MATERIA:',
      `- Promedio del grupo: ${stats.promedio ?? 'sin datos'}`,
      `- Promedio del colegio en ${materiaInfo.nombre}: ${comparacionRows[0]?.promedio_colegio ?? 'sin datos'}`,
      `- Total evaluaciones: ${stats.total || 0}`,
      `- Estudiantes evaluados: ${stats.estudiantes || 0}`,
      `- Tasa de aprobación: ${stats.tasa_aprobacion ?? 0}%`,
      `- Distribución MEN: Bajo ${pct(stats.bajo)} | Básico ${pct(stats.basico)} | Alto ${pct(stats.alto)} | Superior ${pct(stats.superior)}`,
      '',
      'TENDENCIA DE LAS ÚLTIMAS 8 SEMANAS:',
      tendenciaTexto,
      '',
      'ACTIVIDADES CON MENOR DESEMPEÑO:',
      actDificilesRows.length > 0
        ? actDificilesRows.map(a => `- "${a.titulo}": promedio ${a.promedio}`).join('\n')
        : '- Sin datos de actividades',
      '',
      'ESTUDIANTES EN NIVEL BAJO (promedio < 3.5):',
      estudiantesRiesgo.length > 0
        ? estudiantesRiesgo.map(e => `- ${e.nombre}: ${e.promedio}`).join('\n')
        : '- Ninguno en nivel bajo',
      '',
      'ESTUDIANTES EN NIVEL ALTO O SUPERIOR (promedio ≥ 4.0):',
      estudiantesBuenos.length > 0
        ? estudiantesBuenos.map(e => `- ${e.nombre}: ${e.promedio}`).join('\n')
        : '- Ninguno en nivel alto o superior',
      '',
      'ASISTENCIA AL GRUPO (últimos 30 días):',
      `- Tasa de asistencia: ${asistenciaRows[0]?.tasa ?? 'sin datos'}%`,
      `- Registros totales: ${asistenciaRows[0]?.total ?? 0}`,
    ].join('\n');

    const mensaje = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 950,
      system: `Eres un observador pedagógico experto del sistema educativo colombiano MEN. Redactas informes académicos institucionales profesionales. Escala de valoración: Bajo (<3.5), Básico (3.5–3.9), Alto (4.0–4.5), Superior (4.6–5.0). Tono: objetivo, constructivo y formal. Cuando mencionas estudiantes en riesgo, incluyes sus nombres para que el docente pueda actuar. Escribes en español formal colombiano.`,
      messages: [{
        role: 'user',
        content: `Genera una observación académica institucional para el grupo ${grupoInfo.grado}° ${grupoInfo.grupo} en la materia ${materiaInfo.nombre}.

El informe debe tener exactamente estas secciones:
1. DIAGNÓSTICO ACTUAL (2-3 oraciones sobre el estado general)
2. TENDENCIAS Y PATRONES (2-3 oraciones sobre la evolución y patrones detectados)
3. ESTUDIANTES CON ATENCIÓN PRIORITARIA (lista con nombres si hay en riesgo, o indicar que no hay)
4. RECOMENDACIONES PEDAGÓGICAS (3-4 recomendaciones concretas y accionables)
5. PERSPECTIVA Y CONCLUSIÓN (1-2 oraciones mirando hacia adelante)

Longitud total: entre 280 y 380 palabras.

DATOS REALES DEL GRUPO:
${contexto}`,
      }],
    });

    res.json({
      data: {
        observacion:        mensaje.content[0].text,
        generado_en:        new Date().toISOString(),
        grupo:              `Grado ${grupoInfo.grado}° ${grupoInfo.grupo}`,
        materia:            materiaInfo.nombre,
      },
    });
  } catch (err) {
    console.error('Error generando observación:', err);
    res.status(500).json({ error: 'Error al generar la observación académica' });
  }
}

module.exports = { listarGruposYMaterias, generarObservacion };
