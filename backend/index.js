require('dotenv').config({ override: true });
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Límite de intentos de login: 10 cada 15 minutos, por IP
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) => {
    const mins = Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000);
    res.status(429).json({ error: `Demasiados intentos. Espera ${Math.max(mins, 1)} minuto(s) e intenta de nuevo.` });
  },
});

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

// La API sirve datos por usuario autenticado (notas, asignaciones, etc.) — nunca deben
// quedar en la caché del navegador, o un usuario puede ver datos de una sesión anterior
// (propia o de otra persona en el mismo equipo) hasta que la caché expire por su cuenta.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Límite de endpoints de IA: 5 solicitudes/minuto. Se aplica a nivel de app,
// antes de que corra verificarToken() de cada router — así que req.usuario
// todavía no existe aquí y la clave siempre termina siendo la IP (mismo
// comportamiento real que tenía la versión anterior con Map(), pese a que
// intentaba usar req.usuario?.id).
const iaRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id ? `user_${req.usuario.id}` : ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiadas solicitudes al asistente. Espera un momento.' });
  },
});

app.use('/api/auth/login', loginRateLimit);

// Límite del formulario público de demo (sin login): 5 solicitudes cada 15
// minutos por IP — evita que un bot sature el correo de comercial.
const demoRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });
  },
});
app.use('/api/contacto/demo', demoRateLimit);

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
app.use('/api/piar',        iaRateLimit);
app.use('/api/briefing',    iaRateLimit);
app.use('/api/observaciones/generar', iaRateLimit);

app.use('/api/contacto',    require('./src/routes/contactoRoutes'));
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
app.use('/api/piar',         require('./src/routes/piarRoutes'));
app.use('/api/briefing',     require('./src/routes/briefingRoutes'));
app.use('/api/logros',           require('./src/routes/logroRoutes'));
app.use('/api/horarios',         require('./src/routes/horarioRoutes'));
app.use('/api/semana-academica', require('./src/routes/semanaAcademicaRoutes'));
app.use('/api/salones',          require('./src/routes/salonRoutes'));
app.use('/api/areas-academicas', require('./src/routes/areaAcademicaRoutes'));
app.use('/api/grado-materias',   require('./src/routes/gradoMateriaRoutes'));
app.use('/api/notificaciones',   require('./src/routes/notificacionRoutes'));
app.use('/api/anotaciones',      require('./src/routes/anotacionRoutes'));
app.use('/api/observaciones',    require('./src/routes/observacionPeriodoRoutes'));
app.use('/api/citaciones',       require('./src/routes/citacionRoutes'));
app.use('/api/mensajes-masivos', require('./src/routes/mensajeMasivoRoutes'));
app.use('/api/mensajes',         require('./src/routes/mensajeRoutes'));
app.use('/api/auditoria',        require('./src/routes/auditoriaRoutes'));
app.use('/api/calificaciones-historicas', require('./src/routes/historicoRoutes'));
app.use('/api/anios-lectivos', require('./src/routes/anioLectivoRoutes'));
app.use('/api/grados-academicos', require('./src/routes/gradoAcademicoRoutes'));
app.use('/api/motivos-retiro', require('./src/routes/motivoRetiroRoutes'));
app.use('/api/preferencias-notificacion', require('./src/routes/preferenciaNotificacionRoutes'));
app.use('/api/colegio-modulos', require('./src/routes/colegioModulosRoutes'));
app.use('/api/eventos', require('./src/routes/eventoRoutes'));
app.use('/api/personal', require('./src/routes/personalRoutes'));

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
  // Resumen ejecutivo diario para el dashboard del director (corre diariamente a las 5am COT)
  const { iniciarCronBriefing } = require('./src/services/briefingService');
  iniciarCronBriefing();
});
