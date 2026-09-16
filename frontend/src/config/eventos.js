import { CARGOS_DISPONIBLES } from './cargos';

// Debe coincidir con backend/src/utils/eventos.js
export const CATEGORIAS_EVENTO = [
  { clave: 'cultural',    nombre: 'Culturales' },
  { clave: 'deportivo',   nombre: 'Deportivos' },
  { clave: 'extraclase',  nombre: 'Extraclase' },
  { clave: 'integracion', nombre: 'Integración' },
  { clave: 'academico',   nombre: 'Académicos' },
  { clave: 'recreacion',  nombre: 'Recreación' },
  { clave: 'pastoral',    nombre: 'Pastoral' },
];

export const CATEGORIA_COLOR = {
  cultural:    '#8e24aa',
  deportivo:   '#e53935',
  extraclase:  '#fb8c00',
  integracion: '#43a047',
  academico:   '#3949ab',
  recreacion:  '#00acc1',
  pastoral:    '#6d4c41',
};

// Los primeros 5 son roles reales de permisos (existen como cuenta/login).
// Los cargos (Rector, Coordinador Académico, etc.) viven sobre una cuenta
// 'admin' o 'director' — ver frontend/src/config/cargos.js y
// backend/src/controllers/eventoController.js (empareja por rol o por cargo).
export const ROLES_EVENTO = [
  { clave: 'admin',      nombre: 'Administrador' },
  { clave: 'director',   nombre: 'Director' },
  { clave: 'docente',    nombre: 'Profesor' },
  { clave: 'estudiante', nombre: 'Estudiante' },
  { clave: 'padre',      nombre: 'Acudiente/Padre' },
  ...CARGOS_DISPONIBLES,
];

export function nombreCategoria(clave) {
  return CATEGORIAS_EVENTO.find(c => c.clave === clave)?.nombre || clave;
}
