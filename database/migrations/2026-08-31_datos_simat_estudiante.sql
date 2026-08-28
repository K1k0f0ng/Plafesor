-- ============================================================
-- Migración: campos adicionales de matrícula/SIMAT en `estudiantes_datos`
-- (código de matrícula, lugar de expedición del documento, ubicación
-- detallada, contacto propio del estudiante, procedencia escolar).
-- Ver database/schema.sql para el detalle completo — este archivo
-- solo aplica el cambio a una base de datos que ya existe en producción.
-- ============================================================

ALTER TABLE estudiantes_datos
  ADD COLUMN IF NOT EXISTS codigo_matricula VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS lugar_expedicion_documento VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS barrio VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS comuna VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS celular VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS estudiante_nuevo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS colegio_procedencia VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS anio_procedencia VARCHAR(20) NULL;
