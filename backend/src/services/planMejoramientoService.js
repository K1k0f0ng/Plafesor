'use strict';
const db = require('../database');
const Anthropic = require('@anthropic-ai/sdk');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic();

async function generarPlanEstudiante(estudianteId, materiaId, grupoId, colegioId) {
  // Datos del estudiante, materia, grupo y colegio
  const [[info]] = await db.query(`
    SELECT
      u.nombre AS estudiante,
      g.nombre AS grupo, g.grado,
      m.nombre AS materia,
      c.nombre AS colegio
    FROM usuarios u
    JOIN grupos   g ON g.id = ?
    JOIN materias m ON m.id = ?
    JOIN colegios c ON c.id = ?
    WHERE u.id = ?
  `, [grupoId, materiaId, colegioId, estudianteId]);

  if (!info) return null;

  // Resultados de actividades del estudiante en esta materia/grupo
  const [resultados] = await db.query(`
    SELECT a.titulo, a.periodo, ra.nota
    FROM resultados_actividades ra
    JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
    WHERE ra.estudiante_id = ?
      AND a.materia_id = ?
      AND a.grupo_id   = ?
      AND ra.id = (
        SELECT ra2.id FROM resultados_actividades ra2
        WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
        ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
      )
    ORDER BY ra.completada_en DESC
    LIMIT 20
  `, [estudianteId, materiaId, grupoId]);

  if (!resultados.length) return null;

  const periodo  = resultados[0]?.periodo || '1';
  const promedio = resultados.reduce((s, r) => s + parseFloat(r.nota), 0) / resultados.length;
  const bajas    = resultados.filter(r => parseFloat(r.nota) < 3.5);
  const actFallidas = bajas.slice(0, 5).map(r => `"${r.titulo}" (${r.nota})`).join(', ');

  // Asistencia últimos 30 días
  const [[asist]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      ROUND(SUM(estado = 'ausente') * 100.0 / NULLIF(COUNT(*), 0), 0) AS pct_ausente
    FROM asistencias
    WHERE estudiante_id = ? AND grupo_id = ?
      AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `, [estudianteId, grupoId]);

  const contexto = [
    `Estudiante: ${info.estudiante}`,
    `Grado: ${info.grado}° | Grupo: ${info.grupo} | Colegio: ${info.colegio}`,
    `Materia: ${info.materia} | Período: ${periodo}`,
    `Promedio actual: ${promedio.toFixed(1)} — Desempeño Bajo (escala MEN colombiana)`,
    `Actividades con nota bajo 3.5: ${bajas.length} de ${resultados.length}`,
    actFallidas ? `Actividades fallidas: ${actFallidas}` : null,
    asist?.total > 0 ? `Inasistencia últimos 30 días: ${asist.pct_ausente}%` : null,
  ].filter(Boolean).join('\n');

  let planTexto = '';
  try {
    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Eres un orientador académico colombiano. Genera un Plan de Mejoramiento conciso para:

${contexto}

El plan debe tener EXACTAMENTE estas 4 secciones con sus títulos:

DIAGNÓSTICO: (2 oraciones sobre la situación académica del estudiante)

ACCIONES DE MEJORA:
1. (acción específica para reforzar el contenido)
2. (acción específica de práctica o repaso)
3. (acción de seguimiento y apoyo en casa)

CRONOGRAMA: Semana 1: [actividad]. Semana 2: [actividad]. Semana 3: [evaluación].

COMPROMISOS: Estudiante: [compromiso]. Docente: [compromiso]. Acudiente: [compromiso].

Máximo 220 palabras. Tono formal colombiano.`,
      }],
    });
    planTexto = resp.content[0]?.text?.trim() || '';
  } catch (e) {
    console.error('[Planes] Error Claude:', e.message);
    planTexto = 'Plan de mejoramiento pendiente de generación por el docente.';
  }

  const diagnostico = `Promedio ${promedio.toFixed(1)} en ${info.materia} — ${bajas.length} actividad(es) bajo 3.5`;

  await db.query(`
    INSERT INTO planes_mejoramiento
      (estudiante_id, materia_id, grupo_id, colegio_id, periodo, diagnostico, plan_texto, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')
    ON DUPLICATE KEY UPDATE
      diagnostico = VALUES(diagnostico),
      plan_texto  = VALUES(plan_texto),
      estado      = 'activo',
      generado_en = NOW()
  `, [estudianteId, materiaId, grupoId, colegioId, periodo, diagnostico, planTexto]);

  // Notificar al padre/acudiente por WhatsApp
  try {
    const { enviarMensaje } = require('./whatsappService');
    const [padres] = await db.query(`
      SELECT u.nombre, u.telefono_padres
      FROM padre_estudiante pe
      JOIN usuarios u ON u.id = pe.padre_id
      WHERE pe.estudiante_id = ?
        AND u.activo = TRUE
        AND u.telefono_padres IS NOT NULL
        AND u.telefono_padres != ''
    `, [estudianteId]);

    for (const padre of padres) {
      const msg = [
        `📋 *Playfesor — Plan de Mejoramiento*`,
        ``,
        `Estimado/a ${padre.nombre},`,
        ``,
        `Se ha generado un *Plan de Mejoramiento* para *${info.estudiante}* en la materia *${info.materia}* — Período ${periodo}.`,
        ``,
        `📊 ${diagnostico}`,
        ``,
        `Ingrese a la plataforma Playfesor o comuníquese con la institución para conocer el plan de acción y los compromisos académicos.`,
        ``,
        `_${info.colegio}_`,
      ].join('\n');
      await enviarMensaje(padre.telefono_padres, msg);
    }
  } catch (waErr) {
    console.error('[Planes] Error enviando WhatsApp al padre:', waErr.message);
  }

  return { estudiante: info.estudiante, materia: info.materia, periodo };
}

async function generarPlanesColegioNocturno(colegioId) {
  // Candidatos: nivel crítico o alto sin plan activo en los últimos 7 días
  const [candidatos] = await db.query(`
    SELECT DISTINCT pr.estudiante_id, pr.materia_id, pr.grupo_id
    FROM predicciones_riesgo pr
    LEFT JOIN planes_mejoramiento pm
      ON  pm.estudiante_id = pr.estudiante_id
      AND pm.materia_id    = pr.materia_id
      AND pm.grupo_id      = pr.grupo_id
      AND pm.estado        = 'activo'
      AND pm.generado_en  >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    WHERE pr.colegio_id = ?
      AND pr.nivel IN ('critico', 'alto')
      AND pm.id IS NULL
  `, [colegioId]);

  let generados = 0;
  for (const c of candidatos) {
    try {
      const r = await generarPlanEstudiante(c.estudiante_id, c.materia_id, c.grupo_id, colegioId);
      if (r) generados++;
    } catch (err) {
      console.error('[Planes] Error generando plan individual:', err.message);
    }
  }
  return generados;
}

async function generarPlanesNocturno() {
  console.log(`[Planes] Inicio generación nocturna — ${new Date().toLocaleString('es-CO')}`);
  try {
    const [colegios] = await db.query('SELECT id, nombre FROM colegios WHERE activo = TRUE');
    let total = 0;
    for (const col of colegios) {
      try {
        const n = await generarPlanesColegioNocturno(col.id);
        if (n > 0) console.log(`[Planes] ${col.nombre}: ${n} planes generados`);
        total += n;
      } catch (err) {
        console.error(`[Planes] Error en colegio ${col.nombre}:`, err.message);
      }
    }
    console.log(`[Planes] Fin — ${total} planes generados`);
  } catch (err) {
    console.error('[Planes] Error general:', err.message);
  }
}

module.exports = { generarPlanEstudiante, generarPlanesNocturno };
