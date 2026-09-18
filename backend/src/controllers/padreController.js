const bcrypt = require('bcryptjs');
const db     = require('../database');
const { ordenApellido } = require('../utils/ordenNombre');

// GET /api/padre/mis-hijos — vista del padre
async function misHijos(req, res) {
  const padreId = req.usuario.id;
  try {
    const [hijos] = await db.query(`
      SELECT u.id, u.nombre,
             g.grado, g.nombre AS grupo,
             c.nombre AS colegio
      FROM padre_estudiante pe
      JOIN usuarios  u ON u.id  = pe.estudiante_id
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos            g  ON g.id  = eg.grupo_id
      LEFT JOIN colegios          c  ON c.id  = g.colegio_id
      WHERE pe.padre_id = ?
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [padreId]);

    const resultado = await Promise.all(hijos.map(async (hijo) => {
      const [
        [materiasRows],
        [asistRows],
        [riesgoRows],
        [recientesRows],
        [historialRows],
        [periodoRows],
        [asistDetalleRows],
        [anotacionesRows],
        [observacionesRows],
        [citacionesRows],
      ] = await Promise.all([

        db.query(`
          SELECT m.nombre,
                 ROUND(AVG(ra.nota), 1) AS promedio,
                 COUNT(ra.id)           AS total
          FROM resultados_actividades ra
          JOIN actividades a  ON a.id  = ra.actividad_id AND a.activa = TRUE
          JOIN materias    m  ON m.id  = a.materia_id
          JOIN estudiante_grupos eg ON eg.estudiante_id = ? AND eg.grupo_id = a.grupo_id
          WHERE ra.estudiante_id = ?
            AND ra.id = (
              SELECT ra2.id FROM resultados_actividades ra2
              WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
              ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
            )
          GROUP BY m.id, m.nombre
          ORDER BY promedio ASC
        `, [hijo.id, hijo.id]),

        db.query(`
          SELECT
            COUNT(*) AS total,
            ROUND(SUM(CASE WHEN estado IN ('presente','tardanza') THEN 1 ELSE 0 END) * 100.0
              / NULLIF(COUNT(*), 0), 1) AS tasa
          FROM asistencias
          WHERE estudiante_id = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `, [hijo.id]),

        db.query(`
          SELECT score, nivel
          FROM predicciones_riesgo
          WHERE estudiante_id = ?
          ORDER BY score DESC LIMIT 1
        `, [hijo.id]),

        db.query(`
          SELECT a.titulo, m.nombre AS materia,
                 ra.nota, ra.completada_en
          FROM resultados_actividades ra
          JOIN actividades a ON a.id  = ra.actividad_id
          JOIN materias    m ON m.id  = a.materia_id
          WHERE ra.estudiante_id = ?
          ORDER BY ra.completada_en DESC LIMIT 5
        `, [hijo.id]),

        db.query(`
          SELECT a.titulo, m.nombre AS materia, a.periodo,
                 ra.nota, ra.completada_en
          FROM resultados_actividades ra
          JOIN actividades a ON a.id  = ra.actividad_id AND a.activa = TRUE
          JOIN materias    m ON m.id  = a.materia_id
          WHERE ra.estudiante_id = ?
          ORDER BY ra.completada_en ASC
        `, [hijo.id]),

        db.query(`
          SELECT m.nombre AS materia, a.periodo,
                 ROUND(AVG(ra.nota), 1) AS promedio,
                 COUNT(ra.id)           AS total
          FROM resultados_actividades ra
          JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
          JOIN materias    m ON m.id = a.materia_id
          JOIN estudiante_grupos eg ON eg.estudiante_id = ? AND eg.grupo_id = a.grupo_id
          WHERE ra.estudiante_id = ?
            AND ra.id = (
              SELECT ra2.id FROM resultados_actividades ra2
              WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
              ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
            )
          GROUP BY m.id, m.nombre, a.periodo
          ORDER BY m.nombre, a.periodo
        `, [hijo.id, hijo.id]),

        db.query(`
          SELECT estado, COUNT(*) AS total
          FROM asistencias
          WHERE estudiante_id = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY estado
        `, [hijo.id]),

        db.query(`
          SELECT a.id, a.tipo, a.texto, a.creado_en,
                 du.nombre AS nombre_docente,
                 g.nombre AS nombre_grupo, g.grado
          FROM anotaciones a
          JOIN usuarios du ON du.id = a.docente_id
          JOIN grupos   g  ON g.id = a.grupo_id
          WHERE a.estudiante_id = ?
          ORDER BY a.creado_en DESC
          LIMIT 10
        `, [hijo.id]),

        db.query(`
          SELECT op.periodo, op.texto, op.actualizado_en, du.nombre AS nombre_docente
          FROM observaciones_periodo op
          LEFT JOIN usuarios du ON du.id = op.docente_id
          WHERE op.estudiante_id = ?
          ORDER BY FIELD(op.periodo, '1','2','3','4','final')
        `, [hijo.id]),

        db.query(`
          SELECT c.id, c.motivo, c.fecha_cita, c.hora_cita, c.lugar, c.estado, c.creado_en,
                 cu.nombre AS nombre_citador
          FROM citaciones c
          JOIN usuarios cu ON cu.id = c.citado_por
          WHERE c.estudiante_id = ?
          ORDER BY c.creado_en DESC
        `, [hijo.id]),
      ]);

      const promedioGlobal = materiasRows.length > 0
        ? (materiasRows.reduce((s, m) => s + parseFloat(m.promedio), 0) / materiasRows.length).toFixed(1)
        : null;

      return {
        ...hijo,
        promedio_global:    promedioGlobal,
        materias:           materiasRows,
        asistencia:         asistRows[0]    || { tasa: null, total: 0 },
        riesgo:             riesgoRows[0]   || null,
        recientes:          recientesRows,
        historial:          historialRows,
        promedios_periodo:  periodoRows,
        asistencia_detalle: asistDetalleRows,
        anotaciones:        anotacionesRows,
        observaciones:      observacionesRows,
        citaciones:         citacionesRows,
      };
    }));

    res.json({ data: resultado });
  } catch (err) {
    console.error('Error en misHijos:', err);
    res.status(500).json({ error: 'Error al obtener información de tus hijos' });
  }
}

// GET /api/padre/listar — para admin (solo del mismo colegio)
async function listar(req, res) {
  try {
    const [padres] = await db.query(`
      SELECT u.id, u.nombre, u.email, u.activo,
             GROUP_CONCAT(h.nombre ORDER BY ${ordenApellido('h.nombre')} SEPARATOR ', ') AS hijos
      FROM usuarios u
      LEFT JOIN padre_estudiante pe ON pe.padre_id = u.id
      LEFT JOIN usuarios          h  ON h.id = pe.estudiante_id
      WHERE u.rol = 'padre'
        AND u.colegio_id = ?
      GROUP BY u.id
      ORDER BY u.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: padres });
  } catch (err) {
    console.error('Error en listar padres:', err);
    res.status(500).json({ error: 'Error al obtener los padres' });
  }
}

// POST /api/padre — crear cuenta de padre y vincular a estudiante (admin)
async function crear(req, res) {
  const { nombre, email, password, estudiante_id } = req.body;
  // El padre siempre queda en el colegio del admin (antes venía del formulario
  // y, si se dejaba vacío, la cuenta quedaba sin colegio y no aparecía en la lista)
  const colegio_id = req.usuario.colegio_id;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (estudiante_id) {
      const [[est]] = await conn.query(
        'SELECT id FROM usuarios WHERE id = ? AND rol = "estudiante" AND colegio_id = ?',
        [estudiante_id, colegio_id]
      );
      if (!est) {
        await conn.rollback();
        return res.status(404).json({ error: 'Estudiante no encontrado' });
      }
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      'INSERT INTO usuarios (nombre, email, password, rol, colegio_id) VALUES (?, ?, ?, "padre", ?)',
      [nombre, email, hash, colegio_id || null]
    );
    const padreId = result.insertId;
    if (estudiante_id) {
      await conn.query(
        'INSERT IGNORE INTO padre_estudiante (padre_id, estudiante_id) VALUES (?, ?)',
        [padreId, estudiante_id]
      );
    }
    await conn.commit();
    res.status(201).json({ mensaje: 'Cuenta de padre creada', data: { id: padreId } });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear padre:', err);
    res.status(500).json({ error: 'Error al crear el padre' });
  } finally {
    conn.release();
  }
}

// POST /api/padre/:id/vincular — vincular padre existente a un estudiante (admin)
async function vincular(req, res) {
  const { id } = req.params;
  const { estudiante_id } = req.body;
  if (!estudiante_id) return res.status(400).json({ error: 'estudiante_id es obligatorio' });
  try {
    // Padre y estudiante deben ser del colegio del admin
    const [ok] = await db.query(
      `SELECT COUNT(*) AS n FROM usuarios
       WHERE colegio_id = ? AND ((id = ? AND rol = 'padre') OR (id = ? AND rol = 'estudiante'))`,
      [req.usuario.colegio_id, id, estudiante_id]
    );
    if (ok[0].n < 2) return res.status(404).json({ error: 'Padre o estudiante no encontrado' });
    await db.query(
      'INSERT IGNORE INTO padre_estudiante (padre_id, estudiante_id) VALUES (?, ?)',
      [id, estudiante_id]
    );
    res.json({ mensaje: 'Vinculado correctamente' });
  } catch (err) {
    console.error('Error al vincular:', err);
    res.status(500).json({ error: 'Error al vincular' });
  }
}

// Activa o desactiva la cuenta de un padre, solo si pertenece al colegio del admin
async function cambiarEstado(req, res, activo) {
  try {
    const [r] = await db.query(
      'UPDATE usuarios SET activo = ? WHERE id = ? AND rol = "padre" AND colegio_id = ?',
      [activo, req.params.id, req.usuario.colegio_id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Padre no encontrado' });
    res.json({ mensaje: activo ? 'Padre reactivado' : 'Padre desactivado' });
  } catch (err) {
    console.error('Error al cambiar estado del padre:', err);
    res.status(500).json({ error: activo ? 'Error al reactivar' : 'Error al desactivar' });
  }
}

// DELETE /api/padre/:id — desactivar (admin)
function desactivar(req, res) { return cambiarEstado(req, res, false); }

// PUT /api/padre/:id/reactivar — volver a activar (admin)
function reactivar(req, res) { return cambiarEstado(req, res, true); }

module.exports = { misHijos, listar, crear, vincular, desactivar, reactivar };
