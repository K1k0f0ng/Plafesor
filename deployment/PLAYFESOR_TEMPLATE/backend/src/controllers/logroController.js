'use strict';
const db = require('../database');

const LOGROS_DEF = [
  { tipo: 'primera_actividad',  label: 'Primera actividad',   desc: 'Completaste tu primera actividad' },
  { tipo: 'nota_perfecta',      label: 'Nota perfecta',        desc: 'Obtuviste 5.0 en una actividad' },
  { tipo: 'diez_actividades',   label: '10 actividades',       desc: 'Completaste 10 actividades' },
  { tipo: 'treinta_actividades',label: '30 actividades',       desc: 'Completaste 30 actividades' },
  { tipo: 'racha_3_dias',       label: 'Racha 3 días',         desc: '3 días seguidos con actividades' },
  { tipo: 'racha_7_dias',       label: 'Racha 7 días',         desc: '7 días seguidos estudiando' },
  { tipo: 'todo_aprobado',      label: 'Sin reprobar',         desc: 'Todas tus actividades con nota ≥ 3.5' },
  { tipo: 'sin_errores',        label: 'Sin errores',          desc: 'Completaste una actividad con 5.0' },
];

// Calcula racha actual de días consecutivos con al menos una actividad
async function calcularRacha(estudianteId) {
  const [dias] = await db.query(`
    SELECT DISTINCT DATE(completada_en) AS dia
    FROM resultados_actividades
    WHERE estudiante_id = ?
    ORDER BY dia DESC
  `, [estudianteId]);

  if (dias.length === 0) return 0;

  let racha = 1;
  let anterior = new Date(dias[0].dia);
  anterior.setHours(0, 0, 0, 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);

  // Si el último día activo no es hoy ni ayer, la racha se rompió
  if (anterior < ayer) return 0;

  for (let i = 1; i < dias.length; i++) {
    const actual = new Date(dias[i].dia);
    actual.setHours(0, 0, 0, 0);
    const diff = Math.round((anterior - actual) / (1000 * 60 * 60 * 24));
    if (diff === 1) { racha++; anterior = actual; }
    else break;
  }
  return racha;
}

// Verifica y otorga logros al estudiante (fire-and-forget)
async function verificarYOtorgar(estudianteId) {
  try {
    const [[stats]] = await db.query(`
      SELECT
        (SELECT COUNT(DISTINCT actividad_id) FROM resultados_actividades WHERE estudiante_id = ?) AS total,
        (SELECT COUNT(*) FROM resultados_actividades WHERE estudiante_id = ? AND nota = 5.0) AS notas_perfectas,
        (
          SELECT COUNT(*) FROM (
            SELECT MAX(nota) AS mejor_nota
            FROM resultados_actividades
            WHERE estudiante_id = ?
            GROUP BY actividad_id
          ) mejores
          WHERE mejor_nota < 3.5
        ) AS reprobadas
    `, [estudianteId, estudianteId, estudianteId]);

    const racha = await calcularRacha(estudianteId);
    const total = parseInt(stats?.total) || 0;

    const candidatos = [];
    if (total >= 1)  candidatos.push('primera_actividad');
    if (total >= 10) candidatos.push('diez_actividades');
    if (total >= 30) candidatos.push('treinta_actividades');
    if (parseInt(stats?.notas_perfectas) >= 1) candidatos.push('nota_perfecta');
    if (parseInt(stats?.notas_perfectas) >= 1) candidatos.push('sin_errores');
    if (racha >= 3)  candidatos.push('racha_3_dias');
    if (racha >= 7)  candidatos.push('racha_7_dias');
    if (total >= 5 && parseInt(stats?.reprobadas) === 0) candidatos.push('todo_aprobado');

    if (candidatos.length > 0) {
      const placeholders = candidatos.map(() => '(?, ?)').join(', ');
      const valores = candidatos.flatMap(tipo => [estudianteId, tipo]);
      await db.query(
        `INSERT IGNORE INTO estudiante_logros (estudiante_id, tipo) VALUES ${placeholders}`,
        valores
      );
    }
  } catch (err) {
    console.error('[Logros] Error:', err.message);
  }
}

// GET /api/logros/mis-logros
async function misLogros(req, res) {
  const eid = req.usuario.id;
  try {
    const [[stats]] = await db.query(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN mejor_nota >= 3.5 THEN 1 ELSE 0 END) AS aprobadas,
        ROUND(AVG(mejor_nota), 1) AS promedio
      FROM (
        SELECT actividad_id, MAX(nota) AS mejor_nota
        FROM resultados_actividades
        WHERE estudiante_id = ?
        GROUP BY actividad_id
      ) mejores
    `, [eid]);

    const [logrosDB] = await db.query(
      'SELECT tipo, obtenido_en FROM estudiante_logros WHERE estudiante_id = ?',
      [eid]
    );
    const logrosSet = new Map(logrosDB.map(l => [l.tipo, l.obtenido_en]));

    const racha = await calcularRacha(eid);

    const logros = LOGROS_DEF.map(def => ({
      ...def,
      obtenido: logrosSet.has(def.tipo),
      obtenido_en: logrosSet.get(def.tipo) || null,
    }));

    res.json({
      data: {
        racha,
        totalActividades: parseInt(stats?.total) || 0,
        aprobadas:        parseInt(stats?.aprobadas) || 0,
        promedio:         parseFloat(stats?.promedio) || null,
        logros,
      },
    });
  } catch (err) {
    console.error('Error en misLogros:', err);
    res.status(500).json({ error: 'Error al obtener los logros' });
  }
}

module.exports = { misLogros, verificarYOtorgar };
