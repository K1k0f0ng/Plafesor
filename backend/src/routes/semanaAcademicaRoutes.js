const express = require('express');
const router = express.Router();
const { listar, actualizar } = require('../controllers/semanaAcademicaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

// Lectura: docente también la necesita para armar su horario
router.get('/',    permitirRoles('docente', 'director', 'admin'), listar);
router.put('/:id', permitirRoles('director', 'admin'), actualizar);

module.exports = router;
