// Debe coincidir con backend/src/utils/cargos.js
export const CARGOS_DISPONIBLES = [
  { clave: 'directivo',                   nombre: 'Directivo' },
  { clave: 'usuario_invitado',            nombre: 'Usuario Invitado' },
  { clave: 'rector',                      nombre: 'Rector' },
  { clave: 'exalumno',                    nombre: 'Exalumno' },
  { clave: 'admin_pagos_cartera',         nombre: 'Administrador de Pagos y Cartera' },
  { clave: 'coordinador_academico',       nombre: 'Coordinador Académico' },
  { clave: 'personal_administrativo',     nombre: 'Personal Administrativo' },
  { clave: 'admin_academico',             nombre: 'Administrador Académico' },
  { clave: 'director_area',               nombre: 'Director de Área' },
  { clave: 'director_curso',              nombre: 'Director de Curso' },
  { clave: 'secretario_academico',        nombre: 'Secretario Académico' },
  { clave: 'coordinador_convivencia',     nombre: 'Coordinador Convivencia' },
  { clave: 'admin_admisiones_matriculas', nombre: 'Administrador de Admisiones y Matrículas' },
];

export function nombreCargo(clave) {
  return CARGOS_DISPONIBLES.find(c => c.clave === clave)?.nombre || clave;
}
