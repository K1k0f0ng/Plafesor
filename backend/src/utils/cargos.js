// Catálogo de cargos administrativos/directivos — la misma lista que se usa
// para "Dirigido a" en la Agenda Institucional, ahora también seleccionable
// al crear un usuario del sistema (personal). No son roles de permisos: el
// permiso real lo da usuarios.rol ('admin' o 'director'); el cargo es solo
// el título del puesto (Rector, Coordinador Académico, etc.).
const CARGOS_DISPONIBLES = [
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
const CARGOS_VALIDOS = CARGOS_DISPONIBLES.map(c => c.clave);

module.exports = { CARGOS_DISPONIBLES, CARGOS_VALIDOS };
