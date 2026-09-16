-- ============================================================
-- Migración: rotación de contraseña — cada colegio decide cada cuántos días
-- debe cambiarla su personal (NULL = desactivada). password_actualizada_en
-- usa DEFAULT CURRENT_TIMESTAMP para que toda cuenta nueva arranque "al
-- día"; el UPDATE de abajo pone al día las cuentas que ya existían antes de
-- esta columna.
-- Ver database/schema.sql.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

ALTER TABLE colegios
  ADD COLUMN IF NOT EXISTS dias_rotacion_password INT NULL;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS password_actualizada_en DATETIME NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE usuarios SET password_actualizada_en = NOW() WHERE password_actualizada_en IS NULL;
