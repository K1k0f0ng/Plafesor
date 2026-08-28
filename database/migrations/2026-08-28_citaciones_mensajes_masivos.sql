-- Citación individual a acudientes (por director de colegio o de grupo) y
-- mensajes masivos por WhatsApp (reuniones de padres, comunicados, etc.).
-- Ver database/schema.sql para la documentación completa de cada tabla.

CREATE TABLE IF NOT EXISTS citaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  citado_por INT NOT NULL,
  motivo TEXT NOT NULL,
  fecha_cita DATE NULL,
  hora_cita TIME NULL,
  lugar VARCHAR(150) NULL,
  estado ENUM('pendiente','realizada','cancelada') NOT NULL DEFAULT 'pendiente',
  whatsapp_enviado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (citado_por) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_citaciones_estudiante (estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mensajes_masivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  enviado_por INT NOT NULL,
  alcance ENUM('grupo','grado','colegio') NOT NULL,
  grupo_id INT NULL,
  grado VARCHAR(10) NULL,
  asunto VARCHAR(150) NOT NULL,
  mensaje TEXT NOT NULL,
  total_destinatarios INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_fallidos INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (enviado_por) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
