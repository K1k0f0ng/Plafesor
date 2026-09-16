-- ============================================================
-- Migración: documentos de soporte del PIAR (diagnósticos, valoraciones,
-- certificados) — se guardan fuera de /uploads (carpeta privada) porque
-- son datos sensibles de salud; solo se sirven por el endpoint protegido
-- de descarga. La IA los usa como evidencia real al redactar el borrador.
-- Ver database/schema.sql y backend/src/controllers/piarController.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS piar_documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  colegio_id INT NOT NULL,
  archivo_url VARCHAR(255) NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NULL,
  subido_por INT NULL,
  subido_por_nombre VARCHAR(150) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_piar_documentos_estudiante (estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
