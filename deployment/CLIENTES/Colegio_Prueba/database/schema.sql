-- ============================================================
-- PLAYFESOR — Schema completo de base de datos (PLANTILLA)
-- Motor: MySQL 8 / MariaDB 10
-- Charset: utf8mb4 (soporta tildes y caracteres especiales)
--
-- Este es el script de instalación LIMPIA para un colegio nuevo.
-- Incluye todas las correcciones conocidas a la fecha de creación de esta
-- plantilla (ver AUDITORIA_TECNICA_2026-07-14.md del proyecto core):
--   - Se agregó `usuarios.telefono_padres` (existía en producción vía ALTER
--     TABLE manual, pero nunca se documentó en el schema.sql original).
--   - Se corrigió el default de `ano_lectivo` para que coincida entre
--     `grupos` y `periodos_academicos` (antes 2025 vs 2026).
--   - Se removió el INSERT del usuario admin con contraseña en texto plano
--     dentro de un comentario — el admin de cada instalación se crea con
--     `scripts/crear-admin.js`, nunca con una contraseña embebida aquí.
--   - Se agregó un único registro en `colegios` (id=1) con placeholders,
--     ya que cada instalación de esta plantilla sirve a un solo colegio.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-05:00';

-- ============================================================
-- TABLA: colegios
-- En esta plantilla single-tenant, siempre existe un único registro (id=1).
-- ============================================================
CREATE TABLE IF NOT EXISTS colegios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  ciudad VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: el único colegio de esta instalación. Reemplazar los placeholders
-- durante la implementación (ver checklists/CHECKLIST_DATOS_INSTITUCIONALES.md).
INSERT IGNORE INTO colegios (id, nombre, ciudad) VALUES
(1, 'NOMBRE_INSTITUCION_AQUI', 'CIUDAD_AQUI');

-- ============================================================
-- TABLA: usuarios (admin, docente, estudiante, director, padre)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin','docente','estudiante','director','padre') NOT NULL,
  colegio_id INT,
  telefono_padres VARCHAR(20),
  activo BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(64),
  reset_expiry DATETIME,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: materias
-- Catálogo de referencia — igual para cualquier colegio colombiano (MEN).
-- No es un dato de prueba: se precarga en toda instalación nueva.
-- ============================================================
CREATE TABLE IF NOT EXISTS materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: materias base del MEN Colombia
INSERT IGNORE INTO materias (nombre, codigo) VALUES
('Matemáticas',        'MAT'),
('Inglés',             'ING'),
('Informática',        'INF'),
('Lengua Castellana',  'LEN'),
('Ciencias Naturales', 'CNT'),
('Ciencias Sociales',  'CSO');

-- ============================================================
-- TABLA: grupos
-- ============================================================
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL,
  grado ENUM('5','6','7','8','9') NOT NULL,
  colegio_id INT NOT NULL,
  ano_lectivo INT DEFAULT 2026,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: docente_grupos_materias
-- Un docente puede dictar múltiples combinaciones grupo+materia
-- ============================================================
CREATE TABLE IF NOT EXISTS docente_grupos_materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  docente_id INT NOT NULL,
  grupo_id INT NOT NULL,
  materia_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_asignacion (docente_id, grupo_id, materia_id),
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: estudiante_grupos
-- Un estudiante pertenece a un grupo por año lectivo
-- ============================================================
CREATE TABLE IF NOT EXISTS estudiante_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_estudiante_grupo (estudiante_id, grupo_id),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: actividades
-- Cada actividad es creada por un docente para un grupo/materia/periodo
-- ============================================================
CREATE TABLE IF NOT EXISTS actividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  tipo ENUM(
    'opcion_multiple',
    'verdadero_falso',
    'ordenar_pasos',
    'completar_espacios',
    'relacionar_columnas',
    'ordenar_letras',
    'ordenar_palabras',
    'sopa_letras',
    'manual'
  ) NOT NULL,
  contenido JSON NOT NULL,
  -- Estructura JSON según tipo:
  -- opcion_multiple:     { pregunta, opciones: [{id, texto, correcto}] }
  -- verdadero_falso:     { afirmaciones: [{id, texto, correcto}] }
  -- ordenar_pasos:       { instruccion, pasos: [{id, texto, orden}] }
  -- completar_espacios:  { texto_con_blancos, respuestas: [{id, respuesta}] }
  -- relacionar_columnas: { columna_a: [{id, texto}], columna_b: [{id, texto, par_id}] }
  docente_id INT NOT NULL,
  materia_id INT NOT NULL,
  grupo_id INT NOT NULL,
  periodo ENUM('1','2','3') NOT NULL,
  grado_minimo ENUM('5','6','7','8','9') NOT NULL,
  grado_maximo ENUM('5','6','7','8','9') NOT NULL,
  tiempo_limite_minutos INT DEFAULT 30,
  intentos_permitidos INT DEFAULT 3,
  activa BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: resultados_actividades
-- Guarda cada intento de un estudiante en una actividad
-- ============================================================
CREATE TABLE IF NOT EXISTS resultados_actividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  actividad_id INT NOT NULL,
  respuestas JSON NOT NULL,
  nota DECIMAL(3,1) NOT NULL,
  -- Escala MEN Colombia:
  -- 1.0 - 2.9: Desempeño Bajo
  -- 3.0 - 3.9: Desempeño Básico
  -- 4.0 - 4.5: Desempeño Alto
  -- 4.6 - 5.0: Desempeño Superior
  tiempo_empleado_segundos INT,
  intento_numero INT DEFAULT 1,
  completada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: periodos_academicos
-- Gestión de períodos con fechas reales por colegio
-- ============================================================
CREATE TABLE IF NOT EXISTS periodos_academicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  numero ENUM('1','2','3') NOT NULL,
  ano_lectivo INT NOT NULL DEFAULT 2026,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: asistencias
-- Registro diario de asistencia por estudiante y grupo
-- ============================================================
CREATE TABLE IF NOT EXISTS asistencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('presente','ausente','tardanza','justificado') NOT NULL,
  registrado_por INT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_asistencia (estudiante_id, grupo_id, fecha),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: predicciones_riesgo
-- Score de riesgo académico por estudiante × materia × grupo
-- Recalculada automáticamente cada noche a las 2:00 AM
-- ============================================================
CREATE TABLE IF NOT EXISTS predicciones_riesgo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  materia_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  nivel ENUM('bajo','medio','alto','critico') NOT NULL,
  factores TEXT,
  calculado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_riesgo (estudiante_id, materia_id, grupo_id),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: padre_estudiante
-- Relación entre cuentas de padres y sus hijos
-- ============================================================
CREATE TABLE IF NOT EXISTS padre_estudiante (
  id INT AUTO_INCREMENT PRIMARY KEY,
  padre_id INT NOT NULL,
  estudiante_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_padre_hijo (padre_id, estudiante_id),
  FOREIGN KEY (padre_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: estudiante_logros
-- Logros/badges desbloqueados por los estudiantes
-- ============================================================
CREATE TABLE IF NOT EXISTS estudiante_logros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  obtenido_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_logro (estudiante_id, tipo),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: planes_mejoramiento
-- PMI generados por IA para estudiantes en riesgo alto/crítico
-- ============================================================
CREATE TABLE IF NOT EXISTS planes_mejoramiento (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  materia_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  periodo ENUM('1','2','3') NOT NULL DEFAULT '1',
  diagnostico TEXT,
  plan_texto TEXT,
  estado ENUM('activo','superado','archivado') NOT NULL DEFAULT 'activo',
  generado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_plan (estudiante_id, materia_id, grupo_id),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: horarios
-- Franjas horarias de clases por docente, grupo y materia
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  docente_id INT NOT NULL,
  grupo_id INT NOT NULL,
  materia_id INT NOT NULL,
  dia_semana TINYINT NOT NULL,
  -- 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_horario (docente_id, grupo_id, materia_id, dia_semana),
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: notificaciones
-- Alertas in-app para docentes, directores y padres
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  ref_key VARCHAR(120),
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT,
  leida BOOLEAN DEFAULT FALSE,
  datos_extra JSON,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_notif_dia (usuario_id, tipo, ref_key),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- USUARIO ADMINISTRADOR INICIAL
-- No se crea aquí. Ejecutar tras importar este schema:
--   node scripts/crear-admin.js
-- Ese script pide nombre/email/contraseña por terminal y genera el usuario
-- con un hash bcrypt real — nunca una contraseña embebida en este archivo.
-- ============================================================
