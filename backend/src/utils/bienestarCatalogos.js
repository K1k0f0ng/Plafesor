const db = require('../database');

// Valores iniciales de los catálogos del módulo Bienestar. Se cargan una sola
// vez por colegio (la primera vez que el admin guarda la configuración); luego
// el colegio los edita, desactiva o agrega los suyos. Los motivos describen
// SITUACIONES OBSERVABLES, nunca condiciones clínicas.
const CATALOGOS_INICIALES = {
  motivo_remision: [
    'Cambios en el rendimiento académico',
    'Inasistencia o retardos frecuentes',
    'Dificultades de convivencia',
    'Cambios observados en el comportamiento o el estado de ánimo',
    'Dificultades en la relación con compañeros',
    'Situación familiar que afecta el proceso escolar',
    'Solicitud del estudiante',
    'Solicitud de la familia',
    'Orientación vocacional',
    'Otro',
  ],
  tipo_seguimiento: [
    'Valoración inicial',
    'Sesión con el estudiante',
    'Reunión con la familia',
    'Reunión con docentes',
    'Seguimiento telefónico',
    'Observación en aula',
    'Otro',
  ],
  tipo_cita: [
    'Cita con estudiante',
    'Reunión con familia',
    'Reunión con docentes',
    'Seguimiento',
  ],
  tipo_contacto: [
    'Llamada',
    'Reunión',
    'Mensaje',
    'Correo',
    'Citación',
    'Seguimiento',
  ],
  motivo_cierre: [
    'Objetivos cumplidos',
    'Remitido a entidad externa',
    'Retiro del estudiante',
    'Sin continuidad de la familia',
    'Otro',
  ],
};

const TIPOS_CATALOGO = Object.keys(CATALOGOS_INICIALES);

// INSERT IGNORE + UNIQUE (colegio_id, tipo, nombre): repetirlo no duplica nada
// ni revive un valor que el colegio haya desactivado.
async function sembrarCatalogos(colegio_id, conn = db) {
  const filas = [];
  for (const tipo of TIPOS_CATALOGO) {
    CATALOGOS_INICIALES[tipo].forEach((nombre, i) => filas.push([colegio_id, tipo, nombre, i + 1]));
  }
  await conn.query('INSERT IGNORE INTO bienestar_catalogos (colegio_id, tipo, nombre, orden) VALUES ?', [filas]);
}

module.exports = { CATALOGOS_INICIALES, TIPOS_CATALOGO, sembrarCatalogos };
