const db = require('../database');

// Catálogo estándar colombiano (MEN): las 9 áreas fundamentales de básica y
// media (Ley 115 de 1994), más las 5 dimensiones del desarrollo que se usan
// en preescolar. Se siembra la primera vez que un colegio abre esta pantalla;
// el colegio puede renombrar, recodificar o desactivar cualquiera.
const AREAS_ESTANDAR = [
  { codigo: '1',  nombre: 'Matemáticas' },
  { codigo: '2',  nombre: 'Humanidades, lengua castellana e idiomas extranjeros' },
  { codigo: '3',  nombre: 'Ciencias naturales y educación ambiental' },
  { codigo: '4',  nombre: 'Ciencias sociales, historia, geografía, constitución política y democracia' },
  { codigo: '5',  nombre: 'Educación artística y cultural' },
  { codigo: '6',  nombre: 'Educación física, recreación y deportes' },
  { codigo: '7',  nombre: 'Ética y valores humanos' },
  { codigo: '8',  nombre: 'Tecnología e informática' },
  { codigo: '9',  nombre: 'Educación religiosa' },
  { codigo: '10', nombre: 'Dimensión cognitiva' },
  { codigo: '11', nombre: 'Dimensión socioafectiva' },
  { codigo: '12', nombre: 'Dimensión corporal' },
  { codigo: '13', nombre: 'Dimensión comunicativa' },
  { codigo: '14', nombre: 'Dimensión estética' },
];

/** Trae el catálogo de áreas del colegio, sembrando el estándar si aún no tiene ninguna. */
async function obtenerAreas(colegio_id) {
  const [filas] = await db.query(
    'SELECT * FROM areas_academicas WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  if (filas.length > 0) return filas;

  for (let i = 0; i < AREAS_ESTANDAR.length; i++) {
    const a = AREAS_ESTANDAR[i];
    await db.query(
      'INSERT IGNORE INTO areas_academicas (colegio_id, codigo, nombre, orden) VALUES (?, ?, ?, ?)',
      [colegio_id, a.codigo, a.nombre, i]
    );
  }

  const [nuevas] = await db.query(
    'SELECT * FROM areas_academicas WHERE colegio_id = ? AND activo = TRUE ORDER BY orden ASC',
    [colegio_id]
  );
  return nuevas;
}

module.exports = { obtenerAreas, AREAS_ESTANDAR };
