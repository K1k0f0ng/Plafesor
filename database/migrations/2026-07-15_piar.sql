-- ============================================================
-- Migración: módulo PIAR (Plan Individual de Ajustes Razonables)
-- Decreto 1421 de 2017. Ver database/schema.sql para el detalle
-- completo de columnas — este archivo solo aplica el cambio a una
-- base de datos que ya existe en producción.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS requiere_piar BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS piar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  anio_escolar INT NOT NULL,

  contexto_estudiante TEXT,
  valoracion_pedagogica TEXT,
  informes_salud TEXT,
  objetivos_metas TEXT,
  ajustes_curriculares TEXT,
  ajustes_didacticos TEXT,
  ajustes_evaluativos TEXT,
  recursos_apoyos TEXT,
  proyectos_especificos TEXT,
  actividades_casa TEXT,
  seguimiento TEXT,

  docente_apoyo_nombre VARCHAR(150),
  docente_apoyo_observaciones TEXT,

  documento_generado TEXT,
  estado ENUM('borrador','activo','en_revision','archivado') NOT NULL DEFAULT 'borrador',
  acta_firmada BOOLEAN DEFAULT FALSE,
  fecha_acta DATE,
  elaborado_por INT,

  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_piar_anio (estudiante_id, anio_escolar),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (elaborado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
