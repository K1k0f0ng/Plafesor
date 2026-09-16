-- ============================================================
-- Migración: administración de módulos del portal — cada colegio puede
-- apagar módulos opcionales (Copiloto IA, PIAR, etc.) que no usa. NULL o
-- vacío = todo activado, igual que antes de este cambio.
-- Ver backend/src/utils/modulos.js para el catálogo completo de claves.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

ALTER TABLE colegios
  ADD COLUMN IF NOT EXISTS modulos_desactivados JSON NULL;
