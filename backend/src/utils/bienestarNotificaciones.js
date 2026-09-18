const db = require('../database');

// Notificaciones in-app del módulo Bienestar (tabla `notificaciones`, la misma
// campanita del resto de Playfesor). Regla: NUNCA incluyen motivo,
// descripción ni nada del contenido — solo que "hay algo" y dónde verlo.
// Nunca van por WhatsApp (sale de la plataforma).

async function notificar(usuarioIds, { tipo, ref_key, titulo, mensaje = null }) {
  const ids = [...new Set(usuarioIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    await db.query(
      'INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje) VALUES ?',
      [ids.map(id => [id, tipo, ref_key, titulo, mensaje])]
    );
  } catch (err) {
    // Una notificación perdida no debe tumbar la acción principal
    console.error('Bienestar: error al crear notificación:', err.message);
  }
}

// Todos los orientadores activos del equipo del colegio
async function idsEquipo(colegio_id) {
  const [filas] = await db.query(
    `SELECT be.usuario_id FROM bienestar_equipo be
     JOIN usuarios u ON u.id = be.usuario_id AND u.activo = TRUE
     WHERE be.colegio_id = ? AND be.activo = TRUE`,
    [colegio_id]
  );
  return filas.map(f => f.usuario_id);
}

async function notificarEquipo(colegio_id, datos) {
  try {
    await notificar(await idsEquipo(colegio_id), datos);
  } catch (err) {
    console.error('Bienestar: error al notificar al equipo:', err.message);
  }
}

module.exports = { notificar, notificarEquipo, idsEquipo };
