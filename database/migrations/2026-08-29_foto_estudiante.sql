-- ============================================================
-- Migración: foto de perfil para usuarios (inicialmente para
-- estudiantes, en la ficha básica que ven docentes y directivos).
-- Ver database/schema.sql para el detalle completo — este archivo
-- solo aplica el cambio a una base de datos que ya existe en producción.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(255) NULL;
