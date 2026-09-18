-- ============================================================
-- Migración: un administrador puede tener acceso a varios colegios y
-- cambiar entre ellos desde "Mi institución". usuarios.colegio_id sigue
-- siendo el colegio ACTIVO (el que usa el token y todos los módulos);
-- esta tabla solo guarda a qué otros colegios puede cambiarse.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuario_colegios (
  usuario_id INT NOT NULL,
  colegio_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, colegio_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
