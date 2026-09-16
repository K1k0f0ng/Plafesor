const { CARGOS_DISPONIBLES } = require('./cargos');

// Catálogo fijo de categorías visuales de la agenda institucional (igual a
// la referencia: Culturales, Deportivos, Extraclase, Integración,
// Académicos, Recreación, Pastoral).
const CATEGORIAS_EVENTO = [
  { clave: 'cultural',    nombre: 'Culturales' },
  { clave: 'deportivo',   nombre: 'Deportivos' },
  { clave: 'extraclase',  nombre: 'Extraclase' },
  { clave: 'integracion', nombre: 'Integración' },
  { clave: 'academico',   nombre: 'Académicos' },
  { clave: 'recreacion',  nombre: 'Recreación' },
  { clave: 'pastoral',    nombre: 'Pastoral' },
];
const CATEGORIAS_VALIDAS = CATEGORIAS_EVENTO.map(c => c.clave);

// Roles/cargos del colegio a los que se le puede dirigir un evento.
// Los primeros 5 son roles reales de permisos (usuarios.rol). Los cargos
// (Rector, Coordinador Académico, etc.) se guardan en usuarios.cargo sobre
// una cuenta 'admin' o 'director' — el emparejamiento de audiencia revisa
// ambos campos (ver eventoController.listar).
const ROLES_EVENTO = [
  { clave: 'admin',      nombre: 'Administrador' },
  { clave: 'director',   nombre: 'Director' },
  { clave: 'docente',    nombre: 'Profesor' },
  { clave: 'estudiante', nombre: 'Estudiante' },
  { clave: 'padre',      nombre: 'Acudiente/Padre' },
  ...CARGOS_DISPONIBLES,
];
const ROLES_VALIDOS = ROLES_EVENTO.map(r => r.clave);

module.exports = { CATEGORIAS_EVENTO, CATEGORIAS_VALIDAS, ROLES_EVENTO, ROLES_VALIDOS };
