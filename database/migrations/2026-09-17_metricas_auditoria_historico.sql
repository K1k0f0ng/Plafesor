-- ============================================================
-- Migración: métricas mensuales del colegio (comparativos "↑ vs. mes
-- anterior"), bitácora de auditoría institucional, notas históricas
-- importadas de un sistema anterior, y años lectivos como entidad propia
-- (para poder cerrar un año y promover estudiantes).
-- Ver database/schema.sql para el detalle completo.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS colegio_metricas_mensuales (
  colegio_id INT NOT NULL,
  mes CHAR(7) NOT NULL,
  total_grupos INT NOT NULL DEFAULT 0,
  total_estudiantes INT NOT NULL DEFAULT 0,
  total_actividades INT NOT NULL DEFAULT 0,
  promedio DECIMAL(3,1) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (colegio_id, mes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  usuario_id INT NULL,
  usuario_nombre VARCHAR(150) NULL,
  usuario_rol VARCHAR(20) NULL,
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(60) NOT NULL,
  entidad_id INT NULL,
  detalle TEXT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auditoria_colegio_fecha (colegio_id, creado_en),
  INDEX idx_auditoria_entidad (entidad, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calificaciones_historicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  ano_lectivo INT NOT NULL,
  periodo TINYINT NOT NULL,
  materia_nombre VARCHAR(120) NOT NULL,
  nota DECIMAL(2,1) NOT NULL,
  importado_por INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hist_estudiante (estudiante_id, ano_lectivo, periodo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anios_lectivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  anio INT NOT NULL,
  estado ENUM('activo', 'cerrado') NOT NULL DEFAULT 'activo',
  cerrado_en TIMESTAMP NULL,
  cerrado_por INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_anio (colegio_id, anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
