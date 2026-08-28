'use strict';
const db = require('../database');
const Anthropic = require('@anthropic-ai/sdk');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic();

const UMBRAL_CAIDA = 0.3; // puntos — por debajo de esto se considera ruido, no una caída real

function saludoSegunHora(hora) {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

async function recopilarDatosBriefing(colegioId) {
  const [
    [[riesgoRow]],
    [grupoCaidaRows],
    [[periodoRow]],
  ] = await Promise.all([

    // Estudiantes en riesgo crítico (predicción vigente)
    db.query(
      "SELECT COUNT(DISTINCT estudiante_id) AS total FROM predicciones_riesgo WHERE colegio_id = ? AND nivel = 'critico'",
      [colegioId]
    ),

    // Grupo con mayor caída de promedio: últimos 5 días vs los 5 días anteriores
    db.query(`
      SELECT
        g.nombre AS grupo, g.grado,
        ROUND(AVG(CASE WHEN ra.completada_en >= DATE_SUB(CURDATE(), INTERVAL 5 DAY) THEN ra.nota END), 2) AS promedio_reciente,
        ROUND(AVG(CASE WHEN ra.completada_en <  DATE_SUB(CURDATE(), INTERVAL 5 DAY)
                        AND ra.completada_en >= DATE_SUB(CURDATE(), INTERVAL 10 DAY) THEN ra.nota END), 2) AS promedio_anterior
      FROM grupos g
      JOIN actividades a ON a.grupo_id = g.id AND a.activa = TRUE
      JOIN resultados_actividades ra ON ra.actividad_id = a.id
      WHERE g.colegio_id = ?
      GROUP BY g.id, g.nombre, g.grado
      HAVING promedio_reciente IS NOT NULL AND promedio_anterior IS NOT NULL
      ORDER BY (promedio_anterior - promedio_reciente) DESC
      LIMIT 1
    `, [colegioId]),

    // Período académico activo
    db.query(
      'SELECT nombre, numero, fecha_fin FROM periodos_academicos WHERE colegio_id = ? AND activo = TRUE LIMIT 1',
      [colegioId]
    ),
  ]);

  const estudiantesRiesgoCritico = parseInt(riesgoRow?.total) || 0;

  let grupoAlerta = null;
  const candidato = grupoCaidaRows[0];
  if (candidato) {
    const delta = parseFloat(candidato.promedio_anterior) - parseFloat(candidato.promedio_reciente);
    if (delta > UMBRAL_CAIDA) {
      grupoAlerta = { nombre: `${candidato.grado}° ${candidato.grupo}`, delta: delta.toFixed(1) };
    }
  }

  let diasCierrePeriodo = null;
  if (periodoRow?.fecha_fin) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const fin = new Date(periodoRow.fecha_fin); fin.setHours(0, 0, 0, 0);
    diasCierrePeriodo = Math.ceil((fin - hoy) / 86400000);
  }

  return { estudiantesRiesgoCritico, grupoAlerta, diasCierrePeriodo, periodoNumero: periodoRow?.numero || null };
}

async function generarBriefingColegio(colegioId) {
  const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [colegioId]);
  if (!colegio) return null;

  const datos = await recopilarDatosBriefing(colegioId);
  const saludo = saludoSegunHora(new Date().getHours());

  const contexto = [
    `Estudiantes en riesgo crítico: ${datos.estudiantesRiesgoCritico}`,
    datos.grupoAlerta
      ? `Grupo con mayor caída de promedio: ${datos.grupoAlerta.nombre} bajó ${datos.grupoAlerta.delta} puntos en los últimos 5 días`
      : 'Ningún grupo muestra una caída de promedio significativa esta semana',
    datos.diasCierrePeriodo !== null
      ? `El período ${datos.periodoNumero} cierra en ${datos.diasCierrePeriodo} día(s)`
      : 'No hay un período académico activo configurado',
  ].join('\n');

  let texto = '';
  try {
    const resp = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 220,
      system: 'Eres el asistente ejecutivo de Playfesor para rectores de colegios colombianos. Escribes resúmenes matutinos breves, en lenguaje ejecutivo y cercano, nunca técnico ni con jerga de datos. Vas directo a lo importante y siempre terminas recomendando una sola cosa concreta para revisar primero.',
      messages: [{
        role: 'user',
        content: `Empieza el mensaje exactamente con "${saludo}." y luego escribe entre 2 y 4 oraciones (máximo 90 palabras) resumiendo esta información para el rector de "${colegio.nombre}", terminando con una recomendación clara de qué revisar primero:\n\n${contexto}`,
      }],
    });
    texto = resp.content[0]?.text?.trim() || '';
  } catch (e) {
    console.error('[Briefing] Error Claude:', e.message);
    texto = `${saludo}. El resumen automático no está disponible en este momento.`;
  }

  await db.query(`
    INSERT INTO briefing_diario
      (colegio_id, fecha, texto, estudiantes_riesgo_critico, grupo_alerta, dias_cierre_periodo)
    VALUES (?, CURDATE(), ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      texto = VALUES(texto),
      estudiantes_riesgo_critico = VALUES(estudiantes_riesgo_critico),
      grupo_alerta = VALUES(grupo_alerta),
      dias_cierre_periodo = VALUES(dias_cierre_periodo),
      generado_en = NOW()
  `, [colegioId, texto, datos.estudiantesRiesgoCritico, datos.grupoAlerta?.nombre || null, datos.diasCierrePeriodo]);

  const [[fila]] = await db.query(
    'SELECT * FROM briefing_diario WHERE colegio_id = ? AND fecha = CURDATE()',
    [colegioId]
  );
  return fila;
}

async function ejecutarBriefingTodosColegios() {
  console.log(`[Briefing] Inicio generación diaria — ${new Date().toLocaleString('es-CO')}`);
  try {
    const [colegios] = await db.query(`
      SELECT DISTINCT c.id, c.nombre
      FROM colegios c
      JOIN usuarios u ON u.colegio_id = c.id AND u.rol = 'director' AND u.activo = TRUE
      WHERE c.activo = TRUE
    `);
    for (const colegio of colegios) {
      try {
        await generarBriefingColegio(colegio.id);
        console.log(`[Briefing] ${colegio.nombre}: generado`);
      } catch (err) {
        console.error(`[Briefing] Error en colegio ${colegio.nombre}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Briefing] Error general:', err.message);
  }
  console.log('[Briefing] Fin.');
}

// Programa la generación diaria a las 5:00 AM
function iniciarCronBriefing() {
  let ultimaEjecucion = null;
  setInterval(() => {
    const ahora = new Date();
    if (ahora.getHours() === 5 && ahora.getMinutes() === 0) {
      const clave = ahora.toDateString();
      if (ultimaEjecucion !== clave) {
        ultimaEjecucion = clave;
        ejecutarBriefingTodosColegios();
      }
    }
  }, 60_000);
  console.log('[Briefing] Cron programado: diario a las 5:00 AM');
}

module.exports = { generarBriefingColegio, iniciarCronBriefing, ejecutarBriefingTodosColegios };
