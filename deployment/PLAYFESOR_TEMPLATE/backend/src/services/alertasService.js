const db = require('../database');
const { enviarMensaje } = require('./whatsappService');

// Alerta 1: 3+ ausencias en los últimos 5 días
async function alertarAusenciasConsecutivas() {
  try {
    const [filas] = await db.query(`
      SELECT
        a.estudiante_id,
        u.nombre          AS estudiante,
        u.telefono_padres,
        g.nombre          AS grupo,
        g.grado,
        c.nombre          AS colegio,
        COUNT(*)          AS dias_ausente
      FROM asistencias a
      JOIN usuarios  u ON u.id  = a.estudiante_id
      JOIN grupos    g ON g.id  = a.grupo_id
      JOIN colegios  c ON c.id  = g.colegio_id
      WHERE a.estado = 'ausente'
        AND a.fecha >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
        AND u.telefono_padres IS NOT NULL
        AND u.activo = TRUE
      GROUP BY a.estudiante_id, g.id
      HAVING dias_ausente >= 3
    `);

    let enviados = 0;
    for (const est of filas) {
      const msg = [
        `📚 *${est.colegio} — Alerta de Asistencia*`,
        ``,
        `Estimado padre/madre de *${est.estudiante}*,`,
        ``,
        `Su hijo/a ha registrado *${est.dias_ausente} ausencias* en los últimos días en el grado *${est.grado}° ${est.grupo}*.`,
        ``,
        `⚠️ La asistencia regular es fundamental para el éxito académico. Le invitamos a comunicarse con la institución.`,
        ``,
        `_${est.colegio}_`,
      ].join('\n');
      const r = await enviarMensaje(est.telefono_padres, msg);
      if (r.ok) enviados++;
    }
    console.log(`[Alertas] Ausencias: ${enviados}/${filas.length} notificados`);
  } catch (err) {
    console.error('[Alertas] Error ausencias:', err.message);
  }
}

// Alerta 2: sin actividad en 14+ días (estudiantes que ya habían participado antes)
async function alertarInactividadAcademica() {
  try {
    const [filas] = await db.query(`
      SELECT DISTINCT
        eg.estudiante_id,
        u.nombre          AS estudiante,
        u.telefono_padres,
        g.nombre          AS grupo,
        g.grado,
        c.nombre          AS colegio
      FROM estudiante_grupos eg
      JOIN usuarios  u ON u.id  = eg.estudiante_id
      JOIN grupos    g ON g.id  = eg.grupo_id
      JOIN colegios  c ON c.id  = g.colegio_id
      WHERE u.activo = TRUE
        AND u.telefono_padres IS NOT NULL
        AND (
          SELECT COUNT(*) FROM resultados_actividades ra
          WHERE ra.estudiante_id = eg.estudiante_id
        ) > 0
        AND (
          SELECT MAX(ra2.completada_en) FROM resultados_actividades ra2
          WHERE ra2.estudiante_id = eg.estudiante_id
        ) < DATE_SUB(NOW(), INTERVAL 14 DAY)
        AND EXISTS (
          SELECT 1 FROM actividades a
          WHERE a.grupo_id = eg.grupo_id AND a.activa = TRUE
        )
    `);

    let enviados = 0;
    for (const est of filas) {
      const msg = [
        `📚 *${est.colegio} — Recordatorio Académico*`,
        ``,
        `Estimado padre/madre de *${est.estudiante}*,`,
        ``,
        `Su hijo/a *no ha completado actividades académicas en los últimos 14 días* en el grado *${est.grado}° ${est.grupo}*.`,
        ``,
        `📋 Hay actividades disponibles en la plataforma. Le pedimos acompañar a su hijo/a para que las complete a tiempo.`,
        ``,
        `_${est.colegio}_`,
      ].join('\n');
      const r = await enviarMensaje(est.telefono_padres, msg);
      if (r.ok) enviados++;
    }
    console.log(`[Alertas] Inactividad: ${enviados}/${filas.length} notificados`);
  } catch (err) {
    console.error('[Alertas] Error inactividad:', err.message);
  }
}

// Ejecuta todas las alertas
async function ejecutarAlertas() {
  console.log(`[Alertas] Inicio — ${new Date().toLocaleString('es-CO')}`);
  await alertarAusenciasConsecutivas();
  await alertarInactividadAcademica();
  console.log(`[Alertas] Fin.`);
}

// Programa la ejecución diaria a las 6:00 AM
// Heartbeat cada 60s — dispara una sola vez por día cuando el reloj marca HH:MM exacto
function iniciarCronAlertas() {
  let ultimaEjecucion = null;
  setInterval(() => {
    const ahora = new Date();
    if (ahora.getHours() === 6 && ahora.getMinutes() === 0) {
      const clave = ahora.toDateString();
      if (ultimaEjecucion !== clave) {
        ultimaEjecucion = clave;
        ejecutarAlertas();
      }
    }
  }, 60_000);
  console.log('[Alertas] Cron programado: diario a las 6:00 AM');
}

// ============================================================
// CRON NOCTURNO — Recálculo de riesgo académico (2:00 AM COT)
// ============================================================
const { scoreNota, scoreAsistencia, scorePendientes, nivelDeScore } = require('../utils/riesgoUtils');

async function calcularRiesgoColegio(colegioId) {
  const [baseData] = await db.query(`
    SELECT
      ra.estudiante_id,
      a.materia_id,
      eg.grupo_id,
      ROUND(AVG(ra.nota), 2) AS promedio,
      COUNT(DISTINCT ra.actividad_id) AS completadas,
      (
        SELECT COUNT(*) FROM actividades a2
        WHERE a2.grupo_id = eg.grupo_id
          AND a2.materia_id = a.materia_id
          AND a2.activa = TRUE
      ) AS total_actividades
    FROM resultados_actividades ra
    JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
    JOIN estudiante_grupos eg
      ON eg.estudiante_id = ra.estudiante_id AND eg.grupo_id = a.grupo_id
    JOIN grupos g ON g.id = eg.grupo_id
    WHERE g.colegio_id = ?
      AND ra.id = (
        SELECT ra2.id FROM resultados_actividades ra2
        WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
        ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
      )
    GROUP BY ra.estudiante_id, a.materia_id, eg.grupo_id
  `, [colegioId]);

  if (!baseData.length) return 0;

  const [asistData] = await db.query(`
    SELECT
      ast.estudiante_id,
      ast.grupo_id,
      COUNT(*) AS total_registros,
      SUM(ast.estado = 'ausente') AS ausencias
    FROM asistencias ast
    JOIN grupos g ON g.id = ast.grupo_id
    WHERE g.colegio_id = ?
      AND ast.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY ast.estudiante_id, ast.grupo_id
  `, [colegioId]);

  const asistMap = {};
  for (const a of asistData) {
    asistMap[`${a.estudiante_id}_${a.grupo_id}`] = a;
  }

  const insertValues = [];
  for (const row of baseData) {
    const promedio    = parseFloat(row.promedio) || 0;
    const completadas = parseInt(row.completadas) || 0;
    const totalActs   = parseInt(row.total_actividades) || 0;
    const pendientes  = Math.max(0, totalActs - completadas);
    const asist       = asistMap[`${row.estudiante_id}_${row.grupo_id}`] || { ausencias: 0, total_registros: 0 };

    const fNota  = scoreNota(promedio);
    const fAsist = scoreAsistencia(parseInt(asist.ausencias) || 0, parseInt(asist.total_registros) || 0);
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

  await db.query(`
    INSERT INTO predicciones_riesgo
      (estudiante_id, materia_id, grupo_id, colegio_id, score, nivel, factores)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      score    = VALUES(score),
      nivel    = VALUES(nivel),
      factores = VALUES(factores)
  `, [insertValues]);

  await generarNotificacionesRiesgo(insertValues, colegioId);

  return insertValues.length;
}

// Genera notificaciones in-app para docentes, directores y padres
// Solo crea una por usuario+estudiante+materia por día (UNIQUE KEY en ref_key)
async function generarNotificacionesRiesgo(insertValues, colegioId) {
  const enRiesgo = insertValues.filter(row => row[5] === 'alto' || row[5] === 'critico');
  if (!enRiesgo.length) return;

  const [directores] = await db.query(
    `SELECT id FROM usuarios WHERE colegio_id = ? AND rol = 'director' AND activo = TRUE`,
    [colegioId]
  );

  const hoy = new Date().toISOString().split('T')[0];
  const nuevasNotifs = [];

  for (const [estudianteId, materiaId, grupoId, , score, nivel] of enRiesgo) {
    const [[info]] = await db.query(`
      SELECT u.nombre AS est, m.nombre AS mat, g.nombre AS grp, g.grado
      FROM usuarios u
      JOIN materias m ON m.id = ?
      JOIN grupos   g ON g.id = ?
      WHERE u.id = ?
    `, [materiaId, grupoId, estudianteId]);

    if (!info) continue;

    const tipo    = nivel === 'critico' ? 'riesgo_critico' : 'riesgo_alto';
    const titulo  = `Riesgo ${nivel.toUpperCase()}: ${info.est}`;
    const mensaje = `${info.est} tiene riesgo ${nivel} en ${info.mat} (${info.grado}° ${info.grp}) — Score ${score}/100`;
    const datos   = JSON.stringify({ estudiante_id: estudianteId, materia_id: materiaId, grupo_id: grupoId, score, nivel });
    const refKey  = `est_${estudianteId}_mat_${materiaId}_${hoy}`;

    const [docentes] = await db.query(
      `SELECT docente_id FROM docente_grupos_materias WHERE grupo_id = ? AND materia_id = ?`,
      [grupoId, materiaId]
    );
    for (const { docente_id } of docentes) {
      nuevasNotifs.push([docente_id, tipo, refKey, titulo, mensaje, datos]);
    }

    if (nivel === 'critico') {
      for (const { id } of directores) {
        nuevasNotifs.push([id, tipo, refKey, titulo, mensaje, datos]);
      }
      const [padres] = await db.query(
        `SELECT padre_id FROM padre_estudiante WHERE estudiante_id = ?`,
        [estudianteId]
      );
      for (const { padre_id } of padres) {
        nuevasNotifs.push([padre_id, tipo, refKey, titulo, mensaje, datos]);
      }
    }
  }

  if (nuevasNotifs.length) {
    await db.query(`
      INSERT IGNORE INTO notificaciones
        (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra)
      VALUES ?
    `, [nuevasNotifs]);
    console.log(`[Riesgo] ${nuevasNotifs.length} notificaciones in-app generadas`);
  }
}

async function calcularRiesgoTodosColegios() {
  console.log(`[Riesgo] Inicio recálculo nocturno — ${new Date().toLocaleString('es-CO')}`);
  try {
    const [colegios] = await db.query(
      'SELECT id, nombre FROM colegios WHERE activo = TRUE'
    );
    let totalActualizados = 0;
    for (const colegio of colegios) {
      try {
        const n = await calcularRiesgoColegio(colegio.id);
        console.log(`[Riesgo] ${colegio.nombre}: ${n} registros actualizados`);
        totalActualizados += n;
      } catch (err) {
        console.error(`[Riesgo] Error en colegio ${colegio.nombre}:`, err.message);
      }
    }
    console.log(`[Riesgo] Fin — ${totalActualizados} registros totales actualizados`);
  } catch (err) {
    console.error('[Riesgo] Error general en recálculo nocturno:', err.message);
  }

  // Generar planes de mejoramiento para estudiantes en riesgo alto/crítico
  try {
    const { generarPlanesNocturno } = require('./planMejoramientoService');
    await generarPlanesNocturno();
  } catch (err) {
    console.error('[Riesgo] Error en generación de planes de mejoramiento:', err.message);
  }
}

// Programa el recálculo diario a las 2:00 AM
function iniciarCronRiesgo() {
  let ultimaEjecucion = null;
  setInterval(() => {
    const ahora = new Date();
    if (ahora.getHours() === 2 && ahora.getMinutes() === 0) {
      const clave = ahora.toDateString();
      if (ultimaEjecucion !== clave) {
        ultimaEjecucion = clave;
        calcularRiesgoTodosColegios();
      }
    }
  }, 60_000);
  console.log('[Riesgo] Cron programado: diario a las 2:00 AM');
}

module.exports = { iniciarCronAlertas, ejecutarAlertas, iniciarCronRiesgo, calcularRiesgoTodosColegios };
