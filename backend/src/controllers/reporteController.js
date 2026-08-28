const db = require('../database');
const { ordenApellido } = require('../utils/ordenNombre');

// GET /api/reportes/docente/:id — todas las actividades del docente con estadísticas
async function reporteDocente(req, res) {
  const { id } = req.params;

  // Un docente solo puede ver sus propios reportes
  if (req.usuario.rol === 'docente' && req.usuario.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Solo puedes ver tus propios reportes' });
  }

  try {
    const [filas] = await db.query(`
      SELECT
        a.id, a.titulo, a.tipo, a.periodo,
        g.nombre AS nombre_grupo, g.grado,
        m.nombre AS nombre_materia,
        (SELECT COUNT(DISTINCT estudiante_id) FROM resultados_actividades WHERE actividad_id = a.id) AS estudiantes_completaron,
        (SELECT COUNT(*) FROM resultados_actividades WHERE actividad_id = a.id) AS total_intentos,
        ROUND(AVG(mejores.nota), 1) AS nota_promedio,
        MIN(mejores.nota) AS nota_minima,
        MAX(mejores.nota) AS nota_maxima
      FROM actividades a
      JOIN grupos g ON g.id = a.grupo_id
      JOIN materias m ON m.id = a.materia_id
      LEFT JOIN (
        SELECT actividad_id, estudiante_id, MAX(nota) AS nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) mejores ON mejores.actividad_id = a.id
      WHERE a.docente_id = ?
      GROUP BY a.id
      ORDER BY a.periodo ASC, m.nombre ASC, a.creado_en DESC
    `, [id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en reporte docente:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
}

// GET /api/reportes/grupo/:grupo_id/materia/:materia_id
async function reporteGrupoMateria(req, res) {
  const { grupo_id, materia_id } = req.params;

  try {
    const [[grupo]] = await db.query(
      'SELECT colegio_id FROM grupos WHERE id = ?', [grupo_id]
    );
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    if (req.usuario.rol !== 'admin' && grupo.colegio_id !== req.usuario.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const [filas] = await db.query(`
      SELECT
        u.id AS estudiante_id, u.nombre AS nombre_estudiante,
        a.id AS actividad_id, a.titulo, a.periodo,
        ra.nota, ra.intento_numero, ra.completada_en,
        CASE
          WHEN ra.nota IS NULL THEN 'Pendiente'
          WHEN ra.nota < 3.5 THEN 'Bajo'
          WHEN ra.nota < 4.0 THEN 'Básico'
          WHEN ra.nota <= 4.5 THEN 'Alto'
          ELSE 'Superior'
        END AS nivel_desempeno
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id
      CROSS JOIN actividades a
      LEFT JOIN resultados_actividades ra
        ON ra.actividad_id = a.id AND ra.estudiante_id = u.id
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      WHERE eg.grupo_id = ?
        AND a.grupo_id = ?
        AND a.materia_id = ?
        AND a.activa = TRUE
      ORDER BY ${ordenApellido('u.nombre')} ASC, a.periodo ASC, a.titulo ASC
    `, [grupo_id, grupo_id, materia_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en reporte grupo/materia:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
}

// GET /api/reportes/colegio/:colegio_id/resumen?periodo=1|2|3
async function resumenColegio(req, res) {
  const { colegio_id } = req.params;
  const { periodo } = req.query;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  const periodoFiltro = periodo && ['1', '2', '3'].includes(periodo) ? periodo : null;
  const periodoSQL = periodoFiltro ? 'AND a.periodo = ?' : '';
  const queryParams = periodoFiltro ? [periodoFiltro, parseInt(colegio_id)] : [parseInt(colegio_id)];

  try {
    const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [colegio_id]);

    const [grupos] = await db.query(`
      SELECT
        g.id AS grupo_id,
        g.nombre AS nombre_grupo,
        g.grado,
        COUNT(DISTINCT eg.estudiante_id)                                                       AS total_estudiantes,
        COUNT(DISTINCT a.id)                                                                   AS total_actividades,
        ROUND(AVG(ra.nota), 1)                                                                 AS promedio,
        SUM(CASE WHEN ra.nota IS NOT NULL AND ra.nota < 3.5             THEN 1 ELSE 0 END)    AS nivel_bajo,
        SUM(CASE WHEN ra.nota IS NOT NULL AND ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END) AS nivel_basico,
        SUM(CASE WHEN ra.nota IS NOT NULL AND ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END) AS nivel_alto,
        SUM(CASE WHEN ra.nota IS NOT NULL AND ra.nota > 4.5             THEN 1 ELSE 0 END)    AS nivel_superior
      FROM grupos g
      LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
      LEFT JOIN actividades a ON a.grupo_id = g.id AND a.activa = TRUE ${periodoSQL}
      LEFT JOIN (
        SELECT actividad_id, estudiante_id, MAX(nota) AS nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) ra ON ra.actividad_id = a.id
      WHERE g.colegio_id = ? AND g.activo = TRUE
      GROUP BY g.id, g.nombre, g.grado
      ORDER BY g.grado ASC, g.nombre ASC
    `, queryParams);

    res.json({ data: { colegio: colegio?.nombre || '', grupos } });
  } catch (err) {
    console.error('Error en resumen colegio:', err);
    res.status(500).json({ error: 'Error al generar el resumen del colegio' });
  }
}

// GET /api/reportes/alertas/docente/:docente_id
// Estudiantes con nota < 3.0 en 2 o más actividades distintas de la misma materia
async function alertasDocente(req, res) {
  const { docente_id } = req.params;

  if (req.usuario.rol === 'docente' && req.usuario.id !== parseInt(docente_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tus propias alertas' });
  }

  try {
    const [filas] = await db.query(`
      SELECT
        u.id                         AS estudiante_id,
        u.nombre                    AS nombre_estudiante,
        m.nombre                    AS nombre_materia,
        g.nombre                    AS nombre_grupo,
        g.grado,
        COUNT(DISTINCT a.id)        AS actividades_bajo,
        ROUND(MIN(mejores.nota), 1) AS peor_nota
      FROM (
        SELECT actividad_id, estudiante_id, MAX(nota) AS nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) mejores
      JOIN actividades a  ON a.id  = mejores.actividad_id AND a.activa = TRUE
      JOIN usuarios u     ON u.id  = mejores.estudiante_id
      JOIN materias m     ON m.id  = a.materia_id
      JOIN grupos g       ON g.id  = a.grupo_id
      WHERE a.docente_id = ?
        AND mejores.nota < 3.5
      GROUP BY mejores.estudiante_id, a.materia_id, a.grupo_id
      HAVING COUNT(DISTINCT a.id) >= 2
      ORDER BY COUNT(DISTINCT a.id) DESC, ${ordenApellido('u.nombre')} ASC
    `, [docente_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en alertas docente:', err);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
}

// GET /api/reportes/alertas/colegio/:colegio_id
async function alertasColegio(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const [filas] = await db.query(`
      SELECT
        u.id                         AS estudiante_id,
        u.nombre                    AS nombre_estudiante,
        m.nombre                    AS nombre_materia,
        g.nombre                    AS nombre_grupo,
        g.grado,
        COUNT(DISTINCT a.id)        AS actividades_bajo,
        ROUND(MIN(mejores.nota), 1) AS peor_nota
      FROM (
        SELECT actividad_id, estudiante_id, MAX(nota) AS nota
        FROM resultados_actividades
        GROUP BY actividad_id, estudiante_id
      ) mejores
      JOIN actividades a  ON a.id  = mejores.actividad_id AND a.activa = TRUE
      JOIN usuarios u     ON u.id  = mejores.estudiante_id
      JOIN materias m     ON m.id  = a.materia_id
      JOIN grupos g       ON g.id  = a.grupo_id
      WHERE g.colegio_id = ?
        AND mejores.nota < 3.5
      GROUP BY mejores.estudiante_id, a.materia_id, a.grupo_id
      HAVING COUNT(DISTINCT a.id) >= 2
      ORDER BY COUNT(DISTINCT a.id) DESC, ${ordenApellido('u.nombre')} ASC
    `, [colegio_id]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en alertas colegio:', err);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
}

// GET /api/reportes/colegio/:colegio_id/metricas?periodo=1|2|3
async function metricasColegio(req, res) {
  const { colegio_id } = req.params;
  const { periodo } = req.query;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  const p = periodo && ['1', '2', '3'].includes(periodo) ? periodo : null;
  const pCond = p ? 'AND a.periodo = ?' : '';
  const cid = parseInt(colegio_id);

  try {
    const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [cid]);

    const [
      [resumenRows],
      [materiasRows],
      [docentesRows],
      [tendenciaRows],
      [mapaRows],
      [asistenciaRows],
    ] = await Promise.all([

      // 1. Promedio institucional y distribución MEN
      db.query(`
        SELECT
          ROUND(AVG(ra.nota), 2)                                                              AS promedio,
          COUNT(ra.id)                                                                         AS total,
          SUM(CASE WHEN ra.nota < 3.5              THEN 1 ELSE 0 END)                        AS nivel_bajo,
          SUM(CASE WHEN ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END)               AS nivel_basico,
          SUM(CASE WHEN ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END)               AS nivel_alto,
          SUM(CASE WHEN ra.nota > 4.5              THEN 1 ELSE 0 END)                        AS nivel_superior
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE ${pCond}
        JOIN grupos g ON g.id = a.grupo_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
      `, p ? [p, cid] : [cid]),

      // 2. Promedio por materia
      db.query(`
        SELECT
          m.id AS materia_id, m.nombre,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(ra.id)           AS total,
          ROUND(SUM(CASE WHEN ra.nota >= 3.5 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ra.id), 0), 1) AS tasa_aprobacion
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE ${pCond}
        JOIN grupos g ON g.id = a.grupo_id
        JOIN materias m ON m.id = a.materia_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY m.id, m.nombre
        ORDER BY promedio ASC
      `, p ? [p, cid] : [cid]),

      // 3. Impacto por docente
      db.query(`
        SELECT
          u.id AS docente_id, u.nombre,
          ROUND(AVG(ra.nota), 1)        AS promedio,
          COUNT(DISTINCT a.id)          AS total_actividades,
          COUNT(DISTINCT a.grupo_id)    AS total_grupos
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE ${pCond}
        JOIN grupos g ON g.id = a.grupo_id
        JOIN usuarios u ON u.id = a.docente_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY u.id, u.nombre
        ORDER BY promedio DESC
      `, p ? [p, cid] : [cid]),

      // 4. Tendencia semanal (últimas 8 semanas, sin filtro de período)
      db.query(`
        SELECT
          YEARWEEK(ra.completada_en, 1)    AS semana_num,
          DATE(MIN(ra.completada_en))      AS fecha_inicio,
          ROUND(AVG(ra.nota), 2)           AS promedio,
          COUNT(ra.id)                     AS total
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN grupos g ON g.id = a.grupo_id
        WHERE g.colegio_id = ?
          AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY YEARWEEK(ra.completada_en, 1)
        ORDER BY semana_num ASC
      `, [cid]),

      // 5. Mapa de calor: grupo × materia
      db.query(`
        SELECT
          g.id AS grupo_id, g.nombre AS nombre_grupo, g.grado,
          m.id AS materia_id, m.nombre AS nombre_materia,
          ROUND(AVG(ra.nota), 1) AS promedio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE ${pCond}
        JOIN grupos g ON g.id = a.grupo_id
        JOIN materias m ON m.id = a.materia_id
        WHERE g.colegio_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY g.id, g.nombre, g.grado, m.id, m.nombre
        ORDER BY g.grado ASC, g.nombre ASC, m.nombre ASC
      `, p ? [p, cid] : [cid]),

      // 6. Tasa de asistencia últimos 30 días
      db.query(`
        SELECT
          COUNT(*)                                                                                  AS total,
          SUM(CASE WHEN a.estado IN ('presente','tardanza') THEN 1 ELSE 0 END)                   AS asistieron,
          SUM(CASE WHEN a.estado = 'ausente'                THEN 1 ELSE 0 END)                   AS ausentes,
          ROUND(SUM(CASE WHEN a.estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 1)                                                             AS tasa
        FROM asistencias a
        JOIN grupos g ON g.id = a.grupo_id
        WHERE g.colegio_id = ?
          AND a.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [cid]),
    ]);

    res.json({
      data: {
        colegio:    colegio?.nombre || '',
        resumen:    resumenRows[0] || {},
        materias:   materiasRows,
        docentes:   docentesRows,
        tendencia:  tendenciaRows,
        mapa_calor: mapaRows,
        asistencia: asistenciaRows[0] || {},
      },
    });
  } catch (err) {
    console.error('Error en métricas:', err);
    res.status(500).json({ error: 'Error al calcular las métricas' });
  }
}

// GET /api/reportes/colegio/:colegio_id/evaluacion-docentes
// Panel de apoyo para que el director evalúe a sus docentes con métricas
// objetivas de proceso (carga, seguimiento, alertas) en vez de un solo número.
// Usa "promedio de lo completado" a propósito (no regla de tres): esta vista
// compara docentes entre sí, no certifica la nota de un estudiante.
async function evaluacionDocentes(req, res) {
  const { colegio_id } = req.params;
  const cid = parseInt(colegio_id);

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== cid) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const [[baseRows], [rendimientoRows], [alertasRows]] = await Promise.all([

      // Carga: grupos, materias, estudiantes a cargo, actividades creadas
      db.query(`
        SELECT
          u.id AS docente_id, u.nombre, u.activo,
          COUNT(DISTINCT dgm.grupo_id)                              AS total_grupos,
          COUNT(DISTINCT dgm.materia_id)                            AS total_materias,
          COUNT(DISTINCT eg.estudiante_id)                          AS total_estudiantes,
          COUNT(DISTINCT CASE WHEN a.activa = TRUE THEN a.id END)   AS total_actividades,
          MAX(a.creado_en)                                         AS ultima_actividad
        FROM usuarios u
        LEFT JOIN docente_grupos_materias dgm ON dgm.docente_id = u.id
        LEFT JOIN grupos g             ON g.id = dgm.grupo_id AND g.activo = TRUE
        LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
        LEFT JOIN actividades a        ON a.docente_id = u.id
        WHERE u.rol = 'docente' AND u.colegio_id = ? AND u.activo = TRUE
        GROUP BY u.id, u.nombre, u.activo
        ORDER BY u.nombre ASC
      `, [cid]),

      // Seguimiento: % de actividades que sus estudiantes ya presentaron,
      // y promedio de lo ya calificado (no cuenta lo pendiente como 0 aquí)
      db.query(`
        SELECT
          a.docente_id,
          ROUND(SUM(CASE WHEN mejor.nota IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS cobertura,
          ROUND(AVG(mejor.nota), 1) AS promedio_completado
        FROM actividades a
        JOIN grupos            g  ON g.id = a.grupo_id AND g.activo = TRUE
        JOIN estudiante_grupos eg ON eg.grupo_id = g.id
        LEFT JOIN (
          SELECT actividad_id, estudiante_id, MAX(nota) AS nota
          FROM resultados_actividades
          GROUP BY actividad_id, estudiante_id
        ) mejor ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE g.colegio_id = ? AND a.activa = TRUE
        GROUP BY a.docente_id
      `, [cid]),

      // Estudiantes en alerta bajo cada docente (misma regla que alertasDocente)
      db.query(`
        SELECT docente_id, COUNT(DISTINCT estudiante_id) AS estudiantes_alerta
        FROM (
          SELECT a.docente_id, mejores.estudiante_id
          FROM (
            SELECT actividad_id, estudiante_id, MAX(nota) AS nota
            FROM resultados_actividades
            GROUP BY actividad_id, estudiante_id
          ) mejores
          JOIN actividades a ON a.id = mejores.actividad_id AND a.activa = TRUE
          JOIN grupos g      ON g.id = a.grupo_id AND g.activo = TRUE
          WHERE g.colegio_id = ? AND mejores.nota < 3.5
          GROUP BY a.docente_id, mejores.estudiante_id, a.materia_id, a.grupo_id
          HAVING COUNT(DISTINCT a.id) >= 2
        ) marcados
        GROUP BY docente_id
      `, [cid]),
    ]);

    const rendimientoPorDocente = new Map(rendimientoRows.map(r => [r.docente_id, r]));
    const alertasPorDocente     = new Map(alertasRows.map(r => [r.docente_id, r.estudiantes_alerta]));

    const docentes = baseRows.map(d => {
      const rend = rendimientoPorDocente.get(d.docente_id) || {};
      return {
        docente_id:         d.docente_id,
        nombre:             d.nombre,
        total_grupos:       d.total_grupos,
        total_materias:     d.total_materias,
        total_estudiantes:  d.total_estudiantes,
        total_actividades:  d.total_actividades,
        ultima_actividad:   d.ultima_actividad,
        cobertura:          rend.cobertura !== undefined ? parseFloat(rend.cobertura) : null,
        promedio_completado: rend.promedio_completado !== undefined && rend.promedio_completado !== null
          ? parseFloat(rend.promedio_completado) : null,
        estudiantes_alerta: alertasPorDocente.get(d.docente_id) || 0,
      };
    });

    res.json({ data: docentes });
  } catch (err) {
    console.error('Error en evaluación de docentes:', err);
    res.status(500).json({ error: 'Error al calcular la evaluación de docentes' });
  }
}

// GET /api/reportes/colegio/:colegio_id/comparativas
// Compara promedios institucionales, por grupo y por materia entre períodos.
// Regla de tres: cada actividad asignada cuenta en el denominador aunque el
// estudiante no la haya presentado (cuenta como 0), igual que en el boletín.
async function comparativasPeriodos(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  const MEJOR_INTENTO = `
    SELECT actividad_id, estudiante_id, MAX(nota) AS nota
    FROM resultados_actividades
    GROUP BY actividad_id, estudiante_id
  `;

  try {
    const [institucional, porGrupo, porMateria, periodos] = await Promise.all([

      // Promedio institucional por período
      db.query(`
        SELECT
          a.periodo,
          ROUND(SUM(COALESCE(mejor.nota, 0)) / COUNT(*), 2) AS promedio,
          COUNT(DISTINCT eg.estudiante_id)                  AS estudiantes,
          COUNT(DISTINCT a.id)                               AS actividades
        FROM actividades a
        JOIN grupos             g  ON g.id  = a.grupo_id AND g.activo = TRUE
        JOIN estudiante_grupos  eg ON eg.grupo_id = g.id
        LEFT JOIN (${MEJOR_INTENTO}) mejor
          ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE g.colegio_id = ? AND a.activa = TRUE
        GROUP BY a.periodo
        ORDER BY a.periodo
      `, [colegio_id]),

      // Promedio por grupo × período
      db.query(`
        SELECT
          a.periodo,
          g.id                                               AS grupo_id,
          g.nombre                                            AS grupo,
          g.grado,
          ROUND(SUM(COALESCE(mejor.nota, 0)) / COUNT(*), 2)  AS promedio
        FROM actividades a
        JOIN grupos             g  ON g.id  = a.grupo_id AND g.activo = TRUE
        JOIN estudiante_grupos  eg ON eg.grupo_id = g.id
        LEFT JOIN (${MEJOR_INTENTO}) mejor
          ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE g.colegio_id = ? AND a.activa = TRUE
        GROUP BY a.periodo, g.id
        ORDER BY g.grado ASC, g.nombre ASC, a.periodo ASC
      `, [colegio_id]),

      // Promedio por materia × período
      db.query(`
        SELECT
          a.periodo,
          m.id                                               AS materia_id,
          m.nombre                                            AS materia,
          ROUND(SUM(COALESCE(mejor.nota, 0)) / COUNT(*), 2)  AS promedio
        FROM actividades a
        JOIN grupos             g  ON g.id  = a.grupo_id AND g.activo = TRUE
        JOIN estudiante_grupos  eg ON eg.grupo_id = g.id
        JOIN materias            m  ON m.id  = a.materia_id
        LEFT JOIN (${MEJOR_INTENTO}) mejor
          ON mejor.actividad_id = a.id AND mejor.estudiante_id = eg.estudiante_id
        WHERE g.colegio_id = ? AND a.activa = TRUE
        GROUP BY a.periodo, m.id
        ORDER BY m.nombre ASC, a.periodo ASC
      `, [colegio_id]),

      // Fechas reales de los períodos (si el colegio los tiene configurados)
      db.query(`
        SELECT numero, nombre, fecha_inicio, fecha_fin
        FROM periodos_academicos
        WHERE colegio_id = ?
        ORDER BY numero ASC
      `, [colegio_id]),
    ]);

    res.json({
      data: {
        institucional: institucional[0],
        por_grupo:     porGrupo[0],
        por_materia:   porMateria[0],
        periodos:      periodos[0],
      },
    });
  } catch (err) {
    console.error('Error en comparativas:', err);
    res.status(500).json({ error: 'Error al calcular las comparativas' });
  }
}

// GET /api/reportes/colegio/:colegio_id/gemelo
// Vista viva del colegio: salud académica, mapa de grados, riesgo y recomendaciones
async function gemeloDigital(req, res) {
  const { colegio_id } = req.params;
  const cid = parseInt(colegio_id);

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== cid) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const [
      [colegioRows],
      [promedioRows],
      [gruposRows],
      [riesgoRows],
      [asistenciaRows],
      [tendenciaRows],
      [planesRows],
    ] = await Promise.all([

      // 0. Nombre del colegio
      db.query('SELECT nombre FROM colegios WHERE id = ?', [cid]),

      // 1. Promedio institucional + distribución MEN (sobre notas registradas)
      db.query(`
        SELECT
          ROUND(AVG(ra.nota), 2) AS promedio,
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

      // 2. Datos por grupo: promedio, estudiantes, cuántos en riesgo alto/crítico
      db.query(`
        SELECT
          g.id   AS grupo_id,
          g.nombre AS grupo,
          g.grado,
          COUNT(DISTINCT eg.estudiante_id) AS total_estudiantes,
          ROUND(AVG(ra.nota), 1) AS promedio,
          COUNT(DISTINCT CASE WHEN pr.nivel IN ('alto','critico') THEN pr.estudiante_id END) AS en_riesgo
        FROM grupos g
        LEFT JOIN estudiante_grupos eg ON eg.grupo_id = g.id
        LEFT JOIN actividades a ON a.grupo_id = g.id AND a.activa = TRUE
        LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id AND ra.estudiante_id = eg.estudiante_id
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        LEFT JOIN predicciones_riesgo pr ON pr.estudiante_id = eg.estudiante_id AND pr.grupo_id = g.id
        WHERE g.colegio_id = ? AND g.activo = TRUE
        GROUP BY g.id, g.nombre, g.grado
        ORDER BY g.grado ASC, g.nombre ASC
      `, [cid]),

      // 3. Conteo de estudiantes por nivel de riesgo
      db.query(`
        SELECT nivel, COUNT(DISTINCT estudiante_id) AS total
        FROM predicciones_riesgo
        WHERE colegio_id = ?
        GROUP BY nivel
      `, [cid]),

      // 4. Asistencia: tasa de presencia últimos 30 días
      db.query(`
        SELECT
          COUNT(*) AS total,
          ROUND(SUM(CASE WHEN ast.estado IN ('presente','tardanza') THEN 1 ELSE 0 END)
            * 100.0 / NULLIF(COUNT(*), 0), 1) AS tasa_asistencia
        FROM asistencias ast
        JOIN grupos g ON g.id = ast.grupo_id
        WHERE g.colegio_id = ? AND ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [cid]),

      // 5. Tendencia: promedio semana actual vs semana anterior
      db.query(`
        SELECT
          ROUND(AVG(CASE WHEN ra.completada_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            THEN ra.nota END), 2) AS semana_actual,
          ROUND(AVG(CASE WHEN ra.completada_en >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            AND ra.completada_en < DATE_SUB(NOW(), INTERVAL 7 DAY)
            THEN ra.nota END), 2) AS semana_anterior
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

      // 6. Planes de mejoramiento activos
      db.query(`
        SELECT COUNT(*) AS total
        FROM planes_mejoramiento
        WHERE colegio_id = ? AND estado = 'activo'
      `, [cid]),
    ]);

    // Procesar mapa de riesgo
    const riesgoMap = { critico: 0, alto: 0, medio: 0, bajo: 0 };
    for (const r of riesgoRows) riesgoMap[r.nivel] = parseInt(r.total) || 0;

    const promedio       = parseFloat(promedioRows[0]?.promedio) || 0;
    const tasaAsistencia = parseFloat(asistenciaRows[0]?.tasa_asistencia);
    const tieneAsistencia = parseInt(asistenciaRows[0]?.total) > 0;
    const criticos       = riesgoMap.critico;
    const altos          = riesgoMap.alto;
    const planesActivos  = parseInt(planesRows[0]?.total) || 0;

    // Total estudiantes del colegio (suma de grupos)
    const totalEstudiantes = gruposRows.reduce((s, g) => s + (parseInt(g.total_estudiantes) || 0), 0);

    // Puntaje de salud 0-100
    const scoreAcademico  = Math.min((promedio / 5.0) * 100, 100);
    const scoreAsistencia = tieneAsistencia ? tasaAsistencia : 100;
    const pctRiesgo       = totalEstudiantes > 0 ? ((criticos + altos) / totalEstudiantes) * 100 : 0;
    const scoreSinRiesgo  = Math.max(0, 100 - pctRiesgo * 2);
    const puntuacion      = Math.round(scoreAcademico * 0.50 + scoreAsistencia * 0.30 + scoreSinRiesgo * 0.20);

    const estado = puntuacion >= 70 ? 'saludable' : puntuacion >= 50 ? 'atencion' : 'critico';

    // Tendencia
    const sa  = parseFloat(tendenciaRows[0]?.semana_actual);
    const saa = parseFloat(tendenciaRows[0]?.semana_anterior);
    let tendencia = 'estable';
    if (!isNaN(sa) && !isNaN(saa) && saa > 0) {
      if (sa - saa > 0.1) tendencia = 'subiendo';
      else if (saa - sa > 0.1) tendencia = 'bajando';
    }

    // Recomendaciones por reglas
    const recomendaciones = [];
    const grupoOrdenado = [...gruposRows].sort((a, b) => parseFloat(a.promedio) - parseFloat(b.promedio));
    const peorGrupo = grupoOrdenado[0];
    if (peorGrupo && parseFloat(peorGrupo.promedio) < 3.5) {
      recomendaciones.push(`Intervención urgente en ${peorGrupo.grado}° ${peorGrupo.grupo} — promedio ${peorGrupo.promedio}`);
    }
    if (criticos > 0) {
      recomendaciones.push(`${criticos} estudiante(s) en riesgo crítico — generar planes de mejoramiento esta semana`);
    }
    if (altos > 5) {
      recomendaciones.push(`${altos} estudiantes en riesgo alto — reforzar seguimiento semanal`);
    }
    if (tieneAsistencia && tasaAsistencia < 85) {
      recomendaciones.push(`Asistencia en ${tasaAsistencia}% — revisar ausentismo y contactar acudientes`);
    }
    if (tendencia === 'bajando') {
      recomendaciones.push('El promedio bajó esta semana — revisar actividades recientes y dificultades del grupo');
    }
    if (recomendaciones.length === 0) {
      recomendaciones.push('El colegio muestra buena salud académica — mantener el ritmo de actividades');
    }

    // Agrupar por grado para el mapa visual
    const gradosMap = {};
    for (const g of gruposRows) {
      if (!gradosMap[g.grado]) gradosMap[g.grado] = [];
      const prom = parseFloat(g.promedio);
      gradosMap[g.grado].push({
        grupo_id:         g.grupo_id,
        grupo:            g.grupo,
        grado:            g.grado,
        promedio:         isNaN(prom) ? null : prom,
        total_estudiantes: parseInt(g.total_estudiantes) || 0,
        en_riesgo:        parseInt(g.en_riesgo) || 0,
        estado:           !isNaN(prom) && prom >= 4.0 ? 'saludable' : !isNaN(prom) && prom >= 3.5 ? 'atencion' : 'critico',
      });
    }
    const grados = Object.keys(gradosMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(g => ({ grado: g, grupos: gradosMap[g] }));

    // Distribución MEN en porcentajes
    const totalNotas = (parseInt(promedioRows[0]?.bajo) || 0)
      + (parseInt(promedioRows[0]?.basico) || 0)
      + (parseInt(promedioRows[0]?.alto) || 0)
      + (parseInt(promedioRows[0]?.superior) || 0);
    const pct = n => (totalNotas > 0 ? Math.round((n / totalNotas) * 100) : 0);

    res.json({
      data: {
        colegio:              colegioRows[0]?.nombre || '',
        puntuacion,
        estado,
        tendencia,
        promedioInstitucional: promedio,
        totalEstudiantes,
        tasaAsistencia:       tieneAsistencia ? tasaAsistencia : null,
        planesActivos,
        riesgo: {
          critico:       criticos,
          alto:          altos,
          medio:         riesgoMap.medio,
          bajo:          riesgoMap.bajo,
          totalEnRiesgo: criticos + altos,
        },
        distribucionMEN: {
          bajo:     { cantidad: parseInt(promedioRows[0]?.bajo)     || 0, pct: pct(parseInt(promedioRows[0]?.bajo)     || 0) },
          basico:   { cantidad: parseInt(promedioRows[0]?.basico)   || 0, pct: pct(parseInt(promedioRows[0]?.basico)   || 0) },
          alto:     { cantidad: parseInt(promedioRows[0]?.alto)     || 0, pct: pct(parseInt(promedioRows[0]?.alto)     || 0) },
          superior: { cantidad: parseInt(promedioRows[0]?.superior) || 0, pct: pct(parseInt(promedioRows[0]?.superior) || 0) },
        },
        grados,
        recomendaciones,
      },
    });
  } catch (err) {
    console.error('Error en gemelo digital:', err);
    res.status(500).json({ error: 'Error al generar el Gemelo Digital' });
  }
}

module.exports = { reporteDocente, reporteGrupoMateria, resumenColegio, alertasDocente, alertasColegio, metricasColegio, evaluacionDocentes, comparativasPeriodos, gemeloDigital };
