const db = require('../database');

/** Trae los salones activos del colegio (sin sembrado — es un catálogo libre, cada colegio agrega los suyos). */
async function obtenerSalones(colegio_id) {
  const [filas] = await db.query(
    'SELECT * FROM salones WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC, nombre ASC',
    [colegio_id]
  );
  return filas;
}

module.exports = { obtenerSalones };
