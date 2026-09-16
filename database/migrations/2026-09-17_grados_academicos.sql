-- ============================================================
-- Migración: catálogo de grados académicos por colegio, en reemplazo del
-- ENUM fijo ('5'..'11') que traían grupos.grado y actividades.grado_minimo/
-- grado_maximo. Cada colegio ahora define su propio catálogo (prejardín,
-- jardín, transición, primero..undécimo, o lo que use), con nombre,
-- intensidad horaria y máximos de tareas/evaluaciones configurables.
-- Ver database/schema.sql y backend/src/utils/gradoAcademico.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

ALTER TABLE colegios
  ADD COLUMN IF NOT EXISTS lema VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS grados_academicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  nivel ENUM('prejardin','jardin','transicion','primaria','secundaria','media') NOT NULL,
  programa VARCHAR(100) NULL,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  orden INT NOT NULL,
  intensidad_horaria INT NULL,
  max_tareas INT NULL,
  max_evaluaciones INT NULL,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_codigo (colegio_id, codigo),
  INDEX idx_grados_colegio_orden (colegio_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Los valores ya guardados (ej. '5', '10') se conservan tal cual, solo
-- cambia el tipo de columna de ENUM a texto libre.
ALTER TABLE grupos
  MODIFY COLUMN grado VARCHAR(30) NOT NULL;
ALTER TABLE actividades
  MODIFY COLUMN grado_minimo VARCHAR(30) NOT NULL;
ALTER TABLE actividades
  MODIFY COLUMN grado_maximo VARCHAR(30) NOT NULL;
