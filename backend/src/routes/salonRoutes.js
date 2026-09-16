const express = require('express');
const router = express.Router();
const { listar, crear, actualizar } = require('../controllers/salonController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('institucion_academica'));

// Lectura: docente también la necesita para elegir salón al armar su horario
router.get('/',    permitirRoles('docente', 'director', 'admin'), listar);
router.post('/',   permitirRoles('director', 'admin'), crear);
router.put('/:id', permitirRoles('director', 'admin'), actualizar);

module.exports = router;
