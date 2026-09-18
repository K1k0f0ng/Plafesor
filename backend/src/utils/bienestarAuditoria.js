const db = require('../database');

// Bitácora del módulo Bienestar y Orientación. Separada de la `auditoria`
// general porque esa la consultan admin y director con el detalle incluido;
// aquí NUNCA se guarda contenido (motivos, resúmenes, notas), solo quién,
// qué acción, sobre qué registro, cuándo y desde qué IP.

// IP del cliente. Detrás del proxy de cPanel req.ip suele ser 127.0.0.1, así
// que se prefiere el primer valor de X-Forwarded-For. Ese encabezado lo puede
// falsear el cliente: sirve como dato de referencia, no como prueba.
function ipDe(req) {
  const reenviada = req?.headers?.['x-forwarded-for'];
  const ip = (reenviada ? String(reenviada).split(',')[0] : req?.ip) || null;
  return ip ? ip.trim().slice(0, 45) : null;
}

/**
 * @param {object} req      - request de Express (usuario autenticado)
 * @param {string} accion   - ej. 'caso_ver', 'nota_privada_ver', 'acceso_denegado'
 * @param {string} recurso  - ej. 'caso', 'seguimiento', 'configuracion'
 * @param {number|null} recurso_id
 * @param {number|null} caso_id
 */
async function registrarBienestar(req, accion, recurso, recurso_id = null, caso_id = null) {
  try {
    const u = req.usuario || {};
    if (!u.colegio_id) return;
    await db.query(
      `INSERT INTO bienestar_auditoria (colegio_id, usuario_id, usuario_rol, accion, recurso, recurso_id, caso_id, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.colegio_id, u.id || null, u.rol || null, accion, recurso, recurso_id, caso_id, ipDe(req)]
    );
  } catch (err) {
    // Perder un registro de bitácora nunca debe tumbar la operación principal
    console.error('Error al registrar bitácora de bienestar:', err.message);
  }
}

module.exports = { registrarBienestar, ipDe };
