const db = require('../database');

const CAMPOS = ['notif_mensajes', 'notif_citaciones', 'notif_riesgo_academico', 'notif_whatsapp'];

// Sin fila guardada = todo activado por defecto (no cambia el comportamiento
// de nadie que nunca haya tocado sus preferencias).
const PREDETERMINADAS = {
  notif_mensajes: true, notif_citaciones: true, notif_riesgo_academico: true, notif_whatsapp: true,
};

async function obtenerPreferencias(usuario_id) {
  const [[fila]] = await db.query('SELECT * FROM preferencias_notificacion WHERE usuario_id = ?', [usuario_id]);
  return fila || { usuario_id, ...PREDETERMINADAS };
}

// Filtra una lista de usuario_id, dejando solo los que tienen esa categoría
// activada (o no han guardado preferencia todavía, que cuenta como activada).
async function filtrarPorPreferencia(usuarioIds, campo) {
  if (!CAMPOS.includes(campo)) throw new Error(`Campo de preferencia inválido: ${campo}`);
  const ids = [...new Set(usuarioIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const [filas] = await db.query(
    `SELECT usuario_id, ${campo} AS activo FROM preferencias_notificacion WHERE usuario_id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const desactivados = new Set(filas.filter(f => !f.activo).map(f => f.usuario_id));
  return usuarioIds.filter(id => !desactivados.has(id));
}

// Para WhatsApp a acudientes: un estudiante queda excluido del envío si
// ALGUNO de sus acudientes vinculados desactivó explícitamente el canal
// (el teléfono guardado en el estudiante no está atado a una sola cuenta,
// así que se prioriza respetar el "no quiero" sobre no perderse un aviso).
async function estudiantesConWhatsappActivo(estudianteIds) {
  const ids = [...new Set(estudianteIds)].filter(Boolean);
  if (ids.length === 0) return [];

  const [filas] = await db.query(
    `SELECT DISTINCT pe.estudiante_id
     FROM padre_estudiante pe
     JOIN preferencias_notificacion pn ON pn.usuario_id = pe.padre_id
     WHERE pe.estudiante_id IN (${ids.map(() => '?').join(',')}) AND pn.notif_whatsapp = FALSE`,
    ids
  );
  const desactivados = new Set(filas.map(f => f.estudiante_id));
  return estudianteIds.filter(id => !desactivados.has(id));
}

module.exports = { obtenerPreferencias, filtrarPorPreferencia, estudiantesConWhatsappActivo, CAMPOS };
