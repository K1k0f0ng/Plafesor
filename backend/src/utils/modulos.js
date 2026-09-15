const db = require('../database');

// Catálogo de módulos opcionales que un colegio puede apagar. Los módulos
// centrales (Estudiantes, Grupos, Calificaciones, Auditoría, etc.) nunca
// están aquí — solo se listan funcionalidades de valor agregado.
const MODULOS_DISPONIBLES = [
  { clave: 'copiloto_ia',          nombre: 'Copiloto IA' },
  { clave: 'piar',                 nombre: 'PIAR' },
  { clave: 'observador_academico', nombre: 'Observador Académico' },
  { clave: 'motor_riesgo',         nombre: 'Motor de Riesgo' },
  { clave: 'evaluacion_docentes',  nombre: 'Evaluación Docente' },
  { clave: 'citaciones',           nombre: 'Citaciones' },
  { clave: 'mensajes_masivos',     nombre: 'Mensajes Masivos' },
  { clave: 'gemelo_digital',       nombre: 'Gemelo Digital' },
  { clave: 'planes_mejoramiento',  nombre: 'Planes de Mejoramiento' },
  { clave: 'comparativas',         nombre: 'Comparativas de Períodos' },
  { clave: 'tutor_ia',             nombre: 'Tutor IA (estudiantes)' },
];

const CLAVES_VALIDAS = MODULOS_DISPONIBLES.map(m => m.clave);

async function obtenerModulosDesactivados(colegio_id) {
  if (!colegio_id) return [];
  const [[fila]] = await db.query('SELECT modulos_desactivados FROM colegios WHERE id = ?', [colegio_id]);
  if (!fila || !fila.modulos_desactivados) return [];
  try {
    const valor = fila.modulos_desactivados;
    const arr = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(arr) ? arr.filter(c => CLAVES_VALIDAS.includes(c)) : [];
  } catch {
    return [];
  }
}

// Middleware: bloquea la ruta si el colegio del usuario desactivó ese
// módulo. Si algo falla al consultar, deja pasar — un error de esta
// verificación nunca debe tumbar una funcionalidad que sí está activa.
function permitirModulo(clave) {
  return async function (req, res, next) {
    try {
      const desactivados = await obtenerModulosDesactivados(req.usuario?.colegio_id);
      if (desactivados.includes(clave)) {
        return res.status(403).json({ error: 'Este módulo está desactivado para tu colegio', modulo: clave });
      }
      next();
    } catch (err) {
      console.error('Error al verificar módulo activo:', err.message);
      next();
    }
  };
}

module.exports = { MODULOS_DISPONIBLES, CLAVES_VALIDAS, obtenerModulosDesactivados, permitirModulo };
