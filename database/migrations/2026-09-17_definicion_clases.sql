-- ============================================================
-- Migración: Definición de Clases — intensidad horaria semanal de cada
-- asignación docente+grupo+materia, para saber cuántas horas a la semana
-- se dicta esa clase (no reemplaza el horario real, solo la carga planeada).
-- Ver database/schema.sql y backend/src/controllers/docenteController.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

ALTER TABLE docente_grupos_materias
  ADD COLUMN IF NOT EXISTS intensidad_horaria_semanal INT NULL;
