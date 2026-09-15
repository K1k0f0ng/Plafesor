const db = require('../database');

// Catálogo estándar de motivos de retiro — se siembra la primera vez que un
// colegio consulta este catálogo, igual que el de grados académicos.
const MOTIVOS_ESTANDAR = [
  'Traslado a otra institución',
  'Cambio de domicilio o ciudad',
  'Dificultades económicas',
  'Bajo rendimiento académico',
  'Motivos disciplinarios',
  'Motivos de salud',
  'Decisión familiar',
  'No renovación de matrícula',
  'Otro',
];

/** Trae el catálogo de motivos de retiro del colegio, sembrando el estándar si aún no tiene ninguno. */
async function obtenerMotivos(colegio_id) {
  const [filas] = await db.query(
    'SELECT * FROM motivos_retiro WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  if (filas.length > 0) return filas;

  for (let i = 0; i < MOTIVOS_ESTANDAR.length; i++) {
    await db.query(
      'INSERT IGNORE INTO motivos_retiro (colegio_id, nombre, orden) VALUES (?, ?, ?)',
      [colegio_id, MOTIVOS_ESTANDAR[i], i]
    );
  }

  const [nuevos] = await db.query(
    'SELECT * FROM motivos_retiro WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  return nuevos;
}

module.exports = { obtenerMotivos, MOTIVOS_ESTANDAR };
