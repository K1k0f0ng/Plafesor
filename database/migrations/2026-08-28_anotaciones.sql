-- ============================================================
-- Migración: anotaciones (observador del estudiante).
-- Ver database/schema.sql para el detalle completo de columnas —
-- este archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS anotaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  docente_id INT NOT NULL,
  grupo_id INT NOT NULL,
  tipo ENUM('positiva','mejora','neutral') NOT NULL DEFAULT 'neutral',
  texto TEXT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  INDEX idx_anotaciones_estudiante (estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
