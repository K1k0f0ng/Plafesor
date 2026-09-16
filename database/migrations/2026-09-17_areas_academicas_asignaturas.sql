-- ============================================================
-- Migración: Áreas académicas (agrupan las asignaturas, ej. "Matemáticas"
-- agrupa Álgebra, Cálculo, etc.) y enlace de las asignaturas (materias) a
-- su colegio y área. Las materias existentes eran globales (compartidas
-- por todos los colegios); una fila nueva queda ligada a su colegio y
-- opcionalmente a un área, pero las filas antiguas (colegio_id NULL) se
-- dejan como catálogo compartido de solo lectura para no romper
-- asignaciones ya existentes (docente_grupos_materias) de ningún colegio.
-- Ver database/schema.sql y backend/src/utils/areasAcademicas.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS areas_academicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_nombre (colegio_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE materias
  ADD COLUMN IF NOT EXISTS colegio_id INT NULL,
  ADD COLUMN IF NOT EXISTS area_id INT NULL;
