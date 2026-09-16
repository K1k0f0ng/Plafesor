-- ============================================================
-- Migración: catálogo de motivos de retiro por colegio (traslado,
-- económico, disciplinario, etc.) en vez de texto libre, más los campos en
-- usuarios para registrar el retiro de un estudiante.
-- Ver database/schema.sql.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS motivos_retiro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_nombre (colegio_id, nombre),
  INDEX idx_motivos_retiro_colegio (colegio_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS motivo_retiro_id INT NULL,
  ADD COLUMN IF NOT EXISTS motivo_retiro_detalle VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS retirado_en DATETIME NULL;
