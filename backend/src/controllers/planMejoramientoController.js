const db = require('../database');
const { generarPlanEstudiante } = require('../services/planMejoramientoService');

// GET /api/planes/colegio/:colegio_id?estado=activo|superado|archivado
async function listarPorColegio(req, res) {
  const { colegio_id } = req.params;
  const { estado } = req.query;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio colegio' });
  }

  const estadoFiltro = ['activo', 'superado', 'archivado'].includes(estado) ? estado : 'activo';

  try {
    const [filas] = await db.query(`
      SELECT
        pm.id,
        pm.estado,
        pm.periodo,
        pm.diagnostico,
        pm.plan_texto,
        pm.generado_en,
        u.nombre  AS estudiante,
        m.nombre  AS materia,
        g.nombre  AS grupo,
        g.grado,
        pr.score,
        pr.nivel
      FROM planes_mejoramiento pm
      JOIN usuarios u ON u.id = pm.estudiante_id
      JOIN materias m ON m.id = pm.materia_id
      JOIN grupos   g ON g.id = pm.grupo_id
      LEFT JOIN predicciones_riesgo pr
        ON  pr.estudiante_id = pm.estudiante_id
        AND pr.materia_id    = pm.materia_id
        AND pr.grupo_id      = pm.grupo_id
      WHERE pm.colegio_id = ? AND pm.estado = ?
      ORDER BY pr.score DESC, u.nombre ASC
    `, [parseInt(colegio_id), estadoFiltro]);

    res.json({ data: filas });
  } catch (err) {
    console.error('Error listarPorColegio:', err);
    res.status(500).json({ error: 'Error al obtener los planes' });
  }
}

// POST /api/planes/generar — genera plan para un estudiante específico
async function generarPlan(req, res) {
  const { estudiante_id, materia_id, grupo_id } = req.body;

  if (!estudiante_id || !materia_id || !grupo_id) {
    return res.status(400).json({ error: 'estudiante_id, materia_id y grupo_id son obligatorios' });
  }

  try {
    const [[grupo]] = await db.query('SELECT colegio_id FROM grupos WHERE id = ?', [grupo_id]);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== grupo.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este colegio' });
    }

    const resultado = await generarPlanEstudiante(
      parseInt(estudiante_id), parseInt(materia_id), parseInt(grupo_id), grupo.colegio_id
    );

    if (!resultado) {
      return res.status(404).json({ error: 'No hay actividades suficientes para generar el plan' });
    }

    res.json({ mensaje: 'Plan generado correctamente', data: resultado });
  } catch (err) {
    console.error('Error generarPlan:', err);
    res.status(500).json({ error: 'Error al generar el plan' });
  }
}

// POST /api/planes/generar-colegio/:colegio_id — genera planes para todos los críticos del colegio
async function generarPlanesColegio(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.rol === 'director' && req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes gestionar tu propio colegio' });
  }

  try {
    const { generarPlanesColegioNocturno } = require('../services/planMejoramientoService');
    // eslint-disable-next-line no-use-before-define — importación lazy para evitar ciclos
    const n = await generarPlanesColegioNocturno(parseInt(colegio_id));
    res.json({ mensaje: `${n} plan(es) generado(s)`, data: { generados: n } });
  } catch (err) {
    console.error('Error generarPlanesColegio:', err);
    res.status(500).json({ error: 'Error al generar los planes' });
  }
}

// PUT /api/planes/:id/estado
async function actualizarEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body;

  if (!['activo', 'superado', 'archivado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Usa: activo, superado, archivado' });
  }

  try {
    const [[plan]] = await db.query('SELECT colegio_id FROM planes_mejoramiento WHERE id = ?', [id]);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

    if (req.usuario.rol === 'director' && req.usuario.colegio_id !== plan.colegio_id) {
      return res.status(403).json({ error: 'No tienes acceso a este plan' });
    }

    await db.query('UPDATE planes_mejoramiento SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error('Error actualizarEstado:', err);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
}

// GET /api/planes/mis-planes — el estudiante ve sus planes activos
async function misPlanes(req, res) {
  const estudianteId = req.usuario.id;
  try {
    const [filas] = await db.query(`
      SELECT
        pm.id, pm.estado, pm.periodo, pm.diagnostico, pm.plan_texto, pm.generado_en,
        m.nombre AS materia,
        g.nombre AS grupo,
        g.grado
      FROM planes_mejoramiento pm
      JOIN materias m ON m.id = pm.materia_id
      JOIN grupos   g ON g.id = pm.grupo_id
      WHERE pm.estudiante_id = ? AND pm.estado = 'activo'
      ORDER BY pm.generado_en DESC
    `, [estudianteId]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error misPlanes:', err);
    res.status(500).json({ error: 'Error al obtener tus planes' });
  }
}

// GET /api/planes/docente — el docente ve los planes activos de sus estudiantes
async function planesDocente(req, res) {
  const docenteId = req.usuario.id;
  try {
    const [filas] = await db.query(`
      SELECT
        pm.id, pm.estado, pm.periodo, pm.diagnostico, pm.generado_en,
        u.nombre AS estudiante,
        m.nombre AS materia,
        g.nombre AS grupo,
        g.grado
      FROM planes_mejoramiento pm
      JOIN usuarios u ON u.id = pm.estudiante_id
      JOIN materias m ON m.id = pm.materia_id
      JOIN grupos   g ON g.id = pm.grupo_id
      WHERE pm.estado = 'activo'
        AND EXISTS (
          SELECT 1 FROM docente_grupos_materias dgm
          WHERE dgm.docente_id = ?
            AND dgm.grupo_id   = pm.grupo_id
            AND dgm.materia_id = pm.materia_id
        )
      ORDER BY pm.generado_en DESC
    `, [docenteId]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error planesDocente:', err);
    res.status(500).json({ error: 'Error al obtener los planes' });
  }
}

module.exports = { listarPorColegio, generarPlan, generarPlanesColegio, actualizarEstado, misPlanes, planesDocente };
