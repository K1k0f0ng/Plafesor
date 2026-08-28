'use strict';
const db = require('../database');
const Anthropic = require('@anthropic-ai/sdk');
const { enviarMensaje } = require('./whatsappService');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic();

function nivelMEN(promedio) {
  const p = parseFloat(promedio);
  if (!p || isNaN(p)) return 'Sin datos';
  if (p < 3.5) return 'Desempeño Bajo';
  if (p < 4.0) return 'Desempeño Básico';
  if (p <= 4.5) return 'Desempeño Alto';
  return 'Desempeño Superior';
}

async function recopilarDatosColegio(colegioId) {
  const cid = parseInt(colegioId);

  const [
    [resumenRows],
    [asistRows],
    [riesgoRows],
    [gruposRows],
    [estudiantesRows],
  ] = await Promise.all([

    // Promedio y distribución MEN — últimas 4 semanas
    db.query(`
      SELECT
        ROUND(AVG(ra.nota), 2)                                                               AS promedio,
        COUNT(ra.id)                                                                          AS total_notas,
        SUM(CASE WHEN ra.nota < 3.5              THEN 1 ELSE 0 END)                         AS bajo,
        SUM(CASE WHEN ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END)                AS basico,
        SUM(CASE WHEN ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END)                AS alto,
        SUM(CASE WHEN ra.nota > 4.5              THEN 1 ELSE 0 END)                         AS superior
      FROM resultados_actividades ra
      JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
      JOIN grupos g ON g.id = a.grupo_id
      WHERE g.colegio_id = ?
        AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
        AND ra.id = (
          SELECT ra2.id FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            AND ra2.completada_en >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
          ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
        )
    `, [cid]),

    // Asistencia última semana
    db.query(`
      SELECT
        COUNT(*) AS total,
        ROUND(
          SUM(CASE WHEN estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0), 1
        ) AS tasa
      FROM asistencias a
      JOIN grupos g ON g.id = a.grupo_id
      WHERE g.colegio_id = ?
        AND a.fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `, [cid]),

    // Riesgo académico — predicciones vigentes
    db.query(`
      SELECT nivel, COUNT(DISTINCT estudiante_id) AS cantidad
      FROM predicciones_riesgo
      WHERE colegio_id = ?
      GROUP BY nivel
    `, [cid]),

    // Grupos con promedio — últimas 4 semanas (de menor a mayor)
    db.query(`
      SELECT
        g.id, g.nombre AS grupo, g.grado,
        ROUND(AVG(ra.nota), 1) AS promedio,
        COUNT(DISTINCT eg.estudiante_id) AS estudiantes
      FROM grupos g
      JOIN estudiante_grupos eg ON eg.grupo_id = g.id
      LEFT JOIN actividades a ON a.grupo_id = g.id AND a.activa = TRUE
      LEFT JOIN resultados_actividades ra ON ra.actividad_id = a.id
        AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
      WHERE g.colegio_id = ?
      GROUP BY g.id, g.nombre, g.grado
      HAVING promedio IS NOT NULL
      ORDER BY promedio ASC
    `, [cid]),

    // Total estudiantes activos
    db.query(`
      SELECT COUNT(DISTINCT eg.estudiante_id) AS total
      FROM estudiante_grupos eg
      JOIN grupos g ON g.id = eg.grupo_id
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      WHERE g.colegio_id = ?
    `, [cid]),
  ]);

  const riesgoMap = {};
  for (const r of riesgoRows) riesgoMap[r.nivel] = parseInt(r.cantidad);

  return {
    resumen:          resumenRows[0]   || {},
    asistencia:       asistRows[0]     || {},
    riesgo: {
      critico: riesgoMap.critico || 0,
      alto:    riesgoMap.alto    || 0,
      medio:   riesgoMap.medio   || 0,
      bajo:    riesgoMap.bajo    || 0,
    },
    grupos:           gruposRows,
    totalEstudiantes: parseInt(estudiantesRows[0]?.total) || 0,
  };
}

async function generarMensajeWhatsApp(datos, nombreColegio) {
  const { resumen, asistencia, riesgo, grupos, totalEstudiantes } = datos;
  const totalNotas = parseInt(resumen.total_notas) || 0;

  // Sin actividades recientes → no enviar
  if (totalNotas === 0) return null;

  const promedio   = parseFloat(resumen.promedio) || 0;
  const peorGrupo  = grupos[0];
  const mejorGrupo = grupos[grupos.length - 1];

  // Narrativa generada por Claude Haiku
  let narrativa = '';
  try {
    const contexto = [
      `Colegio: ${nombreColegio}`,
      `Promedio institucional (últimas 4 semanas): ${promedio} — ${nivelMEN(promedio)}`,
      `Distribución MEN: Bajo=${resumen.bajo||0}, Básico=${resumen.basico||0}, Alto=${resumen.alto||0}, Superior=${resumen.superior||0}`,
      asistencia.tasa != null ? `Asistencia semanal: ${asistencia.tasa}%` : null,
      `Estudiantes con riesgo: Crítico=${riesgo.critico}, Alto=${riesgo.alto}, Medio=${riesgo.medio}`,
      `Total estudiantes activos: ${totalEstudiantes}`,
      peorGrupo ? `Grupo con menor promedio: ${peorGrupo.grado}° ${peorGrupo.grupo} (${peorGrupo.promedio})` : null,
      mejorGrupo && grupos.length > 1 ? `Grupo con mayor promedio: ${mejorGrupo.grado}° ${mejorGrupo.grupo} (${mejorGrupo.promedio})` : null,
    ].filter(Boolean).join('\n');

    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 180,
      messages: [{
        role: 'user',
        content: `Eres el asistente de gestión académica de ${nombreColegio}. Con estos datos, escribe un análisis ejecutivo en máximo 3 oraciones (máx 100 palabras) para el director/rector. Usa escala MEN colombiana. Tono profesional y directo. Destaca lo más urgente:\n\n${contexto}`,
      }],
    });
    narrativa = resp.content[0]?.text?.trim() || '';
  } catch (e) {
    console.error('[InformesSemanal] Error Claude:', e.message);
    narrativa = 'El análisis automático no está disponible en este momento.';
  }

  const fecha = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const lineas = [
    `📊 *Informe Semanal*`,
    `*${nombreColegio}*`,
    fecha,
    ``,
    `📈 *Desempeño Institucional*`,
    `Promedio: *${promedio}* (${nivelMEN(promedio)})`,
    `Evaluaciones: ${totalNotas}`,
    asistencia.tasa != null ? `Asistencia semanal: *${asistencia.tasa}%*` : null,
    ``,
    `⚠️ *Riesgo Académico*`,
    `🔴 Crítico: ${riesgo.critico}   🟠 Alto: ${riesgo.alto}`,
    `🟡 Medio: ${riesgo.medio}   🟢 Bajo: ${riesgo.bajo}`,
    ``,
    peorGrupo  ? `📍 *Atención prioritaria:* ${peorGrupo.grado}° ${peorGrupo.grupo} (${peorGrupo.promedio})` : null,
    mejorGrupo && grupos.length > 1 ? `🏆 *Mejor desempeño:* ${mejorGrupo.grado}° ${mejorGrupo.grupo} (${mejorGrupo.promedio})` : null,
    ``,
    `🤖 *Análisis IA:*`,
    narrativa,
    ``,
    `_Ver detalle completo en ${(process.env.FRONTEND_URL || '').replace(/^https?:\/\//, '') || 'la plataforma'}_`,
  ].filter(l => l !== null && l !== undefined);

  return lineas.join('\n');
}

async function ejecutarInformesSemanales() {
  console.log(`[InformesSemanal] Inicio — ${new Date().toLocaleString('es-CO')}`);
  try {
    const [colegios] = await db.query(`
      SELECT c.id, c.nombre, u.nombre AS director_nombre, u.telefono_padres AS director_telefono
      FROM colegios c
      JOIN usuarios u ON u.colegio_id = c.id AND u.rol = 'director' AND u.activo = TRUE
      WHERE c.activo = TRUE
        AND u.telefono_padres IS NOT NULL
        AND u.telefono_padres != ''
    `);

    console.log(`[InformesSemanal] ${colegios.length} colegios con director y teléfono`);

    for (const colegio of colegios) {
      try {
        const datos   = await recopilarDatosColegio(colegio.id);
        const mensaje = await generarMensajeWhatsApp(datos, colegio.nombre);

        if (!mensaje) {
          console.log(`[InformesSemanal] ${colegio.nombre}: sin actividad reciente, omitido`);
          continue;
        }

        const r = await enviarMensaje(colegio.director_telefono, mensaje);
        console.log(`[InformesSemanal] ${colegio.nombre}: ${r.ok ? '✓ enviado' : '✗ error'}`);
      } catch (err) {
        console.error(`[InformesSemanal] Error en colegio ${colegio.nombre}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[InformesSemanal] Error general:', err.message);
  }
  console.log(`[InformesSemanal] Fin.`);
}

// Programa ejecución cada domingo a las 6:00 PM
// Heartbeat cada 60s — dispara una sola vez por semana (getDay()===0 es domingo)
function iniciarCronInformesSemanal() {
  let ultimaEjecucion = null;
  setInterval(() => {
    const ahora = new Date();
    if (ahora.getDay() === 0 && ahora.getHours() === 18 && ahora.getMinutes() === 0) {
      const clave = ahora.toDateString();
      if (ultimaEjecucion !== clave) {
        ultimaEjecucion = clave;
        ejecutarInformesSemanales();
      }
    }
  }, 60_000);
  console.log('[InformesSemanal] Cron programado: domingos a las 6:00 PM');
}

module.exports = { iniciarCronInformesSemanal, ejecutarInformesSemanales };
