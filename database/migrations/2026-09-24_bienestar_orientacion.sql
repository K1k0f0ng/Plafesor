-- ============================================================
-- Migración: módulo Bienestar y Orientación (Fase 2 — base).
-- Diseño completo en docs/BIENESTAR_MAPA_FUNCIONAL.md.
--
-- Solo AGREGA: el valor 'orientador' al rol de usuarios y tablas nuevas con
-- prefijo bienestar_. No modifica ni borra datos existentes.
--
-- Las columnas marcadas "cifrado" guardan texto cifrado con AES-256-GCM por
-- el backend (backend/src/utils/cifrado.js) — nunca texto plano. Por eso son
-- TEXT y no se puede buscar por su contenido.
-- ============================================================

ALTER TABLE usuarios
  MODIFY rol ENUM('admin','docente','estudiante','director','padre','orientador') NOT NULL;

-- Configuración del módulo por colegio. Sin fila = módulo apagado.
CREATE TABLE IF NOT EXISTS bienestar_configuracion (
  colegio_id INT PRIMARY KEY,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  remiten ENUM('todos','directores_grupo') NOT NULL DEFAULT 'todos',
  devolucion_docente BOOLEAN NOT NULL DEFAULT FALSE,
  lider_lee_privadas BOOLEAN NOT NULL DEFAULT FALSE,
  portal_familia BOOLEAN NOT NULL DEFAULT FALSE,
  adjuntos_remision BOOLEAN NOT NULL DEFAULT FALSE,
  ia_activa BOOLEAN NOT NULL DEFAULT FALSE,
  umbrales JSON NULL,
  actualizado_por INT NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogos configurables por colegio (motivos, tipos de seguimiento, etc.)
CREATE TABLE IF NOT EXISTS bienestar_catalogos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  tipo ENUM('motivo_remision','tipo_seguimiento','tipo_cita','tipo_contacto','motivo_cierre') NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_catalogo (colegio_id, tipo, nombre),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Equipo de orientación del colegio
CREATE TABLE IF NOT EXISTS bienestar_equipo (
  usuario_id INT NOT NULL,
  colegio_id INT NOT NULL,
  nivel ENUM('lider','profesional') NOT NULL DEFAULT 'profesional',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, colegio_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_casos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  responsable_id INT NULL,
  prioridad ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  estado ENUM('abierto','en_seguimiento','cerrado','archivado') NOT NULL DEFAULT 'abierto',
  motivo_id INT NULL,
  motivo_detalle TEXT NULL,            -- cifrado
  antecedentes TEXT NULL,              -- cifrado
  abierto_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cerrado_en TIMESTAMP NULL,
  motivo_cierre_id INT NULL,
  cierre_detalle TEXT NULL,            -- cifrado
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bcasos_colegio_estado (colegio_id, estado),
  INDEX idx_bcasos_estudiante (estudiante_id),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (motivo_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL,
  FOREIGN KEY (motivo_cierre_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_remisiones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  grupo_id INT NULL,
  remitente_id INT NULL,
  motivo_id INT NULL,
  descripcion TEXT NULL,               -- cifrado
  observaciones TEXT NULL,             -- cifrado
  prioridad ENUM('baja','media','alta','urgente') NOT NULL DEFAULT 'media',
  familia_informada BOOLEAN NULL,
  estado ENUM('pendiente','recibida','en_revision','en_seguimiento','cerrada','archivada') NOT NULL DEFAULT 'pendiente',
  origen ENUM('docente','senal') NOT NULL DEFAULT 'docente',
  caso_id INT NULL,
  recibida_por INT NULL,
  recibida_en TIMESTAMP NULL,
  devolucion TEXT NULL,                -- cifrado
  motivo_archivo TEXT NULL,            -- cifrado (por qué orientación la archivó sin abrir caso)
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bremisiones_colegio_estado (colegio_id, estado),
  INDEX idx_bremisiones_remitente (remitente_id),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE SET NULL,
  FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (motivo_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL,
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE SET NULL,
  FOREIGN KEY (recibida_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Adjuntos de remisiones y de casos. El archivo se guarda CIFRADO en
-- backend/storage/bienestar/ (nunca en /uploads, que es público); aquí solo
-- queda la referencia. nombre_original va cifrado porque puede ser revelador.
CREATE TABLE IF NOT EXISTS bienestar_adjuntos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  remision_id INT NULL,
  caso_id INT NULL,
  archivo_ruta VARCHAR(255) NOT NULL,
  nombre_original TEXT NOT NULL,       -- cifrado
  tipo_mime VARCHAR(100) NOT NULL,
  tamano INT NOT NULL,
  subido_por INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_badj_caso (caso_id),
  INDEX idx_badj_remision (remision_id),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (subido_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historial de responsables de cada caso
CREATE TABLE IF NOT EXISTS bienestar_caso_asignaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caso_id INT NOT NULL,
  usuario_id INT NOT NULL,
  desde TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hasta TIMESTAMP NULL,
  asignado_por INT NULL,
  INDEX idx_basig_usuario (usuario_id, hasta),
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seguimientos (incluye las sesiones: un solo registro con tipo)
CREATE TABLE IF NOT EXISTS bienestar_seguimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caso_id INT NOT NULL,
  colegio_id INT NOT NULL,
  autor_id INT NULL,
  fecha DATETIME NOT NULL,
  tipo_id INT NULL,
  participantes JSON NULL,
  motivo TEXT NULL,                    -- cifrado
  resumen TEXT NULL,                   -- cifrado
  acuerdos TEXT NULL,                  -- cifrado
  proxima_accion TEXT NULL,            -- cifrado
  proxima_fecha DATE NULL,
  nota_privada TEXT NULL,              -- cifrado, acceso restringido
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bseg_caso_fecha (caso_id, fecha),
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (tipo_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_planes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caso_id INT NOT NULL,
  objetivo TEXT NULL,                  -- cifrado
  situacion TEXT NULL,                 -- cifrado
  indicadores TEXT NULL,               -- cifrado
  fecha_inicio DATE NULL,
  fecha_objetivo DATE NULL,
  estado ENUM('activo','en_seguimiento','cumplido','cerrado','suspendido') NOT NULL DEFAULT 'activo',
  creado_por INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE CASCADE,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_plan_acciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL,
  accion TEXT NULL,                    -- cifrado
  responsable VARCHAR(120) NULL,
  fecha DATE NULL,
  estado ENUM('pendiente','en_curso','cumplida','cancelada') NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES bienestar_planes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_compromisos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caso_id INT NOT NULL,
  seguimiento_id INT NULL,
  plan_id INT NULL,
  descripcion TEXT NULL,               -- cifrado
  responsable_tipo ENUM('estudiante','familia','docente','orientacion','otro') NOT NULL DEFAULT 'estudiante',
  fecha_limite DATE NULL,
  estado ENUM('pendiente','cumplido','incumplido','cancelado') NOT NULL DEFAULT 'pendiente',
  visible_familia BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bcomp_caso_estado (caso_id, estado),
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE CASCADE,
  FOREIGN KEY (seguimiento_id) REFERENCES bienestar_seguimientos(id) ON DELETE SET NULL,
  FOREIGN KEY (plan_id) REFERENCES bienestar_planes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agenda propia de orientación (no usa la Agenda Institucional, que es visible por rol)
CREATE TABLE IF NOT EXISTS bienestar_citas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  caso_id INT NULL,
  estudiante_id INT NULL,
  profesional_id INT NULL,
  tipo_id INT NULL,
  inicio DATETIME NOT NULL,
  fin DATETIME NULL,
  lugar VARCHAR(150) NULL,
  participantes JSON NULL,
  estado ENUM('programada','realizada','no_asistio','cancelada','reprogramada') NOT NULL DEFAULT 'programada',
  asistencia ENUM('asistio','no_asistio','llego_tarde') NULL,
  reprogramada_de INT NULL,
  motivo_cancelacion TEXT NULL,        -- cifrado
  visible_familia BOOLEAN NOT NULL DEFAULT FALSE,
  seguimiento_id INT NULL,
  creado_por INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bcitas_profesional_inicio (profesional_id, inicio),
  INDEX idx_bcitas_colegio_inicio (colegio_id, inicio),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE SET NULL,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (profesional_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (tipo_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL,
  FOREIGN KEY (reprogramada_de) REFERENCES bienestar_citas(id) ON DELETE SET NULL,
  FOREIGN KEY (seguimiento_id) REFERENCES bienestar_seguimientos(id) ON DELETE SET NULL,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bienestar_contactos_familia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  caso_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  acudiente_id INT NULL,
  acudiente_texto VARCHAR(150) NULL,
  tipo_id INT NULL,
  fecha DATETIME NOT NULL,
  responsable_id INT NULL,
  motivo TEXT NULL,                    -- cifrado
  resultado TEXT NULL,                 -- cifrado
  visible_familia BOOLEAN NOT NULL DEFAULT FALSE,
  citacion_id INT NULL,
  mensaje_id INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caso_id) REFERENCES bienestar_casos(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (acudiente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (tipo_id) REFERENCES bienestar_catalogos(id) ON DELETE SET NULL,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (citacion_id) REFERENCES citaciones(id) ON DELETE SET NULL,
  FOREIGN KEY (mensaje_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Señales tempranas: solo códigos y números, nunca interpretación
CREATE TABLE IF NOT EXISTS bienestar_senales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  tipos JSON NOT NULL,
  estado ENUM('nueva','revisada','descartada','remitida') NOT NULL DEFAULT 'nueva',
  revisada_por INT NULL,
  motivo_descarte TEXT NULL,           -- cifrado
  detectada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  silenciada_hasta DATE NULL,
  INDEX idx_bsen_colegio_estado (colegio_id, estado),
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (revisada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bitácora del módulo: quién hizo qué y cuándo. NUNCA guarda contenido.
CREATE TABLE IF NOT EXISTS bienestar_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  usuario_id INT NULL,
  usuario_rol VARCHAR(20) NULL,
  accion VARCHAR(60) NOT NULL,
  recurso VARCHAR(40) NOT NULL,
  recurso_id INT NULL,
  caso_id INT NULL,
  ip VARCHAR(45) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_baud_colegio_fecha (colegio_id, creado_en),
  INDEX idx_baud_caso (caso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
