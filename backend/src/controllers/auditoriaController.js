const db = require('../database');

const ACCIONES_VALIDAS = [
  'inicio_sesion', 'nota_editada', 'estudiante_creado', 'estudiante_editado',
  'estudiante_retirado', 'colegio_editado', 'historico_importado', 'anio_lectivo_cerrado',
  'grado_academico_editado', 'motivo_retiro_editado', 'modulos_colegio_editados',
  'evento_institucional_creado', 'evento_institucional_editado', 'evento_institucional_eliminado',
  'personal_creado', 'personal_editado', 'personal_desactivado',
  'piar_documento_subido', 'piar_documento_eliminado',
  'grupo_editado', 'semana_academica_editada', 'salon_editado', 'area_academica_editada',
  'asignatura_editada', 'grado_materias_editado', 'clase_definida', 'carga_academica_reasignada',
  'clases_trasladadas',
];

// GET /api/auditoria/colegio/:colegio_id?accion=&entidad=&desde=&hasta=&pagina=
async function listar(req, res) {
  const { colegio_id } = req.params;

  if (req.usuario.colegio_id !== parseInt(colegio_id)) {
    return res.status(403).json({ error: 'Solo puedes ver la auditoría de tu propio colegio' });
  }

  const { accion, entidad, desde, hasta } = req.query;
  const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
  const porPagina = 40;
  const offset = (pagina - 1) * porPagina;

  const condiciones = ['colegio_id = ?'];
  const params = [colegio_id];
  if (accion && ACCIONES_VALIDAS.includes(accion)) { condiciones.push('accion = ?'); params.push(accion); }
  if (entidad)                                     { condiciones.push('entidad = ?'); params.push(entidad); }
  if (desde)                                       { condiciones.push('creado_en >= ?'); params.push(desde); }
  if (hasta)                                        { condiciones.push('creado_en <= ?'); params.push(hasta); }
  const where = condiciones.join(' AND ');

  try {
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM auditoria WHERE ${where}`, params);
    const [filas] = await db.query(
      `SELECT id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, detalle, creado_en
       FROM auditoria WHERE ${where}
       ORDER BY creado_en DESC LIMIT ? OFFSET ?`,
      [...params, porPagina, offset]
    );
    res.json({ data: filas, total, pagina, porPagina });
  } catch (err) {
    console.error('Error al listar auditoría:', err);
    res.status(500).json({ error: 'Error al obtener la auditoría' });
  }
}

module.exports = { listar, ACCIONES_VALIDAS };
