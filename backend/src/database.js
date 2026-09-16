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
    return true; // recién se creó — útil para disparar un backfill una sola vez
  }
  return false;
}

// Igual que agregarColumnaSiFalta, pero para restricciones (FOREIGN KEY,
// UNIQUE) — necesario porque un ALTER TABLE ADD CONSTRAINT sí falla si ya
// existe (a diferencia de ADD COLUMN, que aquí ya controlamos antes).
async function agregarConstraintSiFalta(tabla, nombreConstraint, sqlCompleto) {
  const [filas] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tabla, nombreConstraint]
  );
  if (filas[0].total === 0) {
    await pool.query(sqlCompleto);
    console.log(`Restricción añadida: ${tabla}.${nombreConstraint}`);
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

  // Módulos desactivados por usuario individual (además de los del colegio
  // completo) — permite que un mismo cargo (admin/director) tenga menos
  // acceso que otro, sin crear un rol de permisos nuevo.
  await agregarColumnaSiFalta('usuarios', 'modulos_desactivados', 'JSON NULL');

  // Campos adicionales de matrícula/SIMAT en estudiantes_datos. Estaban
  // documentados en database/migrations/2026-08-31_datos_simat_estudiante.sql
  // pero nunca se aplicaron en producción (esa migración se corrió a mano
  // y quedó pendiente) — se traen aquí para que se apliquen solas, igual
  // que el resto del esquema.
  await agregarColumnaSiFalta('estudiantes_datos', 'codigo_matricula', 'VARCHAR(30) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'lugar_expedicion_documento', 'VARCHAR(100) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'barrio', 'VARCHAR(150) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'ciudad', 'VARCHAR(100) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'comuna', 'VARCHAR(50) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'telefono', 'VARCHAR(20) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'celular', 'VARCHAR(20) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'estudiante_nuevo', 'BOOLEAN NOT NULL DEFAULT TRUE');
  await agregarColumnaSiFalta('estudiantes_datos', 'colegio_procedencia', 'VARCHAR(200) NULL');
  await agregarColumnaSiFalta('estudiantes_datos', 'anio_procedencia', 'VARCHAR(20) NULL');

  // ============================================================
  // A partir de aquí: migraciones de database/migrations/ que quedaron
  // documentadas pero nunca se confirmó que se aplicaran a mano en
  // producción (ver el caso real de estudiantes_datos.codigo_matricula,
  // detectado el 2026-09-17). Se traen aquí para que dejen de depender de
  // que alguien recuerde correrlas — son seguras de repetir.
  // ============================================================

  // 2026-07-15_briefing_diario.sql / 2026-07-15_piar.sql
  await agregarColumnaSiFalta('usuarios', 'requiere_piar', 'BOOLEAN DEFAULT FALSE');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS piar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estudiante_id INT NOT NULL,
      grupo_id INT NOT NULL,
      colegio_id INT NOT NULL,
      anio_escolar INT NOT NULL,
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
  `);
  await pool.query(`
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
  `);

  // 2026-08-27_director_grupo.sql — la columna es segura de agregar aquí; las
  // restricciones (FK/UNIQUE) quedan al final de la función, protegidas en su
  // propio try/catch (ver comentario allá abajo).
  await agregarColumnaSiFalta('usuarios', 'grupo_dirigido_id', 'INT NULL');

  // 2026-08-27_periodos_final.sql — MODIFY COLUMN es seguro de repetir (deja
  // la misma definición si ya estaba aplicada).
  await pool.query(`ALTER TABLE actividades MODIFY COLUMN periodo ENUM('1','2','3','4') NOT NULL`);
  await pool.query(`ALTER TABLE periodos_academicos MODIFY COLUMN numero ENUM('1','2','3','4') NOT NULL`);
  await agregarColumnaSiFalta('periodos_academicos', 'porcentaje', 'DECIMAL(5,2) NOT NULL DEFAULT 0');

  // 2026-08-28_datos_matricula.sql
  await agregarColumnaSiFalta('usuarios', 'tipo_documento', `ENUM('RC','TI','CC','CE') NULL`);
  await agregarColumnaSiFalta('usuarios', 'numero_documento', 'VARCHAR(30) NULL');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estudiantes_datos (
      estudiante_id INT PRIMARY KEY,
      fecha_nacimiento DATE NULL,
      lugar_nacimiento VARCHAR(150),
      genero ENUM('M','F','Otro') NULL,
      grupo_sanguineo VARCHAR(5),
      direccion VARCHAR(255),
      eps_sisben VARCHAR(150),
      discapacidad VARCHAR(255),
      grupo_etnico VARCHAR(150),
      victima_conflicto BOOLEAN DEFAULT FALSE,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await agregarColumnaSiFalta('padre_estudiante', 'parentesco', 'VARCHAR(50) NULL');

  // 2026-08-28_anotaciones.sql / citaciones_mensajes_masivos.sql / observaciones_periodo.sql
  await pool.query(`
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
  `);
  await pool.query(`
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
  `);
  await pool.query(`
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
  `);
  await pool.query(`
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
  `);

  // 2026-08-29_evaluacion_ponderada.sql
  const porcentajeEsNuevo = await agregarColumnaSiFalta('actividades', 'porcentaje', 'DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER periodo');
  await agregarColumnaSiFalta('actividades', 'fecha_inicio', 'DATE NULL AFTER porcentaje');
  await agregarColumnaSiFalta('actividades', 'fecha_cierre', 'DATE NULL AFTER fecha_inicio');
  if (porcentajeEsNuevo) {
    // Reparte 100% en partes iguales entre las actividades de cada
    // (grupo, materia, período) que ya existían antes de esta columna —
    // solo corre la primera vez que la columna se crea, nunca después.
    await pool.query(`
      UPDATE actividades a
      JOIN (
        SELECT grupo_id, materia_id, periodo, COUNT(*) AS total
        FROM actividades
        GROUP BY grupo_id, materia_id, periodo
      ) g ON g.grupo_id = a.grupo_id AND g.materia_id = a.materia_id AND g.periodo = a.periodo
      SET a.porcentaje = ROUND(100 / g.total, 2)
      WHERE a.porcentaje = 0
    `);
    console.log('Backfill aplicado: porcentaje repartido en actividades existentes');
  }
  await pool.query(`
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
  `);

  // 2026-08-29_foto_estudiante.sql
  await agregarColumnaSiFalta('usuarios', 'foto_url', 'VARCHAR(255) NULL');

  // 2026-08-30_entrega_archivo.sql — MODIFY COLUMN es seguro de repetir.
  await pool.query(`
    ALTER TABLE actividades MODIFY COLUMN tipo ENUM(
      'opcion_multiple','verdadero_falso','ordenar_pasos','completar_espacios',
      'relacionar_columnas','ordenar_letras','ordenar_palabras','sopa_letras',
      'entrega_archivo','manual'
    ) NOT NULL
  `);
  await pool.query(`ALTER TABLE resultados_actividades MODIFY COLUMN nota DECIMAL(3,1) NULL`);
  await agregarColumnaSiFalta('resultados_actividades', 'archivo_url', 'VARCHAR(255) NULL');
  await agregarColumnaSiFalta('resultados_actividades', 'archivo_nombre_original', 'VARCHAR(255) NULL');
  await agregarColumnaSiFalta('resultados_actividades', 'comentario_docente', 'TEXT NULL');

  // 2026-08-31_ficha_medica.sql
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fichas_medicas (
      estudiante_id INT PRIMARY KEY,
      peso_kg DECIMAL(5,2) NULL,
      estatura_cm DECIMAL(5,1) NULL,
      tipo_sangre VARCHAR(5) NULL,
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
      esquema_completo BOOLEAN NULL,
      refuerzo_5_anios BOOLEAN NULL,
      fiebre_amarilla BOOLEAN NULL,
      fecha_vacunacion DATE NULL,
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
      antecedente_diabetes BOOLEAN NULL,
      antecedente_cancer BOOLEAN NULL,
      antecedente_hipertension BOOLEAN NULL,
      antecedente_cardiovascular BOOLEAN NULL,
      antecedente_otro VARCHAR(255) NULL,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2026-08-31_mensajeria_interna.sql
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensajes_internos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      colegio_id INT NOT NULL,
      remitente_id INT NOT NULL,
      hilo_id INT NULL,
      responde_a_id INT NULL,
      asunto VARCHAR(200) NOT NULL,
      cuerpo TEXT NOT NULL,
      estado ENUM('borrador','enviado') NOT NULL DEFAULT 'enviado',
      destinatarios_borrador JSON NULL,
      remitente_eliminado BOOLEAN NOT NULL DEFAULT FALSE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (colegio_id) REFERENCES colegios(id) ON DELETE CASCADE,
      FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (hilo_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL,
      FOREIGN KEY (responde_a_id) REFERENCES mensajes_internos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
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
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensajes_adjuntos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mensaje_id INT NOT NULL,
      archivo_url VARCHAR(255) NOT NULL,
      archivo_nombre_original VARCHAR(255) NOT NULL,
      FOREIGN KEY (mensaje_id) REFERENCES mensajes_internos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Restricciones de 2026-08-27_director_grupo.sql, al final y protegidas
  // aparte: si por no haberse aplicado nunca ya existe más de un docente
  // marcado como director del mismo grupo, el UNIQUE fallaría — y no debe
  // tumbar ninguna de las correcciones de arriba, que sí son seguras.
  try {
    await agregarConstraintSiFalta('usuarios', 'fk_usuarios_grupo_dirigido',
      'ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_grupo_dirigido FOREIGN KEY (grupo_dirigido_id) REFERENCES grupos(id) ON DELETE SET NULL');
    await agregarConstraintSiFalta('usuarios', 'unique_director_grupo',
      'ALTER TABLE usuarios ADD CONSTRAINT unique_director_grupo UNIQUE (grupo_dirigido_id)');
  } catch (err) {
    console.error(
      'No se pudo aplicar la restricción de director de grupo único (probablemente hay más de un ' +
      'docente marcado como director del mismo grupo — hay que corregirlo a mano en la tabla usuarios ' +
      'antes de que esta restricción se pueda aplicar):', err.message
    );
  }
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
