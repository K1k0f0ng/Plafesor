'use strict';
const db = require('../database');
const { scoreNota, scoreAsistencia, scorePendientes, nivelDeScore } = require('../utils/riesgoUtils');

// POST /api/riesgo/colegio/:colegio_id/calcular
async function calcularRiesgo(req, res) {
  const colegioId = parseInt(req.params.colegio_id);

  if (req.usuario.colegio_id !== colegioId) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const [baseData] = await db.query(
      `SELECT
        ra.estudiante_id,
        a.materia_id,
        eg.grupo_id,
        ROUND(AVG(ra.nota), 2)          AS promedio,
        COUNT(DISTINCT ra.actividad_id) AS completadas,
        (
          SELECT COUNT(*) FROM actividades a2
          WHERE a2.grupo_id   = eg.grupo_id
            AND a2.materia_id = a.materia_id
            AND a2.activa     = TRUE
        ) AS total_actividades
      FROM resultados_actividades ra
      JOIN actividades a
        ON  a.id     = ra.actividad_id
        AND a.activa = TRUE
      JOIN estudiante_grupos eg
        ON  eg.estudiante_id = ra.estudiante_id
        AND eg.grupo_id      = a.grupo_id
      JOIN grupos g ON g.id = eg.grupo_id
      WHERE g.colegio_id = ?
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
      GROUP BY ra.estudiante_id, a.materia_id, eg.grupo_id`,
      [colegioId]
    );

    if (!baseData.length) {
      return res.json({ data: { calculados: 0 } });
    }

    const [asistData] = await db.query(
      `SELECT
        ast.estudiante_id,
        ast.grupo_id,
        COUNT(*)                    AS total_registros,
        SUM(ast.estado = 'ausente') AS ausencias
      FROM asistencias ast
      JOIN grupos g ON g.id = ast.grupo_id
      WHERE g.colegio_id = ?
        AND ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY ast.estudiante_id, ast.grupo_id`,
      [colegioId]
    );

    const asistMap = {};
    for (const a of asistData) {
      asistMap[`${a.estudiante_id}_${a.grupo_id}`] = a;
    }

    const insertValues = [];
    for (const row of baseData) {
      const promedio    = parseFloat(row.promedio)         || 0;
      const completadas = parseInt(row.completadas)        || 0;
      const totalActs   = parseInt(row.total_actividades)  || 0;
      const pendientes  = Math.max(0, totalActs - completadas);
      const asist       = asistMap[`${row.estudiante_id}_${row.grupo_id}`]
                          || { ausencias: 0, total_registros: 0 };

      const fNota  = scoreNota(promedio);
      const fAsist = scoreAsistencia(
        parseInt(asist.ausencias)       || 0,
        parseInt(asist.total_registros) || 0
      );
      const fPend  = scorePendientes(pendientes, totalActs);
      const score  = Math.round(0.4 * fNota + 0.3 * fAsist + 0.3 * fPend);
      const nivel  = nivelDeScore(score);

      insertValues.push([
        row.estudiante_id,
        row.materia_id,
        row.grupo_id,
        colegioId,
        score,
        nivel,
        JSON.stringify({ nota: fNota, asistencia: fAsist, pendientes: fPend }),
      ]);
    }

    await db.query(
      `INSERT INTO predicciones_riesgo
         (estudiante_id, materia_id, grupo_id, colegio_id, score, nivel, factores)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         score    = VALUES(score),
         nivel    = VALUES(nivel),
         factores = VALUES(factores)`,
      [insertValues]
    );

    res.json({ data: { calculados: insertValues.length } });

  } catch (err) {
    console.error('[Riesgo] calcularRiesgo error:', err.message);
    res.status(500).json({ error: 'Error al calcular el riesgo', detalle: err.message });
  }
}

// GET /api/riesgo/colegio/:colegio_id
async function obtenerRiesgo(req, res) {
  const colegioId = parseInt(req.params.colegio_id);

  if (req.usuario.colegio_id !== colegioId) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  try {
    const [rows] = await db.query(
      `SELECT
        pr.estudiante_id,
        pr.score,
        pr.nivel,
        pr.factores,
        pr.calculado_en,
        u.nombre AS nombre_estudiante,
        m.nombre AS nombre_materia,
        g.nombre AS nombre_grupo,
        g.grado,
        pr.grupo_id,
        pr.materia_id
      FROM predicciones_riesgo pr
      JOIN usuarios u ON u.id = pr.estudiante_id
      JOIN materias m ON m.id = pr.materia_id
      JOIN grupos   g ON g.id = pr.grupo_id
      WHERE pr.colegio_id = ?
      ORDER BY pr.score DESC`,
      [colegioId]
    );

    res.json({ data: rows });

  } catch (err) {
    console.error('[Riesgo] obtenerRiesgo error:', err.message);
    res.status(500).json({ error: 'Error al obtener predicciones', detalle: err.message });
  }
}

// POST /api/riesgo/notificar-padre
async function notificarPadre(req, res) {
  const { estudiante_id, materia_id, grupo_id, score, nivel } = req.body;
  if (!estudiante_id || !grupo_id) {
    return res.status(400).json({ error: 'estudiante_id y grupo_id son obligatorios' });
  }

  try {
    const [[info]] = await db.query(
      `SELECT
        u.nombre          AS estudiante,
        u.telefono_padres,
        m.nombre          AS materia,
        g.nombre          AS grupo,
        g.grado,
        g.colegio_id      AS colegio_id,
        c.nombre          AS colegio
      FROM usuarios  u
      JOIN grupos    g ON g.id = ?
      JOIN colegios  c ON c.id = g.colegio_id
      LEFT JOIN materias m ON m.id = ?
      WHERE u.id = ?`,
      [grupo_id, materia_id || null, estudiante_id]
    );

    if (!info) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (info.colegio_id !== req.usuario.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
    }
    if (!info.telefono_padres) {
      return res.status(422).json({ error: 'Este estudiante no tiene teléfono de padres registrado' });
    }

    const { enviarMensaje } = require('../services/whatsappService');
    const NIVEL_TEXTO = {
      critico: 'CRÍTICO 🔴', alto: 'ALTO 🟠', medio: 'MEDIO 🟡', bajo: 'BAJO 🟢',
    };

    const mensaje = [
      `📚 *Playfesor — Alerta de Riesgo Académico*`,
      ``,
      `Estimado padre/madre de *${info.estudiante}*,`,
      ``,
      `El sistema ha identificado un nivel de riesgo *${NIVEL_TEXTO[nivel] || nivel}* en *${info.materia || 'sus materias'}* (Grado ${info.grado}° ${info.grupo}).`,
      ``,
      `📊 Puntaje de riesgo: *${score}/100*`,
      ``,
      `Le invitamos a comunicarse con la institución para coordinar un plan de acompañamiento.`,
      ``,
      `_${info.colegio}_`,
    ].join('\n');

    const resultado = await enviarMensaje(info.telefono_padres, mensaje);
    if (!resultado.ok) {
      return res.status(500).json({ error: 'No se pudo enviar el mensaje', detalle: resultado.razon });
    }

    res.json({ mensaje: 'Notificación enviada correctamente', data: { telefono: info.telefono_padres } });

  } catch (err) {
    console.error('[Riesgo] notificarPadre error:', err.message);
    res.status(500).json({ error: 'Error al enviar la notificación', detalle: err.message });
  }
}

// POST /api/riesgo/generar-pmi
async function generarPMI(req, res) {
  const { estudiante_id, materia_id, grupo_id, score, nivel, factores } = req.body;
  if (!estudiante_id || !grupo_id) {
    return res.status(400).json({ error: 'estudiante_id y grupo_id son obligatorios' });
  }

  try {
    const [[grupoInfo]] = await db.query('SELECT colegio_id FROM grupos WHERE id = ?', [grupo_id]);
    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (grupoInfo.colegio_id !== req.usuario.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    const [[info], [stats]] = await Promise.all([
      db.query(
        `SELECT u.nombre AS estudiante, m.nombre AS materia,
                g.nombre AS grupo, g.grado, c.nombre AS colegio
         FROM usuarios  u
         JOIN grupos    g ON g.id = ?
         JOIN colegios  c ON c.id = g.colegio_id
         LEFT JOIN materias m ON m.id = ?
         WHERE u.id = ?`,
        [grupo_id, materia_id || null, estudiante_id]
      ),
      db.query(
        `SELECT
           ROUND(AVG(ra.nota), 1) AS promedio,
           (SELECT ROUND(SUM(estado IN ('presente','tardanza')) * 100.0 / NULLIF(COUNT(*),0), 1)
            FROM asistencias
            WHERE estudiante_id = ?
              AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS asistencia_pct
         FROM resultados_actividades ra
         JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
         WHERE ra.estudiante_id = ? AND a.materia_id = ?
           AND ra.id = (
             SELECT ra2.id FROM resultados_actividades ra2
             WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
             ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
           )`,
        [estudiante_id, estudiante_id, materia_id || 0]
      ),
    ]);

    const f = typeof factores === 'string' ? JSON.parse(factores) : (factores || {});
    const Anthropic = require('@anthropic-ai/sdk');
    const { CLAUDE_MODEL } = require('../config/ia');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `Eres un experto en pedagogía colombiana. Elabora un Plan de Mejoramiento Individual (PMI) formal según lineamientos MEN.

Datos del estudiante:
- Nombre: ${info?.estudiante || 'Estudiante'}
- Materia: ${info?.materia || 'Materia'}
- Grado: ${info?.grado || '?'}° ${info?.grupo || ''}
- Colegio: ${info?.colegio || ''}
- Promedio actual: ${stats?.promedio ?? 'sin datos'}
- Asistencia últimos 30 días: ${stats?.asistencia_pct ?? 'sin datos'}%
- Riesgo: ${nivel?.toUpperCase() || ''} (score ${score}/100)
- Factor notas: ${f.nota || 0}/100 — Factor inasistencias: ${f.asistencia || 0}/100 — Factor pendientes: ${f.pendientes || 0}/100

Genera el PMI con estas secciones exactas:

**1. DIAGNÓSTICO**
[2-3 oraciones sobre la situación actual]

**2. ACCIONES PARA EL DOCENTE**
- [Acción concreta 1]
- [Acción concreta 2]
- [Acción concreta 3]

**3. RECOMENDACIONES PARA LOS PADRES**
- [Recomendación práctica 1]
- [Recomendación práctica 2]
- [Recomendación práctica 3]

**4. METAS A 4 SEMANAS**
- [Meta medible con nota o porcentaje específico]
- [Meta medible con nota o porcentaje específico]

**5. ACTIVIDADES DE REFUERZO**
- [Actividad específica para la materia 1]
- [Actividad específica para la materia 2]
- [Actividad específica para la materia 3]

Máximo 280 palabras. Tono profesional institucional colombiano. Metas específicas y medibles.`;

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 750,
      messages: [{ role: 'user', content: prompt }],
    });

    const pmi = message.content[0].text;
    res.json({ data: { pmi, estudiante: info?.estudiante, materia: info?.materia, nivel, score } });

  } catch (err) {
    console.error('[Riesgo] generarPMI error:', err.message);
    res.status(500).json({ error: 'Error al generar el PMI', detalle: err.message });
  }
}

module.exports = { calcularRiesgo, obtenerRiesgo, notificarPadre, generarPMI };
