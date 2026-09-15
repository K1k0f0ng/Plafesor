const express = require('express');
const router = express.Router();
const { importar, listarPorEstudiante } = require('../controllers/historicoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.post('/importar', verificarToken, permitirRoles('director', 'admin'), importar);
router.get('/estudiante/:id', verificarToken, permitirRoles('director', 'admin', 'docente'), listarPorEstudiante);

module.exports = router;
