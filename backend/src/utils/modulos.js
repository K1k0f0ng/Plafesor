const db = require('../database');

// Catálogo de módulos que se pueden apagar. Los primeros son funcionalidades
// de valor agregado (se apagan a nivel de todo el colegio, desde "Módulos
// del Portal"); los últimos son pantallas de back-office administrativo que
// además se pueden apagar por persona individual (desde "Usuarios del
// Sistema"), para diferenciar el acceso real de cada cargo sin crear un rol
// de permisos nuevo. Las pantallas centrales (Estudiantes, Colegios, Personal)
// nunca están aquí — siempre visibles para admin/director.
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
  { clave: 'auditoria',            nombre: 'Auditoría' },
  { clave: 'boletines',            nombre: 'Boletines' },
  { clave: 'institucion_academica',nombre: 'Institución Académica (Grados, Grupos, Semana Académica, Salones)' },
  { clave: 'asignaturas',          nombre: 'Asignaturas (Áreas, Materias, Carga Académica)' },
  { clave: 'cargue_historico',     nombre: 'Cargue de Histórico' },
  { clave: 'cierre_anio_lectivo',  nombre: 'Cierre de Año Lectivo' },
];

// Los que un colegio puede apagar para sí mismo desde "Módulos del Portal".
// Las pantallas de back-office (auditoria, boletines, institucion_academica,
// asignaturas, cargue_historico, cierre_anio_lectivo) solo se restringen por
// persona, no para el colegio completo — un colegio no debería poder
// apagarse a sí mismo la auditoría o el cierre de año.
const CLAVES_COLEGIO = MODULOS_DISPONIBLES
  .map(m => m.clave)
  .filter(c => !['auditoria', 'boletines', 'institucion_academica', 'asignaturas', 'cargue_historico', 'cierre_anio_lectivo'].includes(c));

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

async function obtenerModulosDesactivadosUsuario(usuario_id) {
  if (!usuario_id) return [];
  const [[fila]] = await db.query('SELECT modulos_desactivados FROM usuarios WHERE id = ?', [usuario_id]);
  if (!fila || !fila.modulos_desactivados) return [];
  try {
    const valor = fila.modulos_desactivados;
    const arr = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(arr) ? arr.filter(c => CLAVES_VALIDAS.includes(c)) : [];
  } catch {
    return [];
  }
}

// Unión de lo desactivado para todo el colegio + lo desactivado solo para
// este usuario en particular — cualquiera de los dos basta para bloquear.
async function obtenerModulosDesactivadosPara(req_usuario) {
  const [delColegio, delUsuario] = await Promise.all([
    obtenerModulosDesactivados(req_usuario?.colegio_id),
    obtenerModulosDesactivadosUsuario(req_usuario?.id),
  ]);
  return Array.from(new Set([...delColegio, ...delUsuario]));
}

// Middleware: bloquea la ruta si el colegio o el usuario desactivaron ese
// módulo. Si algo falla al consultar, deja pasar — un error de esta
// verificación nunca debe tumbar una funcionalidad que sí está activa.
function permitirModulo(clave) {
  return async function (req, res, next) {
    try {
      const desactivados = await obtenerModulosDesactivadosPara(req.usuario);
      if (desactivados.includes(clave)) {
        return res.status(403).json({ error: 'Este módulo está desactivado para tu cuenta', modulo: clave });
      }
      next();
    } catch (err) {
      console.error('Error al verificar módulo activo:', err.message);
      next();
    }
  };
}

module.exports = {
  MODULOS_DISPONIBLES, CLAVES_VALIDAS, CLAVES_COLEGIO,
  obtenerModulosDesactivados, obtenerModulosDesactivadosUsuario, obtenerModulosDesactivadosPara,
  permitirModulo,
};
