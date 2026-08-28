const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsappController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

// Webhook público — sin JWT (UltraMsg no envía token de sesión)
router.post('/webhook', ctrl.recibirWebhook);

router.use(verificarToken);

router.post('/notificar-ausentes', permitirRoles('admin', 'docente', 'director'), ctrl.notificarAusentes);
router.post('/prueba',             permitirRoles('admin'),                         ctrl.enviarPrueba);

module.exports = router;
