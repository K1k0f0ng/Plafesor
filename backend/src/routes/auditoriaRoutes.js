const express = require('express');
const router = express.Router();
const { listar } = require('../controllers/auditoriaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.get('/colegio/:colegio_id', verificarToken, permitirRoles('director', 'admin'), permitirModulo('auditoria'), listar);

module.exports = router;
