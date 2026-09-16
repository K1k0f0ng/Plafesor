const db = require('../database');

// Días 1-5 activos por defecto (lunes a viernes) — sábado y domingo quedan
// creados pero inactivos, para el colegio que sí dicta clase el sábado solo
// tenga que activarlo y renombrar si quiere.
const DIAS_ESTANDAR = [
  { dia_numero: 1, nombre: 'Lunes',     activo: true },
  { dia_numero: 2, nombre: 'Martes',    activo: true },
  { dia_numero: 3, nombre: 'Miércoles', activo: true },
  { dia_numero: 4, nombre: 'Jueves',    activo: true },
  { dia_numero: 5, nombre: 'Viernes',   activo: true },
  { dia_numero: 6, nombre: 'Sábado',    activo: false },
  { dia_numero: 7, nombre: 'Domingo',   activo: false },
];

/** Trae la semana académica del colegio, sembrando el estándar si aún no tiene ninguna. */
async function obtenerSemanaAcademica(colegio_id) {
  const [filas] = await db.query(
    'SELECT * FROM semana_academica WHERE colegio_id = ? ORDER BY dia_numero ASC',
    [colegio_id]
  );
  if (filas.length > 0) return filas;

  for (const d of DIAS_ESTANDAR) {
    await db.query(
      'INSERT IGNORE INTO semana_academica (colegio_id, dia_numero, nombre, activo) VALUES (?, ?, ?, ?)',
      [colegio_id, d.dia_numero, d.nombre, d.activo]
    );
  }

  const [nuevos] = await db.query(
    'SELECT * FROM semana_academica WHERE colegio_id = ? ORDER BY dia_numero ASC',
    [colegio_id]
  );
  return nuevos;
}

module.exports = { obtenerSemanaAcademica, DIAS_ESTANDAR };
