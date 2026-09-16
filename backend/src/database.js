const mysql = require('mysql2/promise');

// Pool de conexiones — reutiliza conexiones en lugar de abrir una nueva por cada petición
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 100,
  connectTimeout: 10000,
  timezone: '-05:00' // Colombia (UTC-5)
});

// Agrega columnas nuevas si aún no existen — evita depender de migraciones
// manuales en el hosting compartido (cPanel). Se ejecuta una sola vez al
// arrancar el servidor y es segura de repetir (revisa antes de alterar).
async function agregarColumnaSiFalta(tabla, columna, definicion) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  if (filas[0].total === 0) {
    await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`Columna añadida: ${tabla}.${columna}`);
  }
}

// Convierte una columna ENUM rígida en VARCHAR — deja pasar cualquier
// código de grado nuevo (prejardín, jardín, etc.) sin volver a tocar el
// esquema cada vez que un colegio agregue un grado propio. Los valores ya
// guardados (ej. '5', '10') se conservan tal cual, solo cambia el tipo.
async function convertirEnumAVarcharSiFalta(tabla, columna, longitud) {
  const [[info]] = await pool.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  if (!info) return;
  if (info.DATA_TYPE === 'enum') {
    await pool.query(`ALTER TABLE ${tabla} MODIFY COLUMN ${columna} VARCHAR(${longitud}) NOT NULL`);
    console.log(`Columna convertida a texto libre: ${tabla}.${columna}`);
  }
}

async function migrarEsquema() {
  await agregarColumnaSiFalta('colegios', 'lema', 'VARCHAR(255) NULL');

  // El "grado" deja de ser un ENUM fijo (antes limitado a '5'..'11') para
  // que cada colegio pueda definir su propio catálogo de grados académicos
  // (prejardín, jardín, transición, primero..undécimo, o lo que use).
  await convertirEnumAVarcharSiFalta('grupos', 'grado', 30);
  await convertirEnumAVarcharSiFalta('actividades', 'grado_minimo', 30);
  await convertirEnumAVarcharSiFalta('actividades', 'grado_maximo', 30);

  // Guarda una "foto" mensual de los totales del colegio para poder mostrar
  // comparativos reales ("↑ 2 vs. mes anterior") sin inventar cifras.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS colegio_metricas_mensuales (
      colegio_id INT NOT NULL,
      mes CHAR(7) NOT NULL,
      total_grupos INT NOT NULL DEFAULT 0,
      total_estudiantes INT NOT NULL DEFAULT 0,
      total_actividades INT NOT NULL DEFAULT 0,
      promedio DECIMAL(3,1) NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (colegio_id, mes)
    )
  `);

  // Bitácora institucional: quién hizo qué y cuándo, para acciones sensibles
  // (notas, estudiantes, comunicados) — trazabilidad ante reclamos y confianza
  // institucional en la evaluación de compra de colegios grandes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      usuario_id INT NULL,
      usuario_nombre VARCHAR(150) NULL,
      usuario_rol VARCHAR(20) NULL,
      accion VARCHAR(60) NOT NULL,
      entidad VARCHAR(60) NOT NULL,
      entidad_id INT NULL,
      detalle TEXT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auditoria_colegio_fecha (colegio_id, creado_en),
      INDEX idx_auditoria_entidad (entidad, entidad_id)
    )
  `);

  // Notas de años anteriores (de antes de usar Playfesor, o de un sistema
  // anterior) — se guardan aparte de "actividades" porque no las calificó
  // ningún docente en la plataforma, son un registro histórico de solo lectura.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calificaciones_historicas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      estudiante_id INT NOT NULL,
      ano_lectivo INT NOT NULL,
      periodo TINYINT NOT NULL,
      materia_nombre VARCHAR(120) NOT NULL,
      nota DECIMAL(2,1) NOT NULL,
      importado_por INT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_hist_estudiante (estudiante_id, ano_lectivo, periodo)
    )
  `);

  // Año lectivo como entidad propia: permite cerrar un año (bloquea nuevas
  // actividades en sus grupos) y abrir el siguiente al promover estudiantes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anios_lectivos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      anio INT NOT NULL,
      estado ENUM('activo', 'cerrado') NOT NULL DEFAULT 'activo',
      cerrado_en TIMESTAMP NULL,
      cerrado_por INT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_anio (colegio_id, anio)
    )
  `);

  // Catálogo de grados académicos por colegio: reemplaza el ENUM fijo de
  // "grado" por algo que cada colegio configura (nombre, nivel, intensidad
  // horaria, máximo de tareas/evaluaciones) — igual a como lo maneja
  // referencia con la que se está comparando Playfesor.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grados_academicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      nivel ENUM('prejardin','jardin','transicion','primaria','secundaria','media') NOT NULL,
      programa VARCHAR(100) NULL,
      codigo VARCHAR(30) NOT NULL,
      nombre VARCHAR(60) NOT NULL,
      orden INT NOT NULL,
      intensidad_horaria INT NULL,
      max_tareas INT NULL,
      max_evaluaciones INT NULL,
      activo BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_codigo (colegio_id, codigo),
      INDEX idx_grados_colegio_orden (colegio_id, orden)
    )
  `);

  // Catálogo de motivos de retiro por colegio — evita que cada admin escriba
  // el motivo como texto libre y permite reportar retiros por causa real
  // (traslado, económico, disciplinario, etc.), igual que la referencia.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS motivos_retiro (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      orden INT NOT NULL DEFAULT 0,
      activo BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_nombre (colegio_id, nombre),
      INDEX idx_motivos_retiro_colegio (colegio_id, orden)
    )
  `);

  await agregarColumnaSiFalta('usuarios', 'motivo_retiro_id', 'INT NULL');
  await agregarColumnaSiFalta('usuarios', 'motivo_retiro_detalle', 'VARCHAR(255) NULL');
  await agregarColumnaSiFalta('usuarios', 'retirado_en', 'DATETIME NULL');

  // Rotación de contraseña: cada colegio decide cada cuántos días debe
  // cambiarla su personal (NULL = desactivada). password_actualizada_en usa
  // DEFAULT CURRENT_TIMESTAMP para que toda cuenta nueva arranque "al día"
  // sin tener que tocar cada punto del código que crea usuarios.
  await agregarColumnaSiFalta('colegios', 'dias_rotacion_password', 'INT NULL');
  await agregarColumnaSiFalta('usuarios', 'password_actualizada_en', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await pool.query('UPDATE usuarios SET password_actualizada_en = NOW() WHERE password_actualizada_en IS NULL');

  // Preferencias de notificación por usuario — sin fila = todo activado
  // (comportamiento actual sin cambios); cada quien decide qué categorías
  // le llegan a la campanita, y los acudientes si quieren o no WhatsApp.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS preferencias_notificacion (
      usuario_id INT PRIMARY KEY,
      notif_mensajes BOOLEAN NOT NULL DEFAULT TRUE,
      notif_citaciones BOOLEAN NOT NULL DEFAULT TRUE,
      notif_riesgo_academico BOOLEAN NOT NULL DEFAULT TRUE,
      notif_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Administración de módulos del portal: cada colegio puede apagar módulos
  // opcionales (Copiloto IA, PIAR, etc.) que no usa. NULL/vacío = todo
  // activado, igual que hoy — nadie pierde acceso a nada hasta que un
  // director/admin decida desactivar algo puntual.
  await agregarColumnaSiFalta('colegios', 'modulos_desactivados', 'JSON NULL');

  // Agenda institucional: eventos generales que ve todo el colegio (o solo
  // los roles/grados a los que van dirigidos), alimentados por el director
  // o quien se designe — no por cada docente individualmente. Un evento
  // puede tener varias fechas (ej. "Crazy Week" toda una semana), cada una
  // con su propio horario y lugar.
  await pool.query(`
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
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_institucionales_fechas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      evento_id INT NOT NULL,
      fecha DATE NOT NULL,
      hora_inicio TIME NULL,
      hora_fin TIME NULL,
      lugar VARCHAR(150) NULL,
      INDEX idx_eventos_fechas_evento (evento_id),
      INDEX idx_eventos_fechas_fecha (fecha)
    )
  `);

  // Personal administrativo/directivo (Rector, Coordinador Académico, etc.):
  // usan el permiso real de 'admin' o 'director', y 'cargo' guarda el título
  // del puesto solo para mostrarlo y para la Agenda ("dirigido a" ese cargo).
  await agregarColumnaSiFalta('usuarios', 'cargo', 'VARCHAR(60) NULL');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS personal_datos (
      usuario_id INT PRIMARY KEY,
      fecha_nacimiento DATE NULL,
      telefono_residencial VARCHAR(30) NULL,
      direccion_residencial VARCHAR(150) NULL,
      telefono_oficina VARCHAR(30) NULL,
      direccion_oficina VARCHAR(150) NULL,
      telefono_celular VARCHAR(30) NULL,
      telefono_otro VARCHAR(30) NULL,
      fecha_ingreso_caja_compensacion DATE NULL,
      fecha_ingreso_institucion DATE NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Documentos de soporte del PIAR (diagnósticos, valoraciones, certificados)
  // — se guardan fuera de /uploads (carpeta privada) porque son datos
  // sensibles de salud; solo se sirven por el endpoint protegido de
  // descarga. La IA los usa como evidencia real al redactar el borrador.
  await pool.query(`
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
    )
  `);

  // Semana académica: qué días de la semana dicta clase el colegio y cómo se
  // llaman. El número de día es el mismo que ya usa horarios.dia_semana —
  // por defecto lunes a viernes activos, sábado y domingo creados pero
  // inactivos (el colegio que sí dicta sábado solo lo activa y renombra).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS semana_academica (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      dia_numero TINYINT NOT NULL,
      nombre VARCHAR(30) NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE KEY unique_colegio_dia (colegio_id, dia_numero)
    )
  `);

  // Salones de clase: catálogo de espacios físicos del colegio, para armar
  // horarios sin escribir el lugar como texto libre cada vez. El de "permite
  // clases simultáneas" es para espacios como una cancha que varios grupos
  // pueden usar a la vez, a diferencia de un salón normal.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS salones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      nombre VARCHAR(60) NOT NULL,
      permite_clases_simultaneas BOOLEAN NOT NULL DEFAULT FALSE,
      orden INT NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_nombre (colegio_id, nombre)
    )
  `);
  await agregarColumnaSiFalta('horarios', 'salon_id', 'INT NULL');

  // Áreas académicas: agrupan las asignaturas (ej. "Matemáticas" agrupa
  // Álgebra, Cálculo, etc.). Catálogo por colegio, con código y nombre
  // editables — el código es solo una etiqueta administrativa, no se usa
  // como llave de relación (las asignaturas se enlazan por area_id).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS areas_academicas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      codigo VARCHAR(10) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      orden INT NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_nombre (colegio_id, nombre)
    )
  `);

  // Las materias existentes eran globales (compartidas por todos los
  // colegios). A partir de ahora una asignatura nueva queda ligada a su
  // colegio y opcionalmente a un área — pero las filas antiguas (colegio_id
  // NULL) se dejan como catálogo compartido de solo lectura para no romper
  // asignaciones ya existentes (docente_grupos_materias) de ningún colegio.
  await agregarColumnaSiFalta('materias', 'colegio_id', 'INT NULL');
  await agregarColumnaSiFalta('materias', 'area_id', 'INT NULL');

  // Pénsum: qué asignaturas se dictan en cada grado del colegio. El grado se
  // identifica por su código (grados_academicos.codigo), igual que ya hace
  // grupos.grado — así no se duplica la relación con una llave distinta.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grado_materias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      grado_codigo VARCHAR(20) NOT NULL,
      materia_id INT NOT NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_colegio_grado_materia (colegio_id, grado_codigo, materia_id)
    )
  `);

  // Definición de clases: la intensidad horaria semanal de cada asignación
  // docente+grupo+materia, para saber cuántas horas a la semana se dicta esa
  // clase (no reemplaza el horario real, solo la carga planeada).
  await agregarColumnaSiFalta('docente_grupos_materias', 'intensidad_horaria_semanal', 'INT NULL');
}

// Prueba de conexión al arrancar
pool.getConnection()
  .then(async conn => {
    console.log('Base de datos MySQL conectada correctamente');
    conn.release();
    try {
      await migrarEsquema();
    } catch (err) {
      console.error('Error al migrar el esquema:', err.message);
    }
  })
  .catch(err => {
    console.error('Error al conectar la base de datos:', err.message);
  });

module.exports = pool;
