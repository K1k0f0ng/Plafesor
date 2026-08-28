const db = require('../database');

// IDOR: todas las consultas de boletín reciben grupo_id/estudiante_id por
// parámetro y resuelven el colegio dueño del dato — este chequeo evita que un
// docente/director/admin autenticado de un colegio pida (o adivine) el
// boletín de un estudiante de otro colegio. Mismo criterio ya aplicado en
// estudianteController.historial(): docente puede ver cualquier estudiante
// de SU colegio (no se restringe a que le dicte esa materia puntual), pero
// nunca de otro colegio.
function verificarColegio(req, res, colegioRecurso) {
  if (req.usuario.colegio_id !== colegioRecurso) {
    res.status(403).json({ error: 'Ese recurso no pertenece a tu colegio' });
    return false;
  }
  return true;
}

function nivelMEN(nota) {
  if (nota === null || nota === undefined) return 'Sin calificar';
  if (nota >= 4.6) return 'Superior';
  if (nota >= 4.0) return 'Alto';
  if (nota >= 3.5) return 'Básico';
  return 'Bajo';
}

// ── Cálculo de notas ─────────────────────────────────────────────────
// Fórmula "regla de tres": suma de las notas obtenidas ÷ actividades
// asignadas por el docente en el período (no ÷ actividades completadas).
// Lo no entregado cuenta como 0 dentro del promedio — es la nota oficial
// del boletín. El Motor de Riesgo, el Copiloto y el Observador siguen
// usando "promedio de lo completado" para alerta temprana, con otro
// propósito: eso queda fuera de este cambio.

// Notas por materia de UN estudiante en UN período numérico ('1'-'4')
async function materiasEstudiantePeriodo(estudiante_id, grupo_id, periodoNumero) {
  const [materias] = await db.query(`
    SELECT
      m.id   AS materia_id,
      m.nombre AS materia_nombre,
      MIN(u_doc.nombre) AS docente_nombre,
      ROUND(SUM(ra.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS nota_promedio,
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
  `, [periodoNumero, estudiante_id, grupo_id]);
  // mysql2 devuelve las columnas DECIMAL (ROUND(...)) como string — convertir
  // a número real aquí evita que sumas posteriores (promedio_general) hagan
  // concatenación de texto en vez de una suma.
  return materias.map(m => ({
    ...m,
    nota_promedio: m.nota_promedio === null ? null : parseFloat(m.nota_promedio),
  }));
}

// Períodos configurados (numero + porcentaje) del año lectivo vigente de un
// colegio — base para calcular la nota "Final".
async function periodosParaFinal(colegio_id) {
  const [[activo]] = await db.query(
    `SELECT ano_lectivo FROM periodos_academicos WHERE colegio_id = ? AND activo = TRUE LIMIT 1`,
    [colegio_id]
  );
  let ano_lectivo = activo?.ano_lectivo;
  if (!ano_lectivo) {
    const [[ultimo]] = await db.query(
      `SELECT ano_lectivo FROM periodos_academicos WHERE colegio_id = ? ORDER BY ano_lectivo DESC LIMIT 1`,
      [colegio_id]
    );
    ano_lectivo = ultimo?.ano_lectivo;
  }
  if (!ano_lectivo) return { periodos: [], sumaPorcentaje: 0 };

  const [periodos] = await db.query(
    `SELECT numero, porcentaje FROM periodos_academicos WHERE colegio_id = ? AND ano_lectivo = ? ORDER BY numero ASC`,
    [colegio_id, ano_lectivo]
  );
  const sumaPorcentaje = Math.round(periodos.reduce((s, p) => s + parseFloat(p.porcentaje || 0), 0) * 100) / 100;
  return { periodos, sumaPorcentaje };
}

// Notas por materia de UN estudiante consolidadas en "Final" (ponderadas por
// el porcentaje de cada período). Un período sin nota cuenta como 0 dentro de
// su porcentaje. Si los porcentajes del año no suman 100%, no se calcula.
async function materiasEstudianteFinal(estudiante_id, grupo_id, colegio_id) {
  const { periodos, sumaPorcentaje } = await periodosParaFinal(colegio_id);
  if (!periodos.length) {
    return { materias: [], advertencia: 'La nota Final aún no está disponible: el colegio no tiene períodos académicos configurados.' };
  }
  if (sumaPorcentaje !== 100) {
    return { materias: [], advertencia: `La nota Final aún no está disponible: los porcentajes de los períodos suman ${sumaPorcentaje}% (deben sumar 100%).` };
  }

  const porPeriodo = await Promise.all(
    periodos.map(p => materiasEstudiantePeriodo(estudiante_id, grupo_id, p.numero))
  );

  const materiasMap = new Map();
  porPeriodo.forEach((materias, idx) => {
    const peso = parseFloat(periodos[idx].porcentaje) / 100;
    materias.forEach(m => {
      if (!materiasMap.has(m.materia_id)) {
        materiasMap.set(m.materia_id, {
          materia_id: m.materia_id,
          materia_nombre: m.materia_nombre,
          docente_nombre: m.docente_nombre,
          notaFinal: 0,
          total_actividades: 0,
          actividades_calificadas: 0,
        });
      }
      const acc = materiasMap.get(m.materia_id);
      acc.notaFinal += (parseFloat(m.nota_promedio) || 0) * peso;
      acc.total_actividades += m.total_actividades;
      acc.actividades_calificadas += m.actividades_calificadas;
      if (!acc.docente_nombre && m.docente_nombre) acc.docente_nombre = m.docente_nombre;
    });
  });

  const materias = Array.from(materiasMap.values()).map(m => ({
    materia_id: m.materia_id,
    materia_nombre: m.materia_nombre,
    docente_nombre: m.docente_nombre,
    nota_promedio: Math.round(m.notaFinal * 10) / 10,
    total_actividades: m.total_actividades,
    actividades_calificadas: m.actividades_calificadas,
  }));

  return { materias, advertencia: null };
}

// Punto de entrada único: notas por materia de un estudiante para un
// "periodo" que puede ser un número ('1'-'4') o el texto 'final'.
async function materiasEstudiante(estudiante_id, grupo_id, colegio_id, periodo) {
  if (periodo === 'final') {
    return materiasEstudianteFinal(estudiante_id, grupo_id, colegio_id);
  }
  const materias = await materiasEstudiantePeriodo(estudiante_id, grupo_id, periodo);
  return { materias, advertencia: null };
}

// Promedio corto (una sola cifra combinando todas las materias) de UN
// estudiante en UN período numérico — usado en la lista de estudiantes.
async function promedioEstudiantePeriodo(estudiante_id, grupo_id, periodoNumero) {
  const [[fila]] = await db.query(`
    SELECT ROUND(SUM(ra.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS promedio
    FROM actividades a
    LEFT JOIN resultados_actividades ra
      ON ra.actividad_id = a.id AND ra.estudiante_id = ?
      AND ra.id = (
        SELECT ra2.id FROM resultados_actividades ra2
        WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
        ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
      )
    WHERE a.grupo_id = ? AND a.periodo = ? AND a.activa = TRUE
  `, [estudiante_id, grupo_id, periodoNumero]);
  return fila && fila.promedio !== undefined ? fila.promedio : null;
}

async function promedioEstudianteFinal(estudiante_id, grupo_id, colegio_id) {
  const { periodos, sumaPorcentaje } = await periodosParaFinal(colegio_id);
  if (!periodos.length || sumaPorcentaje !== 100) return null;
  const promedios = await Promise.all(
    periodos.map(p => promedioEstudiantePeriodo(estudiante_id, grupo_id, p.numero))
  );
  const suma = promedios.reduce((s, prom, idx) => {
    const peso = parseFloat(periodos[idx].porcentaje) / 100;
    return s + (parseFloat(prom) || 0) * peso;
  }, 0);
  return Math.round(suma * 10) / 10;
}

// ── Endpoints ───────────────────────────────────────────────────────

// GET /api/boletin/mis-grupos
// Docente: sus grupos asignados, más el grupo que dirige aunque no le dicte
// ninguna materia (para poder generar la observación del período como
// director de grupo). Director/Admin: todos los grupos del colegio.
async function getMisGrupos(req, res) {
  const { rol, id: userId, colegio_id } = req.usuario;
  try {
    if (rol === 'docente') {
      const [filas] = await db.query(`
        SELECT DISTINCT g.id, g.nombre, g.grado
        FROM grupos g
        WHERE g.id IN (SELECT grupo_id FROM docente_grupos_materias WHERE docente_id = ?)
           OR g.id = (SELECT grupo_dirigido_id FROM usuarios WHERE id = ?)
        ORDER BY g.grado ASC, g.nombre ASC
      `, [userId, userId]);
      return res.json({ data: filas });
    }
    const colegioId = colegio_id;
    if (!colegioId) return res.status(400).json({ error: 'No se pudo determinar el colegio' });
    const [filas] = await db.query(`
      SELECT id, nombre, grado
      FROM grupos
      WHERE colegio_id = ?
      ORDER BY grado ASC, nombre ASC
    `, [colegioId]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error en getMisGrupos:', err);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
}

// GET /api/boletin/grupo/:grupo_id/periodo/:periodo
// Lista de estudiantes del grupo con su promedio en ese período (o "final")
async function getEstudiantesGrupo(req, res) {
  const { grupo_id, periodo } = req.params;
  try {
    const [[grupoInfo]] = await db.query('SELECT colegio_id FROM grupos WHERE id = ?', [grupo_id]);
    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!verificarColegio(req, res, grupoInfo.colegio_id)) return;

    if (periodo === 'final') {
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY u.nombre ASC
      `, [grupo_id]);

      const filas = await Promise.all(alumnos.map(async al => ({
        ...al,
        promedio: await promedioEstudianteFinal(al.estudiante_id, grupo_id, grupoInfo.colegio_id),
      })));
      const conNivel = filas.map(f => ({ ...f, nivel: nivelMEN(f.promedio) }));
      return res.json({ data: conNivel });
    }

    const [filas] = await db.query(`
      SELECT
        u.id   AS estudiante_id,
        u.nombre,
        ROUND(SUM(ra.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS promedio
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

    const conNivel = filas.map(f => {
      const promedio = f.promedio === null ? null : parseFloat(f.promedio);
      return { ...f, promedio, nivel: nivelMEN(promedio) };
    });
    res.json({ data: conNivel });
  } catch (err) {
    console.error('Error en getEstudiantesGrupo:', err);
    res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
}

// GET /api/boletin/estudiante/:estudiante_id?grupo_id=X&periodo=Y
// Datos completos del boletín para un estudiante (Y puede ser '1'-'4' o 'final')
async function getBoletinEstudiante(req, res) {
  const { estudiante_id } = req.params;
  const { grupo_id, periodo } = req.query;

  if (!grupo_id || !periodo) {
    return res.status(400).json({ error: 'Faltan parámetros: grupo_id y periodo' });
  }

  try {
    const [[info]] = await db.query(`
      SELECT
        u.nombre  AS estudiante_nombre,
        g.nombre  AS grupo_nombre,
        g.grado,
        c.id      AS colegio_id,
        c.nombre  AS colegio_nombre
      FROM usuarios u
      JOIN estudiante_grupos eg ON eg.estudiante_id = u.id AND eg.grupo_id = ?
      JOIN grupos g ON g.id = eg.grupo_id
      JOIN colegios c ON c.id = g.colegio_id
      WHERE u.id = ?
    `, [grupo_id, estudiante_id]);

    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });
    if (!verificarColegio(req, res, info.colegio_id)) return;

    const { materias, advertencia } = await materiasEstudiante(estudiante_id, grupo_id, info.colegio_id, periodo);
    const materiasConNivel = materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) }));

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

    const [[observacion]] = await db.query(
      `SELECT op.texto, op.actualizado_en, du.nombre AS nombre_docente
       FROM observaciones_periodo op LEFT JOIN usuarios du ON du.id = op.docente_id
       WHERE op.estudiante_id = ? AND op.periodo = ?`,
      [estudiante_id, periodo]
    );

    res.json({
      data: {
        estudiante: { id: parseInt(estudiante_id), nombre: info.estudiante_nombre },
        grupo:      { id: parseInt(grupo_id), nombre: info.grupo_nombre, grado: info.grado },
        colegio:    { nombre: info.colegio_nombre },
        periodo:    periodo === 'final' ? 'final' : parseInt(periodo),
        materias:   materiasConNivel,
        promedio_general,
        nivel_general: nivelMEN(promedio_general),
        asistencia:  { ...asistencia, tasa_asistencia },
        advertencia,
        observacion: observacion || null,
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
      SELECT g.nombre AS grupo_nombre, g.grado, c.id AS colegio_id, c.nombre AS colegio_nombre
      FROM grupos g JOIN colegios c ON c.id = g.colegio_id
      WHERE g.id = ?
    `, [grupo_id]);

    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!verificarColegio(req, res, grupoInfo.colegio_id)) return;

    // 2. Asistencia de todos los estudiantes
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
    const asistenciaMap = {};
    asistencias.forEach(a => { asistenciaMap[a.estudiante_id] = a; });

    // 3. Materias por estudiante
    let estudiantesMap = {};
    let advertenciaGeneral = null;

    if (periodo === 'final') {
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY u.nombre ASC
      `, [grupo_id]);

      for (const al of alumnos) {
        const { materias, advertencia } = await materiasEstudianteFinal(al.estudiante_id, grupo_id, grupoInfo.colegio_id);
        if (advertencia) advertenciaGeneral = advertencia;
        estudiantesMap[al.estudiante_id] = {
          id: al.estudiante_id,
          nombre: al.estudiante_nombre,
          materias: materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) })),
        };
      }
    } else {
      const [calificaciones] = await db.query(`
        SELECT
          u.id   AS estudiante_id,
          u.nombre AS estudiante_nombre,
          m.id   AS materia_id,
          m.nombre AS materia_nombre,
          MIN(u_doc.nombre) AS docente_nombre,
          ROUND(SUM(ra.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS nota_promedio,
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

      calificaciones.forEach(c => {
        if (!estudiantesMap[c.estudiante_id]) {
          estudiantesMap[c.estudiante_id] = { id: c.estudiante_id, nombre: c.estudiante_nombre, materias: [] };
        }
        const notaPromedio = c.nota_promedio === null ? null : parseFloat(c.nota_promedio);
        estudiantesMap[c.estudiante_id].materias.push({
          materia_id:             c.materia_id,
          materia_nombre:         c.materia_nombre,
          docente_nombre:         c.docente_nombre,
          nota_promedio:          notaPromedio,
          total_actividades:      c.total_actividades,
          actividades_calificadas: c.actividades_calificadas,
          nivel:                  nivelMEN(notaPromedio),
        });
      });
    }

    // 4. Observaciones de período ya guardadas para todo el grupo
    const [observaciones] = await db.query(
      `SELECT op.estudiante_id, op.texto, op.actualizado_en, du.nombre AS nombre_docente
       FROM observaciones_periodo op LEFT JOIN usuarios du ON du.id = op.docente_id
       WHERE op.grupo_id = ? AND op.periodo = ?`,
      [grupo_id, periodo]
    );
    const observacionMap = {};
    observaciones.forEach(o => { observacionMap[o.estudiante_id] = o; });

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
        grupo:           { id: parseInt(grupo_id), nombre: grupoInfo.grupo_nombre, grado: grupoInfo.grado },
        colegio:         { nombre: grupoInfo.colegio_nombre },
        periodo:         periodo === 'final' ? 'final' : parseInt(periodo),
        materias:        est.materias,
        promedio_general,
        nivel_general:   nivelMEN(promedio_general),
        asistencia:      { ...asistencia, tasa_asistencia },
        advertencia:     advertenciaGeneral,
        observacion:     observacionMap[est.id] || null,
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
      SELECT u.nombre AS estudiante_nombre, g.nombre AS grupo_nombre, g.grado,
             c.id AS colegio_id, c.nombre AS colegio_nombre
      FROM usuarios u
      JOIN estudiante_grupos eg ON eg.estudiante_id = u.id AND eg.grupo_id = ?
      JOIN grupos g ON g.id = eg.grupo_id
      JOIN colegios c ON c.id = g.colegio_id
      WHERE u.id = ?
    `, [grupo_id, estudiante_id]);
    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });
    if (!verificarColegio(req, res, info.colegio_id)) return;

    const { materias } = await materiasEstudiante(estudiante_id, grupo_id, info.colegio_id, periodo);
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

    const [[observacion]] = await db.query(
      `SELECT texto FROM observaciones_periodo WHERE estudiante_id = ? AND periodo = ?`,
      [estudiante_id, periodo]
    );

    const datos = {
      estudiante: { id: parseInt(estudiante_id), nombre: info.estudiante_nombre },
      grupo:      { nombre: info.grupo_nombre, grado: info.grado },
      colegio:    { nombre: info.colegio_nombre },
      periodo:    periodo === 'final' ? 'final' : parseInt(periodo),
      materias:   materiasConNivel,
      promedio_general,
      nivel_general: nivelMEN(promedio_general),
      asistencia:  { ...asistencia, tasa_asistencia },
      observacion: observacion?.texto || null,
    };

    const { generarPDF } = require('../services/pdfService');
    const buf = await generarPDF(datos);
    const nombre = info.estudiante_nombre.replace(/\s+/g, '_');
    const sufijoPeriodo = periodo === 'final' ? 'Final' : `P${periodo}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletin_${nombre}_${sufijoPeriodo}.pdf"`,
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
      SELECT g.nombre AS grupo_nombre, g.grado, c.id AS colegio_id, c.nombre AS colegio_nombre
      FROM grupos g JOIN colegios c ON c.id = g.colegio_id WHERE g.id = ?
    `, [grupo_id]);
    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!verificarColegio(req, res, grupoInfo.colegio_id)) return;

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

    let estudiantesMap = {};

    if (periodo === 'final') {
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY u.nombre ASC
      `, [grupo_id]);

      for (const al of alumnos) {
        const { materias } = await materiasEstudianteFinal(al.estudiante_id, grupo_id, grupoInfo.colegio_id);
        estudiantesMap[al.estudiante_id] = {
          id: al.estudiante_id,
          nombre: al.estudiante_nombre,
          materias: materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) })),
        };
      }
    } else {
      const [calificaciones] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre,
               m.id AS materia_id, m.nombre AS materia_nombre,
               MIN(u_doc.nombre) AS docente_nombre,
               ROUND(SUM(ra.nota) / NULLIF(COUNT(DISTINCT a.id), 0), 1) AS nota_promedio,
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

      calificaciones.forEach(c => {
        if (!estudiantesMap[c.estudiante_id]) {
          estudiantesMap[c.estudiante_id] = { id: c.estudiante_id, nombre: c.estudiante_nombre, materias: [] };
        }
        const notaPromedio = c.nota_promedio === null ? null : parseFloat(c.nota_promedio);
        estudiantesMap[c.estudiante_id].materias.push({
          materia_id: c.materia_id, materia_nombre: c.materia_nombre,
          docente_nombre: c.docente_nombre, nota_promedio: notaPromedio,
          total_actividades: c.total_actividades, actividades_calificadas: c.actividades_calificadas,
          nivel: nivelMEN(notaPromedio),
        });
      });
    }

    const [observaciones] = await db.query(
      `SELECT estudiante_id, texto FROM observaciones_periodo WHERE grupo_id = ? AND periodo = ?`,
      [grupo_id, periodo]
    );
    const observacionMap = {};
    observaciones.forEach(o => { observacionMap[o.estudiante_id] = o.texto; });

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
        periodo:       periodo === 'final' ? 'final' : parseInt(periodo),
        materias:      est.materias,
        promedio_general,
        nivel_general: nivelMEN(promedio_general),
        asistencia:    { ...asistencia, tasa_asistencia },
        observacion:   observacionMap[est.id] || null,
      };
    });

    if (!boletines.length) return res.status(404).json({ error: 'No hay estudiantes en este grupo' });

    const { generarPDF } = require('../services/pdfService');
    const buf = await generarPDF(boletines);
    const nombreGrupo = grupoInfo.grupo_nombre.replace(/\s+/g, '_');
    const sufijoPeriodo = periodo === 'final' ? 'Final' : `P${periodo}`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletines_${nombreGrupo}_${sufijoPeriodo}.pdf"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('Error en getPDFGrupo:', err);
    res.status(500).json({ error: 'Error al generar el PDF del grupo' });
  }
}

module.exports = {
  getMisGrupos, getEstudiantesGrupo, getBoletinEstudiante, getBoletinMasivoGrupo, getPDFEstudiante, getPDFGrupo,
  // Reutilizados por observacionPeriodoController para generar la observación con IA
  // con las mismas notas (regla de tres) que ve la familia en el boletín.
  materiasEstudiante, nivelMEN,
};
