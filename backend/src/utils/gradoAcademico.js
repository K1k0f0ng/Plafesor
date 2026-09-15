const db = require('../database');

const NIVEL_LABEL = {
  prejardin: 'Prejardín', jardin: 'Jardín', transicion: 'Transición',
  primaria: 'Básica Primaria', secundaria: 'Básica Secundaria', media: 'Educación Media',
};

// Catálogo estándar colombiano (MEN) — se siembra la primera vez que un
// colegio usa esta pantalla. Los códigos '5'..'11' coinciden a propósito
// con los valores que ya traían los grupos existentes, así ningún colegio
// que ya usaba Playfesor pierde su información al activarse esto.
const GRADOS_ESTANDAR = [
  { codigo: 'prejardin',  nombre: 'Prejardín',  nivel: 'prejardin',  programa: 'Pre-escolar O Inferior', orden: 1,  intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: 'jardin',     nombre: 'Jardín',     nivel: 'jardin',     programa: 'Pre-escolar O Inferior', orden: 2,  intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: 'transicion', nombre: 'Transición', nivel: 'transicion', programa: 'Pre-escolar O Inferior', orden: 3,  intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '1', nombre: 'Primero', nivel: 'primaria', programa: 'Primaria', orden: 4, intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '2', nombre: 'Segundo', nivel: 'primaria', programa: 'Primaria', orden: 5, intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '3', nombre: 'Tercero', nivel: 'primaria', programa: 'Primaria', orden: 6, intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '4', nombre: 'Cuarto',  nivel: 'primaria', programa: 'Primaria', orden: 7, intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '5', nombre: 'Quinto',  nivel: 'primaria', programa: 'Primaria', orden: 8, intensidad_horaria: 45, max_tareas: 1, max_evaluaciones: 99 },
  { codigo: '6', nombre: 'Sexto',   nivel: 'secundaria', programa: 'Bachillerato Académico', orden: 9,  intensidad_horaria: 45, max_tareas: 2, max_evaluaciones: 55 },
  { codigo: '7', nombre: 'Séptimo', nivel: 'secundaria', programa: 'Bachillerato Académico', orden: 10, intensidad_horaria: 45, max_tareas: 2, max_evaluaciones: 55 },
  { codigo: '8', nombre: 'Octavo',  nivel: 'secundaria', programa: 'Bachillerato Académico', orden: 11, intensidad_horaria: 45, max_tareas: 2, max_evaluaciones: 55 },
  { codigo: '9', nombre: 'Noveno',  nivel: 'secundaria', programa: 'Bachillerato Académico', orden: 12, intensidad_horaria: 45, max_tareas: 2, max_evaluaciones: 55 },
  { codigo: '10', nombre: 'Décimo',   nivel: 'media', programa: 'Bachillerato Académico', orden: 13, intensidad_horaria: 42, max_tareas: 2, max_evaluaciones: 99 },
  { codigo: '11', nombre: 'Undécimo', nivel: 'media', programa: 'Bachillerato Académico', orden: 14, intensidad_horaria: 42, max_tareas: 2, max_evaluaciones: 99 },
];

/** Trae el catálogo de grados del colegio, sembrando el estándar si aún no tiene ninguno. */
async function obtenerGrados(colegio_id) {
  const [filas] = await db.query(
    'SELECT * FROM grados_academicos WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  if (filas.length > 0) return filas;

  for (const g of GRADOS_ESTANDAR) {
    await db.query(
      `INSERT IGNORE INTO grados_academicos
         (colegio_id, nivel, programa, codigo, nombre, orden, intensidad_horaria, max_tareas, max_evaluaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [colegio_id, g.nivel, g.programa, g.codigo, g.nombre, g.orden, g.intensidad_horaria, g.max_tareas, g.max_evaluaciones]
    );
  }

  const [nuevos] = await db.query(
    'SELECT * FROM grados_academicos WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  return nuevos;
}

module.exports = { obtenerGrados, NIVEL_LABEL, GRADOS_ESTANDAR };
