-- ============================================================
-- Migración: resumen ejecutivo diario ("dashboard que habla")
-- Ver database/schema.sql para el detalle completo — este
-- archivo solo aplica el cambio a una base de datos que ya
-- existe en producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS briefing_diario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  fecha DATE NOT NULL,
  texto TEXT,
  estudiantes_riesgo_critico INT DEFAULT 0,
  grupo_alerta VARCHAR(150),
  dias_cierre_periodo INT,
  generado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_briefing_dia (colegio_id, fecha),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
