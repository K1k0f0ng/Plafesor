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

async function migrarEsquema() {
  await agregarColumnaSiFalta('colegios', 'lema', 'VARCHAR(255) NULL');

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
