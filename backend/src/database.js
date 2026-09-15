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
