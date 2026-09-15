const db = require('../database');
const { ordenApellido, ordenarPorApellido } = require('../utils/ordenNombre');

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

// Solo el director de grupo puede generar el boletín oficial (documento
// consolidado de todas las materias) de su grupo — admin/director del
// colegio pueden generar el de cualquier grupo. Un docente que solo dicta
// una materia en el grupo NO puede generar el boletín completo, aunque sí
// pueda escribir la observación de su materia (ver observacionPeriodoController).
async function verificarDirectorGrupo(req, res, grupo_id) {
  if (req.usuario.rol === 'admin' || req.usuario.rol === 'director') return true;
  const [[esDirector]] = await db.query(
    'SELECT 1 FROM usuarios WHERE id = ? AND grupo_dirigido_id = ? LIMIT 1',
    [req.usuario.id, grupo_id]
  );
  if (!esDirector) {
    res.status(403).json({ error: 'Solo el director de grupo puede generar el boletín de este grupo' });
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
// Nota final de una materia en un período:
//   nota_final = (promedio ponderado de actividades × 0.80)
//              + (autoevaluación × 0.05) + (coevaluación × 0.05) + (heteroevaluación × 0.10)
// El promedio ponderado de actividades es Σ(nota_i × %_i)/100 — lo no
// entregado cuenta como 0 dentro de su porcentaje, igual criterio que la
// "regla de tres" original pero repartido por el peso que el docente le dio
// a cada actividad en vez de partes iguales. Solo es válido (y por lo tanto
// solo se calcula la nota final) cuando los porcentajes de las actividades
// del período suman exactamente 100% — si no, la materia queda pendiente.
// El Motor de Riesgo, el Copiloto y el Observador siguen usando "promedio de
// lo completado" para alerta temprana, con otro propósito: fuera de este cambio.
const PESO_ACTIVIDADES = 0.80;
const PESOS_COMPONENTE = { autoevaluacion: 0.05, coevaluacion: 0.05, heteroevaluacion: 0.10 };

// Notas por materia de UN estudiante en UN período numérico ('1'-'4')
async function materiasEstudiantePeriodo(estudiante_id, grupo_id, periodoNumero) {
  const [materiasBase] = await db.query(`
    SELECT DISTINCT m.id AS materia_id, m.nombre AS materia_nombre, MIN(u_doc.nombre) AS docente_nombre
    FROM docente_grupos_materias dgm
    JOIN materias m ON m.id = dgm.materia_id
    LEFT JOIN usuarios u_doc ON u_doc.id = dgm.docente_id
    WHERE dgm.grupo_id = ?
    GROUP BY m.id, m.nombre
    ORDER BY m.nombre ASC
  `, [grupo_id]);

  const [actividadesFilas] = await db.query(`
    SELECT a.materia_id, a.id AS actividad_id, a.porcentaje, ra.nota
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

  const [componentesFilas] = await db.query(`
    SELECT materia_id, tipo, nota FROM componentes_evaluacion
    WHERE estudiante_id = ? AND grupo_id = ? AND periodo = ?
  `, [estudiante_id, grupo_id, periodoNumero]);

  const actividadesPorMateria = {};
  actividadesFilas.forEach(a => {
    if (!actividadesPorMateria[a.materia_id]) actividadesPorMateria[a.materia_id] = [];
    actividadesPorMateria[a.materia_id].push(a);
  });
  const componentesPorMateria = {};
  componentesFilas.forEach(c => {
    if (!componentesPorMateria[c.materia_id]) componentesPorMateria[c.materia_id] = {};
    componentesPorMateria[c.materia_id][c.tipo] = parseFloat(c.nota);
  });

  return materiasBase.map(m => {
    const actividades = actividadesPorMateria[m.materia_id] || [];
    const total_actividades = actividades.length;
    const actividades_calificadas = actividades.filter(a => a.nota !== null).length;
    const sumaPorcentaje = Math.round(actividades.reduce((s, a) => s + parseFloat(a.porcentaje || 0), 0) * 100) / 100;
    const porcentajeCompleto = total_actividades > 0 && Math.abs(sumaPorcentaje - 100) < 0.01;

    let nota_promedio = null;
    if (porcentajeCompleto) {
      const sumaPonderada = actividades.reduce((s, a) => s + (a.nota !== null ? parseFloat(a.nota) : 0) * parseFloat(a.porcentaje || 0), 0);
      const promedio_actividades = sumaPonderada / 100;
      const comp = componentesPorMateria[m.materia_id] || {};
      nota_promedio = Math.round((
        promedio_actividades * PESO_ACTIVIDADES +
        (comp.autoevaluacion || 0) * PESOS_COMPONENTE.autoevaluacion +
        (comp.coevaluacion || 0) * PESOS_COMPONENTE.coevaluacion +
        (comp.heteroevaluacion || 0) * PESOS_COMPONENTE.heteroevaluacion
      ) * 10) / 10;
    }

    return {
      materia_id: m.materia_id,
      materia_nombre: m.materia_nombre,
      docente_nombre: m.docente_nombre,
      nota_promedio,
      total_actividades,
      actividades_calificadas,
      pendiente_configuracion: total_actividades > 0 && !porcentajeCompleto,
    };
  });
}

// Promedio de una sola cifra combinando las materias ya calculadas de un
// estudiante (excluye las que aún no tienen nota, p.ej. sin actividades o
// con porcentajes sin completar).
function promedioGeneralDeMaterias(materias) {
  const notas = materias.map(m => m.nota_promedio).filter(n => n !== null);
  return notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null;
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
  const materias = await materiasEstudiantePeriodo(estudiante_id, grupo_id, periodoNumero);
  return promedioGeneralDeMaterias(materias);
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
// Docente: solo el grupo que dirige (el boletín oficial es responsabilidad
// del director de grupo, no de cada docente de materia). Director/Admin:
// todos los grupos del colegio.
async function getMisGrupos(req, res) {
  const { rol, id: userId, colegio_id } = req.usuario;
  try {
    if (rol === 'docente') {
      const [filas] = await db.query(`
        SELECT g.id, g.nombre, g.grado
        FROM grupos g
        JOIN usuarios u ON u.grupo_dirigido_id = g.id
        LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
        WHERE u.id = ? AND g.activo = TRUE
        ORDER BY ga.orden ASC, g.nombre ASC
      `, [userId]);
      return res.json({ data: filas });
    }
    const colegioId = colegio_id;
    if (!colegioId) return res.status(400).json({ error: 'No se pudo determinar el colegio' });
    const [filas] = await db.query(`
      SELECT g.id, g.nombre, g.grado
      FROM grupos g
      LEFT JOIN grados_academicos ga ON ga.codigo = g.grado AND ga.colegio_id = g.colegio_id
      WHERE g.colegio_id = ? AND g.activo = TRUE
      ORDER BY ga.orden ASC, g.nombre ASC
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
    if (!(await verificarDirectorGrupo(req, res, grupo_id))) return;

    if (periodo === 'final') {
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY ${ordenApellido('u.nombre')} ASC
      `, [grupo_id]);

      const filas = await Promise.all(alumnos.map(async al => ({
        ...al,
        promedio: await promedioEstudianteFinal(al.estudiante_id, grupo_id, grupoInfo.colegio_id),
      })));
      const conNivel = filas.map(f => ({ ...f, nivel: nivelMEN(f.promedio) }));
      return res.json({ data: conNivel });
    }

    const [alumnos] = await db.query(`
      SELECT u.id AS estudiante_id, u.nombre
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      WHERE eg.grupo_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [grupo_id]);

    const filas = await Promise.all(alumnos.map(async al => ({
      ...al,
      promedio: await promedioEstudiantePeriodo(al.estudiante_id, grupo_id, periodo),
    })));
    const conNivel = filas.map(f => ({ ...f, nivel: nivelMEN(f.promedio) }));
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
    if (!(await verificarDirectorGrupo(req, res, grupo_id))) return;

    const { materias, advertencia } = await materiasEstudiante(estudiante_id, grupo_id, info.colegio_id, periodo);
    const materiasConNivel = materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) }));

    const promedio_general = promedioGeneralDeMaterias(materiasConNivel);

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
    if (!(await verificarDirectorGrupo(req, res, grupo_id))) return;

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
        ORDER BY ${ordenApellido('u.nombre')} ASC
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
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY ${ordenApellido('u.nombre')} ASC
      `, [grupo_id]);

      for (const al of alumnos) {
        const materias = await materiasEstudiantePeriodo(al.estudiante_id, grupo_id, periodo);
        estudiantesMap[al.estudiante_id] = {
          id: al.estudiante_id,
          nombre: al.estudiante_nombre,
          materias: materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) })),
        };
      }
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

    const boletines = ordenarPorApellido(Object.values(estudiantesMap)).map(est => {
      const promedio_general = promedioGeneralDeMaterias(est.materias);

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
    if (!(await verificarDirectorGrupo(req, res, grupo_id))) return;

    const { materias } = await materiasEstudiante(estudiante_id, grupo_id, info.colegio_id, periodo);
    const materiasConNivel = materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) }));
    const promedio_general = promedioGeneralDeMaterias(materiasConNivel);

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
    if (!(await verificarDirectorGrupo(req, res, grupo_id))) return;

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
        ORDER BY ${ordenApellido('u.nombre')} ASC
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
      const [alumnos] = await db.query(`
        SELECT u.id AS estudiante_id, u.nombre AS estudiante_nombre
        FROM estudiante_grupos eg
        JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
        WHERE eg.grupo_id = ?
        ORDER BY ${ordenApellido('u.nombre')} ASC
      `, [grupo_id]);

      for (const al of alumnos) {
        const materias = await materiasEstudiantePeriodo(al.estudiante_id, grupo_id, periodo);
        estudiantesMap[al.estudiante_id] = {
          id: al.estudiante_id,
          nombre: al.estudiante_nombre,
          materias: materias.map(m => ({ ...m, nivel: nivelMEN(m.nota_promedio) })),
        };
      }
    }

    const [observaciones] = await db.query(
      `SELECT estudiante_id, texto FROM observaciones_periodo WHERE grupo_id = ? AND periodo = ?`,
      [grupo_id, periodo]
    );
    const observacionMap = {};
    observaciones.forEach(o => { observacionMap[o.estudiante_id] = o.texto; });

    const boletines = ordenarPorApellido(Object.values(estudiantesMap)).map(est => {
      const promedio_general = promedioGeneralDeMaterias(est.materias);
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
