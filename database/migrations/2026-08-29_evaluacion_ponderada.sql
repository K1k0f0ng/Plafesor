-- Calificación ponderada por porcentajes + componentes de autoevaluación,
-- coevaluación y heteroevaluación.
--
-- Fórmula de la nota final de una materia en un período:
--   nota_final = (promedio ponderado de actividades × 0.80)
--              + (autoevaluación × 0.05) + (coevaluación × 0.05) + (heteroevaluación × 0.10)
-- El promedio ponderado de actividades solo se calcula si los porcentajes de
-- las actividades del período suman exactamente 100%; si no, la materia queda
-- pendiente (igual criterio que la nota "Final" por períodos ya existente).

ALTER TABLE actividades
  ADD COLUMN porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER periodo,
  ADD COLUMN fecha_inicio DATE NULL AFTER porcentaje,
  ADD COLUMN fecha_cierre DATE NULL AFTER fecha_inicio;

-- Actividades ya existentes no tienen porcentaje asignado — para no romper
-- las notas ya calculadas, se reparte 100% en partes iguales entre las
-- actividades de cada (grupo, materia, período), igual criterio de peso
-- igualitario que ya tenían bajo la fórmula anterior ("regla de tres").
UPDATE actividades a
JOIN (
  SELECT grupo_id, materia_id, periodo, COUNT(*) AS total
  FROM actividades
  GROUP BY grupo_id, materia_id, periodo
) g ON g.grupo_id = a.grupo_id AND g.materia_id = a.materia_id AND g.periodo = a.periodo
SET a.porcentaje = ROUND(100 / g.total, 2)
WHERE a.porcentaje = 0;

-- ============================================================
-- TABLA: componentes_evaluacion
-- Autoevaluación / coevaluación / heteroevaluación — una nota manual por
-- estudiante, materia, grupo y período (no son "actividades", son casillas
-- fijas del libro de notas que el docente diligencia directamente).
-- ============================================================
CREATE TABLE IF NOT EXISTS componentes_evaluacion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  materia_id INT NOT NULL,
  grupo_id INT NOT NULL,
  periodo ENUM('1','2','3','4') NOT NULL,
  tipo ENUM('autoevaluacion','coevaluacion','heteroevaluacion') NOT NULL,
  nota DECIMAL(3,1) NOT NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_componente (estudiante_id, materia_id, grupo_id, periodo, tipo),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
