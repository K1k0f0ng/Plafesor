-- ============================================================
-- Migración: pénsum — qué asignaturas se dictan en cada grado del colegio.
-- El grado se identifica por su código (grados_academicos.codigo), igual
-- que ya hace grupos.grado, así no se duplica la relación con una llave
-- distinta.
-- Ver database/schema.sql y backend/src/controllers/gradoMateriaController.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS grado_materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  grado_codigo VARCHAR(20) NOT NULL,
  materia_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_colegio_grado_materia (colegio_id, grado_codigo, materia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
