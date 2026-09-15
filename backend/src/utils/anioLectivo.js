const db = require('../database');

/**
 * Devuelve el año lectivo activo del colegio. Si el colegio todavía no
 * tiene ninguno registrado (colegios que ya usaban Playfesor antes de esta
 * función), lo crea a partir del año más alto que ya tengan sus grupos —
 * así ningún colegio existente queda bloqueado por falta de un paso manual.
 */
async function obtenerAnioActivo(colegio_id) {
  const [[activo]] = await db.query(
    "SELECT id, anio FROM anios_lectivos WHERE colegio_id = ? AND estado = 'activo'",
    [colegio_id]
  );
  if (activo) return activo;

  const [[{ maxAnio }]] = await db.query(
    'SELECT MAX(ano_lectivo) AS maxAnio FROM grupos WHERE colegio_id = ?',
    [colegio_id]
  );
  const anio = maxAnio || new Date().getFullYear();
  const [result] = await db.query(
    "INSERT INTO anios_lectivos (colegio_id, anio, estado) VALUES (?, ?, 'activo')",
    [colegio_id, anio]
  );
  return { id: result.insertId, anio };
}

/** true si ese año lectivo del colegio ya fue cerrado (no acepta actividades nuevas) */
async function anioEstaCerrado(colegio_id, anio) {
  const [[fila]] = await db.query(
    "SELECT id FROM anios_lectivos WHERE colegio_id = ? AND anio = ? AND estado = 'cerrado'",
    [colegio_id, anio]
  );
  return !!fila;
}

module.exports = { obtenerAnioActivo, anioEstaCerrado };
