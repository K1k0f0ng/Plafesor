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

// Prueba de conexión al arrancar
pool.getConnection()
  .then(conn => {
    console.log('Base de datos MySQL conectada correctamente');
    conn.release();
  })
  .catch(err => {
    console.error('Error al conectar la base de datos:', err.message);
  });

module.exports = pool;
