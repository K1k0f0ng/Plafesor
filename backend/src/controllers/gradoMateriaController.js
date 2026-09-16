const db = require('../database');
const { obtenerGrados } = require('../utils/gradoAcademico');
const { registrarAuditoria } = require('../utils/auditoria');

// GET /api/grado-materias/:grado — ids de las asignaturas del pénsum de ese grado
async function listar(req, res) {
  const { grado } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [filas] = await db.query(
      'SELECT materia_id FROM grado_materias WHERE colegio_id = ? AND grado_codigo = ?',
      [colegio_id, grado]
    );
    res.json({ data: filas.map(f => f.materia_id) });
  } catch (err) {
    console.error('Error al listar el pénsum del grado:', err);
    res.status(500).json({ error: 'Error al obtener las asignaturas del grado' });
  }
}

// PUT /api/grado-materias/:grado — body: { materia_ids: number[] } — reemplaza el pénsum completo del grado
async function actualizar(req, res) {
  const { grado } = req.params;
  const { materia_ids } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!Array.isArray(materia_ids)) {
    return res.status(400).json({ error: 'materia_ids debe ser una lista' });
  }

  try {
    const gradosColegio = await obtenerGrados(colegio_id);
    if (!gradosColegio.some(g => g.codigo === String(grado))) {
      return res.status(400).json({ error: 'El grado seleccionado no existe en el catálogo de grados del colegio' });
    }

    if (materia_ids.length > 0) {
      const placeholders = materia_ids.map(() => '?').join(',');
      const [validas] = await db.query(
        `SELECT id FROM materias WHERE id IN (${placeholders}) AND activa = TRUE AND (colegio_id = ? OR colegio_id IS NULL)`,
        [...materia_ids, colegio_id]
      );
      if (validas.length !== new Set(materia_ids).size) {
        return res.status(400).json({ error: 'Una o más asignaturas seleccionadas no son válidas' });
      }
    }

    await db.query('DELETE FROM grado_materias WHERE colegio_id = ? AND grado_codigo = ?', [colegio_id, grado]);
    for (const materia_id of materia_ids) {
      await db.query(
        'INSERT INTO grado_materias (colegio_id, grado_codigo, materia_id) VALUES (?, ?, ?)',
        [colegio_id, grado, materia_id]
      );
    }

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'grado_materias_editado', entidad: 'grado_materias', entidad_id: null,
      detalle: { grado, cantidad: materia_ids.length },
    });

    res.json({ mensaje: 'Asignaturas del grado actualizadas' });
  } catch (err) {
    console.error('Error al actualizar el pénsum del grado:', err);
    res.status(500).json({ error: 'Error al actualizar las asignaturas del grado' });
  }
}

module.exports = { listar, actualizar };
