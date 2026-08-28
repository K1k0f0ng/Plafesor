-- ============================================================
-- Migración: formulario de matrícula del estudiante (identificación,
-- datos demográficos, poblacionales y del acudiente).
-- Ver database/schema.sql para el detalle completo de columnas —
-- este archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tipo_documento ENUM('RC','TI','CC','CE') NULL,
  ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(30) NULL;

CREATE TABLE IF NOT EXISTS estudiantes_datos (
  estudiante_id INT PRIMARY KEY,
  fecha_nacimiento DATE NULL,
  lugar_nacimiento VARCHAR(150),
  genero ENUM('M','F','Otro') NULL,
  grupo_sanguineo VARCHAR(5),
  direccion VARCHAR(255),
  eps_sisben VARCHAR(150),
  discapacidad VARCHAR(255),
  grupo_etnico VARCHAR(150),
  victima_conflicto BOOLEAN DEFAULT FALSE,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE padre_estudiante
  ADD COLUMN IF NOT EXISTS parentesco VARCHAR(50) NULL;
