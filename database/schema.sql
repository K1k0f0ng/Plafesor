-- ============================================================
-- PLAYFESOR — Schema completo de base de datos
-- Motor: MySQL 8 / MariaDB 10
-- Charset: utf8mb4 (soporta tildes y caracteres especiales)
--
-- Actualizado 2026-07-14 (ver AUDITORIA_TECNICA_2026-07-14.md, sección 4.2):
-- se agregó `usuarios.telefono_padres`, usada en producción desde el módulo
-- de WhatsApp pero nunca antes documentada aquí (se había aplicado como
-- ALTER TABLE manual). Cambios de esquema futuros deben registrarse en
-- database/migrations/, no aplicarse solo en producción.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-05:00';

-- ============================================================
-- TABLA: colegios
-- ============================================================
CREATE TABLE IF NOT EXISTS colegios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  ciudad VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: usuarios (admin, docente, estudiante)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin','docente','estudiante','director','padre') NOT NULL,
  colegio_id INT,
  telefono_padres VARCHAR(20),
  requiere_piar BOOLEAN DEFAULT FALSE,
  foto_url VARCHAR(255) NULL,
  -- Identificación (usada por estudiante y padre; el resto de roles la ignora)
  tipo_documento ENUM('RC','TI','CC','CE') NULL,
  numero_documento VARCHAR(30) NULL,
  activo BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(64),
  reset_expiry DATETIME,
  -- Grupo del que este docente es director de grupo (solo rol 'docente').
  -- Un grupo tiene a lo sumo un director — ver UNIQUE KEY más abajo, después
  -- de crear la tabla `grupos` (no puede llevar FOREIGN KEY aquí porque
  -- `grupos` todavía no existe en este punto del script).
  grupo_dirigido_id INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: materias
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

-- `usuarios.grupo_dirigido_id` referencia esta tabla — se agrega aquí porque
-- `grupos` no existía todavía cuando se creó `usuarios`. La UNIQUE KEY
-- garantiza que un grupo no pueda tener dos directores de grupo a la vez.
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_grupo_dirigido FOREIGN KEY (grupo_dirigido_id) REFERENCES grupos(id) ON DELETE SET NULL;
ALTER TABLE usuarios
  ADD CONSTRAINT unique_director_grupo UNIQUE (grupo_dirigido_id);

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
-- TABLA: estudiantes_datos
-- Datos de matrícula (identificación, demográficos, poblacionales) exigidos
-- por el MEN/SIMAT. Un registro por estudiante, separado de `usuarios` para
-- no llenar de columnas específicas de un solo rol la tabla compartida.
-- Todos los campos son opcionales: el estudiante se puede crear sin ellos
-- y completarlos después.
-- ============================================================
CREATE TABLE IF NOT EXISTS estudiantes_datos (
  estudiante_id INT PRIMARY KEY,
  fecha_nacimiento DATE NULL,
  lugar_nacimiento VARCHAR(150),
  genero ENUM('M','F','Otro') NULL,
  grupo_sanguineo VARCHAR(5),
  direccion VARCHAR(255),
  eps_sisben VARCHAR(150),
  -- Datos poblacionales especiales (si aplica) — campos libres a propósito,
  -- para no forzar una taxonomía SIMAT completa que hoy no se necesita.
  discapacidad VARCHAR(255),
  grupo_etnico VARCHAR(150),
  victima_conflicto BOOLEAN DEFAULT FALSE,
  -- Datos de matrícula / SIMAT
  codigo_matricula VARCHAR(30) NULL,
  lugar_expedicion_documento VARCHAR(100) NULL,
  barrio VARCHAR(150) NULL,
  ciudad VARCHAR(100) NULL,
  comuna VARCHAR(50) NULL,
  telefono VARCHAR(20) NULL,
  celular VARCHAR(20) NULL,
  estudiante_nuevo BOOLEAN NOT NULL DEFAULT TRUE,
  colegio_procedencia VARCHAR(200) NULL,
  anio_procedencia VARCHAR(20) NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: fichas_medicas
-- La diligencia admin/director en matrícula; docentes y padres/acudientes
-- solo la consultan (por ejemplo, ante una emergencia).
-- ============================================================
CREATE TABLE IF NOT EXISTS fichas_medicas (
  estudiante_id INT PRIMARY KEY,
  peso_kg DECIMAL(5,2) NULL,
  estatura_cm DECIMAL(5,1) NULL,
  tipo_sangre VARCHAR(5) NULL,
  -- Contactos e información para emergencias
  nombre_padre VARCHAR(150) NULL,
  telefono_padre VARCHAR(20) NULL,
  nombre_madre VARCHAR(150) NULL,
  telefono_madre VARCHAR(20) NULL,
  pediatra VARCHAR(150) NULL,
  telefono_pediatra VARCHAR(20) NULL,
  clinica_preferencia VARCHAR(200) NULL,
  eps VARCHAR(150) NULL,
  numero_afiliacion VARCHAR(50) NULL,
  seguro_accidentes BOOLEAN NULL,
  -- Esquema de vacunación
  esquema_completo BOOLEAN NULL,
  refuerzo_5_anios BOOLEAN NULL,
  fiebre_amarilla BOOLEAN NULL,
  fecha_vacunacion DATE NULL,
  -- Antecedentes personales
  enfermedad_ojos BOOLEAN NULL,
  detalles_ojos VARCHAR(255) NULL,
  usa_lentes BOOLEAN NULL,
  usa_protesis BOOLEAN NULL,
  alergias TEXT NULL,
  tratamiento_alergias TEXT NULL,
  cirugias TEXT NULL,
  convulsiones_perdida_conocimiento BOOLEAN NULL,
  enfermedad_actual TEXT NULL,
  medicamentos_prohibidos TEXT NULL,
  puede_recibir_acetaminofen BOOLEAN NULL,
  condiciones_especiales TEXT NULL,
  -- Antecedentes familiares
  antecedente_diabetes BOOLEAN NULL,
  antecedente_cancer BOOLEAN NULL,
  antecedente_hipertension BOOLEAN NULL,
  antecedente_cardiovascular BOOLEAN NULL,
  antecedente_otro VARCHAR(255) NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
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
    'entrega_archivo',
    'manual'
  ) NOT NULL,
  contenido JSON NOT NULL,
  -- Estructura JSON según tipo:
  -- opcion_multiple:     { pregunta, opciones: [{id, texto, correcto}] }
  -- verdadero_falso:     { afirmaciones: [{id, texto, correcto}] }
  -- ordenar_pasos:       { instruccion, pasos: [{id, texto, orden}] }
  -- completar_espacios:  { texto_con_blancos, respuestas: [{id, respuesta}] }
  -- relacionar_columnas: { columna_a: [{id, texto}], columna_b: [{id, texto, par_id}] }
  -- entrega_archivo:     { instrucciones, categoria } — el estudiante sube un
  --                      archivo (ver resultados_actividades.archivo_url) y
  --                      el docente lo califica manualmente
  docente_id INT NOT NULL,
  materia_id INT NOT NULL,
  grupo_id INT NOT NULL,
  periodo ENUM('1','2','3','4') NOT NULL,
  -- Peso de esta actividad en el 80% de "actividades" de la nota final de la
  -- materia (ver componentes_evaluacion). Los porcentajes de las actividades
  -- de un mismo grupo+materia+período deben sumar 100 entre ellas.
  porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  fecha_inicio DATE NULL,
  fecha_cierre DATE NULL,
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
  -- NULL solo en actividades tipo 'entrega_archivo' mientras el docente
  -- no la ha calificado todavía (entrega pendiente de revisión)
  nota DECIMAL(3,1) NULL,
  -- Escala MEN Colombia:
  -- 1.0 - 2.9: Desempeño Bajo
  -- 3.0 - 3.9: Desempeño Básico
  -- 4.0 - 4.5: Desempeño Alto
  -- 4.6 - 5.0: Desempeño Superior
  tiempo_empleado_segundos INT,
  intento_numero INT DEFAULT 1,
  -- Solo para actividades tipo 'entrega_archivo':
  archivo_url VARCHAR(255) NULL,
  archivo_nombre_original VARCHAR(255) NULL,
  comentario_docente TEXT NULL,
  completada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: componentes_evaluacion
-- Autoevaluación / coevaluación / heteroevaluación — una nota manual por
-- estudiante, materia, grupo y período (casillas fijas del libro de notas,
-- no son actividades). Junto con el promedio ponderado de actividades
-- conforman la nota final: actividades 80%, autoeval. 5%, coeval. 5%,
-- heteroeval. 10%.
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

-- ============================================================
-- TABLA: periodos_academicos
-- Gestión de períodos con fechas reales por colegio
-- ============================================================
CREATE TABLE IF NOT EXISTS periodos_academicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  numero ENUM('1','2','3','4') NOT NULL,
  -- Peso de este período en la nota Final del año (0-100). Cada colegio elige
  -- libremente 3 o 4 períodos: basta con cuántas filas cree para ese año_lectivo,
  -- no hay una columna de "cantidad de períodos" separada.
  porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
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
  -- Relación de este acudiente con este estudiante en particular (una misma
  -- persona puede ser "padre" de un hijo y "acudiente" de otro)
  parentesco VARCHAR(50) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_padre_hijo (padre_id, estudiante_id),
  FOREIGN KEY (padre_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MENSAJERÍA INTERNA
-- Bandeja de correo bidireccional entre colegio (docente/director/admin) y
-- padres, con hilos de respuesta, adjuntos y carpetas (bandeja de entrada,
-- enviados, archivados, eliminados, borradores). Canal adicional a las
-- notificaciones de WhatsApp — no las reemplaza.
-- ============================================================
CREATE TABLE IF NOT EXISTS mensajes_internos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  remitente_id INT NOT NULL,
  hilo_id INT NULL,           -- raíz del hilo (NULL si este mensaje ES la raíz)
  responde_a_id INT NULL,     -- mensaje inmediato al que responde (NULL si es nuevo)
  asunto VARCHAR(200) NOT NULL,
  cuerpo TEXT NOT NULL,
  estado ENUM('borrador','enviado') NOT NULL DEFAULT 'enviado',
  destinatarios_borrador JSON NULL,  -- ids elegidos mientras es borrador
  remitente_eliminado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (hilo_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL,
  FOREIGN KEY (responde_a_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un registro por cada destinatario de un mensaje enviado — estado de
-- lectura y carpeta, independiente para cada uno
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
-- TABLA: anotaciones
-- Observador del estudiante: notas puntuales (positivas, de mejora o
-- neutrales) que el docente deja sobre un estudiante de su grupo. Visibles
-- para el propio estudiante y su acudiente en tiempo real (sin campo de
-- "privada" — transparencia total con la familia, por decisión del colegio).
-- ============================================================
CREATE TABLE IF NOT EXISTS anotaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  docente_id INT NOT NULL,
  grupo_id INT NOT NULL,
  tipo ENUM('positiva','mejora','neutral') NOT NULL DEFAULT 'neutral',
  texto TEXT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  INDEX idx_anotaciones_estudiante (estudiante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: observaciones_periodo
-- Sección "Observaciones" del boletín: un párrafo por estudiante por
-- período (más 'final', el consolidado del año), generado con IA a partir
-- de las notas, asistencia y anotaciones reales, y siempre editable antes
-- de guardarse — nunca se publica sin que un docente lo revise. Lo puede
-- generar/editar cualquier docente que dicte al estudiante ese período, o
-- el director de grupo (aunque no le dicte ninguna materia).
-- ============================================================
CREATE TABLE IF NOT EXISTS observaciones_periodo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  periodo ENUM('1','2','3','4','final') NOT NULL,
  texto TEXT NOT NULL,
  docente_id INT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_obs_periodo (estudiante_id, periodo),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: citaciones
-- Citación a reunión de un acudiente sobre un estudiante puntual, enviada por
-- WhatsApp. Solo la puede generar el director del colegio/admin o el director
-- del grupo del estudiante (no cualquier docente que le dicte una materia) —
-- es una acción institucional, no de aula. Queda registrada aunque el envío
-- de WhatsApp falle, y también se refleja como notificación in-app para el
-- acudiente (canal redundante, mismo criterio ya usado en observaciones_periodo).
-- ============================================================
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

-- ============================================================
-- TABLA: mensajes_masivos
-- Comunicados por WhatsApp a varios acudientes a la vez (ej. reunión de
-- padres). Alcance de grupo: director de grupo o admin/director. Alcance de
-- grado o colegio completo: solo admin/director. Se guarda un resumen de la
-- campaña (no un registro por destinatario) para trazabilidad institucional
-- de qué se comunicó, cuándo y a cuántas familias llegó.
-- ============================================================
CREATE TABLE IF NOT EXISTS mensajes_masivos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  colegio_id INT NOT NULL,
  enviado_por INT NOT NULL,
  alcance ENUM('grupo','grado','colegio') NOT NULL,
  grupo_id INT NULL,
  -- VARCHAR y no ENUM a propósito: el rango real de grados de `grupos.grado`
  -- varía por colegio (algunos llegan hasta 11°) y no vale la pena mantener
  -- dos ENUMs sincronizados para el mismo dato.
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
-- TABLA: piar
-- Plan Individual de Ajustes Razonables (Decreto 1421 de 2017).
-- Un registro por estudiante por año escolar. La IA solo redacta
-- el documento oficial a partir de la información real que el
-- docente escribe en estos campos — nunca inventa diagnósticos.
-- ============================================================
CREATE TABLE IF NOT EXISTS piar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  grupo_id INT NOT NULL,
  colegio_id INT NOT NULL,
  anio_escolar INT NOT NULL,

  -- Componentes mínimos exigidos por el art. 2.3.3.5.2.3.5 del Decreto 1421 de 2017
  contexto_estudiante TEXT,
  valoracion_pedagogica TEXT,
  informes_salud TEXT,
  objetivos_metas TEXT,
  ajustes_curriculares TEXT,
  ajustes_didacticos TEXT,
  ajustes_evaluativos TEXT,
  recursos_apoyos TEXT,
  proyectos_especificos TEXT,
  actividades_casa TEXT,
  seguimiento TEXT,

  -- El decreto exige que participe un "docente de apoyo pedagógico"; la plataforma
  -- no modela ese rol como usuario, se registra como texto libre.
  docente_apoyo_nombre VARCHAR(150),
  docente_apoyo_observaciones TEXT,

  documento_generado TEXT,
  estado ENUM('borrador','activo','en_revision','archivado') NOT NULL DEFAULT 'borrador',
  acta_firmada BOOLEAN DEFAULT FALSE,
  fecha_acta DATE,
  elaborado_por INT,

  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_piar_anio (estudiante_id, anio_escolar),
  FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
  FOREIGN KEY (elaborado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TABLA: briefing_diario
-- Resumen ejecutivo diario para el rector ("dashboard que habla").
-- Un registro por colegio por día — se genera una vez (cron 5am)
-- y el dashboard solo lo lee, sin llamar a Claude en cada visita.
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
-- No se crea aquí (nunca embeber contraseñas, ni siquiera hasheadas, en
-- este archivo — ver AUDITORIA_TECNICA_2026-07-14.md, sección 4.4).
-- Usar deployment/PLAYFESOR_TEMPLATE/scripts/crear-admin.js para generar
-- el usuario administrador de cada instalación con su propia contraseña.
-- ============================================================
