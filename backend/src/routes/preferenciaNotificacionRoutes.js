const express = require('express');
const router = express.Router();
const { obtener, actualizar } = require('../controllers/preferenciaNotificacionController');
const { verificarToken } = require('../middlewares/auth');

router.get('/', verificarToken, obtener);
router.put('/', verificarToken, actualizar);

module.exports = router;
