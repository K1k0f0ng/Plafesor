-- ============================================================
-- Migración: mensajería interna bidireccional (colegio ↔ padres),
-- estilo bandeja de correo (bandeja de entrada, enviados, archivados,
-- eliminados, borradores), con hilos de respuesta y adjuntos.
-- Ver database/schema.sql para el detalle completo — este archivo
-- solo aplica el cambio a una base de datos que ya existe en producción.
-- ============================================================

CREATE TABLE IF NOT EXISTS mensajes_internos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  remitente_id INT NOT NULL,
  -- Raíz del hilo (NULL si este mensaje ES la raíz)
  hilo_id INT NULL,
  -- Mensaje inmediato al que responde (NULL si es un mensaje nuevo)
  responde_a_id INT NULL,
  asunto VARCHAR(200) NOT NULL,
  cuerpo TEXT NOT NULL,
  estado ENUM('borrador','enviado') NOT NULL DEFAULT 'enviado',
  -- Destinatarios elegidos para un borrador todavía no enviado (array de ids)
  destinatarios_borrador JSON NULL,
  -- Copia del remitente eliminada de su carpeta "Enviados"
  remitente_eliminado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (hilo_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL,
  FOREIGN KEY (responde_a_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un registro por cada destinatario de un mensaje enviado — guarda su
-- estado de lectura y en qué carpeta lo tiene (independiente para cada uno)
CREATE TABLE IF NOT EXISTS mensajes_destinatarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mensaje_id INT NOT NULL,
  destinatario_id INT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  leido_en TIMESTAMP NULL,
  carpeta ENUM('bandeja_entrada','archivado','eliminado') NOT NULL DEFAULT 'bandeja_entrada',
  UNIQUE KEY unique_mensaje_destinatario (mensaje_id, destinatario_id),
  FOREIGN KEY (mensaje_id) REFERENCES mensajes_internos(id) ON DELETE CASCADE,
  FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mensajes_adjuntos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mensaje_id INT NOT NULL,
  archivo_url VARCHAR(255) NOT NULL,
  archivo_nombre_original VARCHAR(255) NOT NULL,
  FOREIGN KEY (mensaje_id) REFERENCES mensajes_internos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
