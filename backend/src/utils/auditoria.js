const db = require('../database');

/**
 * Registra una acción sensible en la bitácora institucional. Nunca debe
 * interrumpir la operación principal: si falla, solo queda en el log del
 * servidor — perder un registro de auditoría no puede tumbar una petición.
 *
 * @param {object} datos
 * @param {number} datos.colegio_id
 * @param {number|null} datos.usuario_id   - quién hizo la acción
 * @param {string|null} datos.usuario_nombre
 * @param {string|null} datos.usuario_rol
 * @param {string} datos.accion            - ej. 'nota_editada', 'estudiante_creado'
 * @param {string} datos.entidad           - ej. 'resultado_actividad', 'estudiante'
 * @param {number|null} datos.entidad_id   - id del registro afectado
 * @param {object|string|null} datos.detalle - contexto legible (se guarda como JSON si es objeto)
 */
async function registrarAuditoria({
  colegio_id, usuario_id = null, usuario_nombre = null, usuario_rol = null,
  accion, entidad, entidad_id = null, detalle = null,
}) {
  try {
    const detalleTexto = detalle && typeof detalle === 'object' ? JSON.stringify(detalle) : (detalle || null);
    await db.query(
      `INSERT INTO auditoria (colegio_id, usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [colegio_id, usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, detalleTexto]
    );
  } catch (err) {
    console.error('Error al registrar auditoría:', err.message);
  }
}

module.exports = { registrarAuditoria };
