const express = require('express');
const router = express.Router();
const { listar, actualizar } = require('../controllers/semanaAcademicaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('institucion_academica'));

// Lectura: docente también la necesita para armar su horario
router.get('/',    permitirRoles('docente', 'director', 'admin'), listar);
router.put('/:id', permitirRoles('director', 'admin'), actualizar);

module.exports = router;
