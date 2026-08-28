-- ============================================================
-- Migración: observaciones de período (sección del boletín).
-- Ver database/schema.sql para el detalle completo de columnas —
-- este archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS observaciones_periodo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  periodo ENUM('1','2','3','4','final') NOT NULL,
  texto TEXT NOT NULL,
  docente_id INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_obs_periodo (estudiante_id, periodo),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
