-- ============================================================
-- Migración: Agenda Institucional — eventos generales que ve todo el
-- colegio (o solo los roles/grados a los que van dirigidos), alimentados
-- por el director o quien se designe, no por cada docente individualmente.
-- Un evento puede tener varias fechas (ej. "Crazy Week" toda una semana),
-- cada una con su propio horario y lugar.
-- Ver database/schema.sql y backend/src/controllers/eventoController.js.
-- Este archivo solo aplica el cambio a una base de datos que ya existe en
-- producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS eventos_institucionales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  categoria VARCHAR(30) NOT NULL,
  detalle TEXT NULL,
  dirigido_roles JSON NULL,
  dirigido_grados JSON NULL,
  creado_por INT NULL,
  creado_por_nombre VARCHAR(150) NULL,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eventos_colegio (colegio_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS eventos_institucionales_fechas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evento_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NULL,
  hora_fin TIME NULL,
  lugar VARCHAR(150) NULL,
  INDEX idx_eventos_fechas_evento (evento_id),
  INDEX idx_eventos_fechas_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
