const bcrypt = require('bcryptjs');
const db = require('../database');

// GET /api/estudiantes?grupo_id=X — solo los del colegio del admin
async function listar(req, res) {
  const { grupo_id } = req.query;
  try {
    let sql = `
      SELECT u.id, u.nombre, u.email, u.activo, u.colegio_id,
             u.telefono_padres,
             eg.grupo_id,
             g.nombre AS nombre_grupo, g.grado
      FROM usuarios u
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos g ON g.id = eg.grupo_id
      WHERE u.rol = 'estudiante'
        AND (u.colegio_id = ? OR g.colegio_id = ?)
    `;
    const params = [req.usuario.colegio_id, req.usuario.colegio_id];
    if (grupo_id) {
      sql += ' AND eg.grupo_id = ?';
      params.push(grupo_id);
    }
    sql += ' ORDER BY u.nombre ASC';

    const [filas] = await db.query(sql, params);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar estudiantes:', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
}

// POST /api/estudiantes — colegio_id viene del JWT
async function crear(req, res) {
  const { nombre, email, password, grupo_id, telefono_padres } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      'INSERT INTO usuarios (nombre, email, password, rol, colegio_id, telefono_padres) VALUES (?, ?, ?, "estudiante", ?, ?)',
      [nombre, email, hash, colegio_id || null, telefono_padres || null]
    );

    const estudianteId = result.insertId;

    if (grupo_id) {
      await conn.query(
        'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
        [estudianteId, grupo_id]
      );
    }

    await conn.commit();
    res.status(201).json({ mensaje: 'Estudiante creado', data: { id: estudianteId, nombre, email } });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al crear estudiante:', err);
    res.status(500).json({ error: 'Error al crear el estudiante' });
  } finally {
    conn.release();
  }
}

// POST /api/estudiantes/importar — importación masiva desde CSV
async function importar(req, res) {
  // El CSV debe tener columnas: nombre,email,password,grupo_id
  const { estudiantes } = req.body; // array de objetos

  if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de estudiantes' });
  }

  const conn = await db.getConnection();
  const creados = [];
  const errores = [];

  try {
    await conn.beginTransaction();

    for (const est of estudiantes) {
      try {
        if (!est.password || String(est.password).trim().length < 6) {
          errores.push({ email: est.email, error: 'Contraseña requerida (mínimo 6 caracteres)' });
          continue;
        }
        const hash = await bcrypt.hash(String(est.password), 10);
        const [result] = await conn.query(
          'INSERT INTO usuarios (nombre, email, password, rol, colegio_id) VALUES (?, ?, ?, "estudiante", ?)',
          [est.nombre, est.email, hash, req.usuario.colegio_id || null]
        );
        if (est.grupo_id) {
          await conn.query(
            'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
            [result.insertId, est.grupo_id]
          );
        }
        creados.push(est.email);
      } catch (e) {
        errores.push({ email: est.email, error: e.code === 'ER_DUP_ENTRY' ? 'Email duplicado' : e.message });
      }
    }

    await conn.commit();
    res.json({ mensaje: `${creados.length} estudiantes importados`, creados, errores });
  } catch (err) {
    await conn.rollback();
    console.error('Error en importación:', err);
    res.status(500).json({ error: 'Error en la importación masiva' });
  } finally {
    conn.release();
  }
}

// PUT /api/estudiantes/:id — colegio_id viene del JWT
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, email, grupo_id, telefono_padres } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'Nombre y email son obligatorios' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE usuarios SET nombre = ?, email = ?, colegio_id = ?, telefono_padres = ?
       WHERE id = ? AND rol = 'estudiante'`,
      [nombre, email, colegio_id || null, telefono_padres || null, id]
    );

    // Reasignar grupo
    await conn.query('DELETE FROM estudiante_grupos WHERE estudiante_id = ?', [id]);
    if (grupo_id) {
      await conn.query(
        'INSERT INTO estudiante_grupos (estudiante_id, grupo_id) VALUES (?, ?)',
        [id, grupo_id]
      );
    }

    await conn.commit();
    res.json({ mensaje: 'Estudiante actualizado' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error al actualizar estudiante:', err);
    res.status(500).json({ error: 'Error al actualizar el estudiante' });
  } finally {
    conn.release();
  }
}

// DELETE /api/estudiantes/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    await db.query('UPDATE usuarios SET activo = FALSE WHERE id = ? AND rol = "estudiante"', [id]);
    res.json({ mensaje: 'Estudiante desactivado' });
  } catch (err) {
    console.error('Error al desactivar estudiante:', err);
    res.status(500).json({ error: 'Error al desactivar el estudiante' });
  }
}

// GET /api/estudiantes/:id/historial
async function historial(req, res) {
  const eid = parseInt(req.params.id);

  // Estudiante solo puede ver su propio historial
  if (req.usuario.rol === 'estudiante' && req.usuario.id !== eid) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio historial' });
  }

  try {
    const [
      [infoRows],
      [porMateriaRows],
      [porPeriodoRows],
      [recientesRows],
      [tendenciaRows],
    ] = await Promise.all([

      // 1. Datos del estudiante
      db.query(`
        SELECT u.nombre, u.email,
          g.nombre AS grupo, g.grado, c.nombre AS colegio
        FROM usuarios u
        LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
        LEFT JOIN grupos g ON g.id = eg.grupo_id
        LEFT JOIN colegios c ON c.id = u.colegio_id
        WHERE u.id = ?
        LIMIT 1
      `, [eid]),

      // 2. Promedio y distribución MEN por materia
      db.query(`
        SELECT
          m.id AS materia_id, m.nombre AS materia, m.codigo,
          COUNT(ra.id)                                                                AS total,
          ROUND(AVG(ra.nota), 1)                                                     AS promedio,
          SUM(CASE WHEN ra.nota < 3.5              THEN 1 ELSE 0 END)               AS bajo,
          SUM(CASE WHEN ra.nota >= 3.5 AND ra.nota < 4.0  THEN 1 ELSE 0 END)      AS basico,
          SUM(CASE WHEN ra.nota >= 4.0 AND ra.nota <= 4.5 THEN 1 ELSE 0 END)      AS alto,
          SUM(CASE WHEN ra.nota > 4.5              THEN 1 ELSE 0 END)               AS superior
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN materias m ON m.id = a.materia_id
        WHERE ra.estudiante_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY m.id, m.nombre, m.codigo
        ORDER BY promedio DESC
      `, [eid]),

      // 3. Promedio por período
      db.query(`
        SELECT
          a.periodo,
          COUNT(ra.id)            AS total,
          ROUND(AVG(ra.nota), 2)  AS promedio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE ra.estudiante_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY a.periodo
        ORDER BY a.periodo ASC
      `, [eid]),

      // 4. Actividades recientes (últimas 15)
      db.query(`
        SELECT
          a.titulo, a.periodo, a.tipo,
          m.nombre AS materia,
          ra.nota, ra.completada_en,
          CASE
            WHEN ra.nota < 3.5 THEN 'Bajo'
            WHEN ra.nota < 4.0 THEN 'Básico'
            WHEN ra.nota <= 4.5 THEN 'Alto'
            ELSE 'Superior'
          END AS nivel
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id
        JOIN materias m ON m.id = a.materia_id
        WHERE ra.estudiante_id = ?
        ORDER BY ra.completada_en DESC
        LIMIT 15
      `, [eid]),

      // 5. Tendencia semanal últimas 8 semanas
      db.query(`
        SELECT
          YEARWEEK(ra.completada_en, 1) AS semana_num,
          DATE(MIN(ra.completada_en))   AS fecha_inicio,
          ROUND(AVG(ra.nota), 2)        AS promedio,
          COUNT(ra.id)                  AS total
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        WHERE ra.estudiante_id = ?
          AND ra.completada_en >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY YEARWEEK(ra.completada_en, 1)
        ORDER BY semana_num ASC
      `, [eid]),
    ]);

    const info = infoRows[0] || {};
    const totalNotas = porMateriaRows.reduce((s, m) => s + (parseInt(m.total) || 0), 0);
    const promedioGlobal = porMateriaRows.length > 0
      ? parseFloat((porMateriaRows.reduce((s, m) => s + (parseFloat(m.promedio) || 0), 0) / porMateriaRows.length).toFixed(1))
      : null;

    res.json({
      data: {
        estudiante:      info.nombre || '',
        grupo:           info.grupo  || '',
        grado:           info.grado  || '',
        colegio:         info.colegio || '',
        promedioGlobal,
        totalActividades: totalNotas,
        porMateria:      porMateriaRows,
        porPeriodo:      porPeriodoRows,
        recientes:       recientesRows,
        tendencia:       tendenciaRows,
      },
    });
  } catch (err) {
    console.error('Error en historial estudiante:', err);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
}

module.exports = { listar, crear, importar, actualizar, eliminar, historial };
