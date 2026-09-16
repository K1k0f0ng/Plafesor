const express = require('express');
const router = express.Router();
const { importar, listarPorEstudiante } = require('../controllers/historicoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.post('/importar', verificarToken, permitirRoles('director', 'admin'), permitirModulo('cargue_historico'), importar);
router.get('/estudiante/:id', verificarToken, permitirRoles('director', 'admin', 'docente'), listarPorEstudiante);

module.exports = router;
