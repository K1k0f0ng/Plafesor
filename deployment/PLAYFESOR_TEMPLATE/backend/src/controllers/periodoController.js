const db = require('../database');

// GET /api/periodos/colegio/:colegio_id
async function listar(req, res) {
  const { colegio_id } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT id, colegio_id, nombre, numero, porcentaje, ano_lectivo,
             fecha_inicio, fecha_fin, activo, creado_en
      FROM periodos_academicos
      WHERE colegio_id = ?
      ORDER BY ano_lectivo DESC, numero ASC
    `, [colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar períodos:', err);
    res.status(500).json({ error: 'Error al obtener los períodos' });
  }
}

// GET /api/periodos/colegio/:colegio_id/activo
async function obtenerActivo(req, res) {
  const { colegio_id } = req.params;
  try {
    const [filas] = await db.query(`
      SELECT id, nombre, numero, ano_lectivo, fecha_inicio, fecha_fin
      FROM periodos_academicos
      WHERE colegio_id = ? AND activo = TRUE
      LIMIT 1
    `, [colegio_id]);
    res.json({ data: filas[0] || null });
  } catch (err) {
    console.error('Error al obtener período activo:', err);
    res.status(500).json({ error: 'Error al obtener el período activo' });
  }
}

// POST /api/periodos — colegio_id viene del JWT
async function crear(req, res) {
  const { nombre, numero, porcentaje, ano_lectivo, fecha_inicio, fecha_fin } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!colegio_id || !nombre || !numero || !ano_lectivo || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (!['1', '2', '3', '4'].includes(String(numero))) {
    return res.status(400).json({ error: 'El número de período debe ser 1, 2, 3 o 4' });
  }
  if (fecha_fin <= fecha_inicio) {
    return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
  }
  const pct = porcentaje === undefined || porcentaje === null || porcentaje === '' ? 0 : parseFloat(porcentaje);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'El porcentaje debe ser un número entre 0 y 100' });
  }

  try {
    const [result] = await db.query(`
      INSERT INTO periodos_academicos (colegio_id, nombre, numero, porcentaje, ano_lectivo, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [colegio_id, nombre, String(numero), pct, ano_lectivo, fecha_inicio, fecha_fin]);
    res.status(201).json({ mensaje: 'Período creado', data: { id: result.insertId } });
  } catch (err) {
    console.error('Error al crear período:', err);
    res.status(500).json({ error: 'Error al crear el período' });
  }
}

// PUT /api/periodos/:id
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, numero, porcentaje, ano_lectivo, fecha_inicio, fecha_fin } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (fecha_fin && fecha_inicio && fecha_fin <= fecha_inicio) {
    return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la fecha de inicio' });
  }
  if (numero !== undefined && numero !== null && !['1', '2', '3', '4'].includes(String(numero))) {
    return res.status(400).json({ error: 'El número de período debe ser 1, 2, 3 o 4' });
  }
  let pct = null;
  if (porcentaje !== undefined && porcentaje !== null && porcentaje !== '') {
    pct = parseFloat(porcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'El porcentaje debe ser un número entre 0 y 100' });
    }
  }

  try {
    const [[periodo]] = await db.query(
      'SELECT id FROM periodos_academicos WHERE id = ? AND colegio_id = ?',
      [id, colegio_id]
    );
    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

    await db.query(`
      UPDATE periodos_academicos
      SET nombre       = COALESCE(?, nombre),
          numero       = COALESCE(?, numero),
          porcentaje   = COALESCE(?, porcentaje),
          ano_lectivo  = COALESCE(?, ano_lectivo),
          fecha_inicio = COALESCE(?, fecha_inicio),
          fecha_fin    = COALESCE(?, fecha_fin)
      WHERE id = ? AND colegio_id = ?
    `, [nombre || null, numero ? String(numero) : null, pct, ano_lectivo || null, fecha_inicio || null, fecha_fin || null, id, colegio_id]);
    res.json({ mensaje: 'Período actualizado' });
  } catch (err) {
    console.error('Error al actualizar período:', err);
    res.status(500).json({ error: 'Error al actualizar el período' });
  }
}

// PUT /api/periodos/:id/activar
// Activa este período y desactiva los demás del mismo colegio
async function activar(req, res) {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[periodo]] = await conn.query(
      'SELECT colegio_id FROM periodos_academicos WHERE id = ?', [id]
    );
    if (!periodo) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Período no encontrado' });
    }

    await conn.query(
      'UPDATE periodos_academicos SET activo = FALSE WHERE colegio_id = ?',
      [periodo.colegio_id]
    );
    await conn.query(
      'UPDATE periodos_academicos SET activo = TRUE WHERE id = ?',
      [id]
    );

    await conn.commit();
    conn.release();
    res.json({ mensaje: 'Período activado correctamente' });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Error al activar período:', err);
    res.status(500).json({ error: 'Error al activar el período' });
  }
}

// DELETE /api/periodos/:id
async function eliminar(req, res) {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[periodo]] = await db.query(
      'SELECT activo FROM periodos_academicos WHERE id = ? AND colegio_id = ?', [id, colegio_id]
    );
    if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });
    if (periodo.activo) {
      return res.status(400).json({ error: 'No se puede eliminar el período activo. Activa otro período primero.' });
    }
    await db.query('DELETE FROM periodos_academicos WHERE id = ? AND colegio_id = ?', [id, colegio_id]);
    res.json({ mensaje: 'Período eliminado' });
  } catch (err) {
    console.error('Error al eliminar período:', err);
    res.status(500).json({ error: 'Error al eliminar el período' });
  }
}

module.exports = { listar, obtenerActivo, crear, actualizar, activar, eliminar };
