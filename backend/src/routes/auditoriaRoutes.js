const express = require('express');
const router = express.Router();
const { listar } = require('../controllers/auditoriaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.get('/colegio/:colegio_id', verificarToken, permitirRoles('director', 'admin'), listar);

module.exports = router;
