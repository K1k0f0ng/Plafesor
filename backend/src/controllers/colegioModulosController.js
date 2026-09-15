const db = require('../database');
const { MODULOS_DISPONIBLES, CLAVES_VALIDAS, obtenerModulosDesactivados } = require('../utils/modulos');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/colegio-modulos — catálogo completo con estado, para la pantalla
// de administración (solo director/admin).
async function listar(req, res) {
  try {
    const desactivados = await obtenerModulosDesactivados(req.usuario.colegio_id);
    const data = MODULOS_DISPONIBLES.map(m => ({ ...m, activo: !desactivados.includes(m.clave) }));
    res.json({ data });
  } catch (err) {
    console.error('Error al listar módulos del colegio:', err);
    res.status(500).json({ error: 'Error al obtener los módulos del colegio' });
  }
}

// GET /api/colegio-modulos/activos — solo la lista de módulos desactivados,
// para que cualquier rol autenticado sepa qué ocultar en su navegación.
async function activos(req, res) {
  try {
    const desactivados = await obtenerModulosDesactivados(req.usuario.colegio_id);
    res.json({ data: { desactivados } });
  } catch (err) {
    console.error('Error al obtener módulos activos:', err);
    res.json({ data: { desactivados: [] } });
  }
}

// PUT /api/colegio-modulos — body: { modulos_desactivados: ['piar', ...] }
async function actualizar(req, res) {
  const { modulos_desactivados } = req.body;
  if (!Array.isArray(modulos_desactivados) || !modulos_desactivados.every(m => CLAVES_VALIDAS.includes(m))) {
    return res.status(400).json({ error: 'Lista de módulos inválida' });
  }

  try {
    await db.query(
      'UPDATE colegios SET modulos_desactivados = ? WHERE id = ?',
      [JSON.stringify(modulos_desactivados), req.usuario.colegio_id]
    );

    registrarAuditoria({
      colegio_id: req.usuario.colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'modulos_colegio_editados', entidad: 'colegio', entidad_id: req.usuario.colegio_id,
      detalle: { modulos_desactivados },
    });

    res.json({ mensaje: 'Módulos actualizados' });
  } catch (err) {
    console.error('Error al actualizar módulos del colegio:', err);
    res.status(500).json({ error: 'Error al actualizar los módulos del colegio' });
  }
}

module.exports = { listar, activos, actualizar };
