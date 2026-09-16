-- ============================================================
-- Migración: Semana Académica (qué días de la semana dicta clase el
-- colegio y cómo se llaman — por defecto lunes a viernes activos, sábado y
-- domingo creados pero inactivos) y Salones de Clase (catálogo de espacios
-- físicos, con "permite clases simultáneas" para algo como una cancha).
-- Ver database/schema.sql, backend/src/utils/semanaAcademica.js y
-- backend/src/utils/salones.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS semana_academica (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  dia_numero TINYINT NOT NULL,
  nombre VARCHAR(30) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY unique_colegio_dia (colegio_id, dia_numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS salones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  permite_clases_simultaneas BOOLEAN NOT NULL DEFAULT FALSE,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_nombre (colegio_id, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE horarios
  ADD COLUMN IF NOT EXISTS salon_id INT NULL;
