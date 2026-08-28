-- ============================================================
-- Migración: campo "director de grupo" para docentes.
-- Ver database/schema.sql para el detalle completo de columnas —
-- este archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS grupo_dirigido_id INT NULL;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_grupo_dirigido FOREIGN KEY (grupo_dirigido_id) REFERENCES grupos(id) ON DELETE SET NULL;

ALTER TABLE usuarios
  ADD CONSTRAINT unique_director_grupo UNIQUE (grupo_dirigido_id);
