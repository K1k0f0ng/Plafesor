const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/contactoController');

// Rutas públicas (sin verificarToken) — el formulario de demo lo llena
// alguien que todavía no tiene cuenta en la plataforma.
router.post('/demo', ctrl.solicitarDemo);

module.exports = router;
