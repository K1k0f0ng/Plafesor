const db = require('../database');
const { obtenerPreferencias, CAMPOS } = require('../utils/preferenciasNotificacion');

// GET /api/preferencias-notificacion — propias del usuario autenticado
async function obtener(req, res) {
  try {
    const preferencias = await obtenerPreferencias(req.usuario.id);
    res.json({ data: preferencias });
  } catch (err) {
    console.error('Error al obtener preferencias de notificación:', err);
    res.status(500).json({ error: 'Error al obtener las preferencias de notificación' });
  }
}

// PUT /api/preferencias-notificacion — body: { notif_mensajes?, notif_citaciones?, notif_riesgo_academico?, notif_whatsapp? }
async function actualizar(req, res) {
  const valores = {};
  for (const campo of CAMPOS) {
    if (req.body[campo] !== undefined) valores[campo] = !!req.body[campo];
  }
  if (Object.keys(valores).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  try {
    const actuales = await obtenerPreferencias(req.usuario.id);
    const finales = { ...actuales, ...valores };

    await db.query(
      `INSERT INTO preferencias_notificacion (usuario_id, notif_mensajes, notif_citaciones, notif_riesgo_academico, notif_whatsapp)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         notif_mensajes = VALUES(notif_mensajes),
         notif_citaciones = VALUES(notif_citaciones),
         notif_riesgo_academico = VALUES(notif_riesgo_academico),
         notif_whatsapp = VALUES(notif_whatsapp)`,
      [req.usuario.id, finales.notif_mensajes, finales.notif_citaciones, finales.notif_riesgo_academico, finales.notif_whatsapp]
    );

    res.json({ mensaje: 'Preferencias actualizadas', data: finales });
  } catch (err) {
    console.error('Error al actualizar preferencias de notificación:', err);
    res.status(500).json({ error: 'Error al actualizar las preferencias de notificación' });
  }
}

module.exports = { obtener, actualizar };
