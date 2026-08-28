'use strict';
const db = require('../database');

async function listar(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT id, tipo, titulo, mensaje, leida, datos_extra, creado_en
      FROM notificaciones
      WHERE usuario_id = ?
      ORDER BY creado_en DESC
      LIMIT 30
    `, [req.usuario.id]);
    const sinLeer = rows.filter(r => !r.leida).length;
    res.json({ data: rows, sinLeer });
  } catch (err) {
    console.error('[Notificaciones] listar error:', err.message);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
}

async function marcarLeida(req, res) {
  try {
    await db.query(
      'UPDATE notificaciones SET leida = TRUE WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Notificaciones] marcarLeida error:', err.message);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    await db.query(
      'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = ?',
      [req.usuario.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Notificaciones] marcarTodasLeidas error:', err.message);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
}

module.exports = { listar, marcarLeida, marcarTodasLeidas };
