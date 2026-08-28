-- ============================================================
-- Migración: soporte para 4to período académico + porcentaje por
-- período (para calcular la nota "Final" ponderada del año).
-- Ver database/schema.sql para el detalle completo de columnas —
-- este archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

ALTER TABLE actividades
  MODIFY COLUMN periodo ENUM('1','2','3','4') NOT NULL;

ALTER TABLE periodos_academicos
  MODIFY COLUMN numero ENUM('1','2','3','4') NOT NULL;

ALTER TABLE periodos_academicos
  ADD COLUMN IF NOT EXISTS porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0;
