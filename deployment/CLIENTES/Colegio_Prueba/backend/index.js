require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Rate limiter en memoria — sin paquetes externos
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const ahora = Date.now();
  const VENTANA = 15 * 60 * 1000;
  const MAX = 10;
  const reg = loginAttempts.get(ip) || { intentos: 0, inicio: ahora };
  if (ahora - reg.inicio > VENTANA) { reg.intentos = 0; reg.inicio = ahora; }
  reg.intentos++;
  loginAttempts.set(ip, reg);
  if (reg.intentos > MAX) {
    const mins = Math.ceil((VENTANA - (ahora - reg.inicio)) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Espera ${mins} minutos e intenta de nuevo.` });
  }
  next();
}

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// CORS: orígenes permitidos — se leen de CORS_ORIGINS (separados por coma) en el .env de cada
// instalación. Si la variable no está definida, se usa el valor histórico como respaldo.
const origenesPermitidos = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['https://playfesor.co', 'https://www.playfesor.co'];

app.use(helmet());
app.use(cors({
  origin: function (origen, callback) {
    if (!origen) return callback(null, true);
    if (origenesPermitidos.includes(origen)) return callback(null, true);
    callback(new Error('Origen no permitido por CORS: ' + origen));
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter para endpoints de IA — máx 5 requests/minuto por usuario
const iaAttempts = new Map();
function iaRateLimit(req, res, next) {
  const key = req.usuario?.id || req.ip || 'unknown';
  const ahora = Date.now();
  const VENTANA = 60 * 1000;
  const MAX = 5;
  const reg = iaAttempts.get(key) || { intentos: 0, inicio: ahora };
  if (ahora - reg.inicio > VENTANA) { reg.intentos = 0; reg.inicio = ahora; }
  reg.intentos++;
  iaAttempts.set(key, reg);
  if (reg.intentos > MAX) {
    return res.status(429).json({ error: 'Demasiadas solicitudes al asistente. Espera un momento.' });
  }
  next();
}

app.use('/api/auth/login', loginRateLimit);

// Ruta de salud — confirma que el servidor está activo
app.get('/', (req, res) => {
  res.json({ mensaje: 'API Playfesor activa', version: '1.0.0', estado: 'OK' });
});

// Rutas de la API
// Aplicar rate limit de IA en endpoints que consumen tokens de Anthropic
app.use('/api/actividades/generar-ia',  iaRateLimit);
app.use('/api/actividades',             (req, res, next) => {
  if (req.path.endsWith('/generar-recuperacion') && req.method === 'POST') return iaRateLimit(req, res, next);
  next();
});
app.use('/api/copiloto',    iaRateLimit);
app.use('/api/tutor',       iaRateLimit);
app.use('/api/observador',  iaRateLimit);

app.use('/api/auth',        require('./src/routes/authRoutes'));
app.use('/api/colegios',    require('./src/routes/colegioRoutes'));
app.use('/api/grupos',      require('./src/routes/grupoRoutes'));
app.use('/api/materias',    require('./src/routes/materiaRoutes'));
app.use('/api/docentes',    require('./src/routes/docenteRoutes'));
app.use('/api/estudiantes', require('./src/routes/estudianteRoutes'));
app.use('/api/actividades',  require('./src/routes/actividadRoutes'));
app.use('/api/reportes',     require('./src/routes/reporteRoutes'));
app.use('/api/asistencias',  require('./src/routes/asistenciaRoutes'));
app.use('/api/riesgo',       require('./src/routes/riesgoRoutes'));
app.use('/api/copiloto',     require('./src/routes/coPilotoRoutes'));
app.use('/api/observador',   require('./src/routes/observadorRoutes'));
app.use('/api/whatsapp',     require('./src/routes/whatsappRoutes'));
app.use('/api/tutor',        require('./src/routes/tutorRoutes'));
app.use('/api/padre',        require('./src/routes/padreRoutes'));
app.use('/api/boletin',      require('./src/routes/boletinRoutes'));
app.use('/api/periodos',     require('./src/routes/periodoRoutes'));
app.use('/api/planes',       require('./src/routes/planMejoramientoRoutes'));
app.use('/api/logros',           require('./src/routes/logroRoutes'));
app.use('/api/horarios',         require('./src/routes/horarioRoutes'));
app.use('/api/notificaciones',   require('./src/routes/notificacionRoutes'));

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor Playfesor corriendo en puerto ${PORT}`);
  console.log(`Orígenes CORS: ${origenesPermitidos.join(', ')}`);

  // Iniciar sistema de alertas preventivas (corre diariamente a las 6am)
  const { iniciarCronAlertas, iniciarCronRiesgo } = require('./src/services/alertasService');
  iniciarCronAlertas();
  // Recálculo automático de riesgo académico (corre diariamente a las 2am COT)
  iniciarCronRiesgo();
  // Informes semanales al director por WhatsApp (corre cada domingo a las 6pm COT)
  const { iniciarCronInformesSemanal } = require('./src/services/informesSemanalService');
  iniciarCronInformesSemanal();
});
