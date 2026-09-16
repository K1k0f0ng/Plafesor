-- ============================================================
-- Corrección: la migración database/migrations/2026-08-31_datos_simat_estudiante.sql
-- quedó documentada pero nunca se aplicó en producción (se iba a correr a
-- mano y quedó pendiente) — esto causaba un error 500 real al listar
-- estudiantes ("Unknown column 'ed.codigo_matricula'"), detectado en
-- pruebas en vivo el 2026-09-17.
--
-- A partir de ahora estas columnas se aplican solas: se agregaron a
-- agregarColumnaSiFalta en backend/src/database.js, así que este archivo es
-- solo el registro — no hace falta correrlo a mano si el backend ya se
-- reinició con el database.js actualizado.
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
