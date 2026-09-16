const express = require('express');
const router = express.Router();
const { listar, crear, actualizar } = require('../controllers/areaAcademicaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('asignaturas'));

// Lectura: el docente también la necesitará para elegir área al crear asignaturas
router.get('/',    permitirRoles('docente', 'director', 'admin'), listar);
router.post('/',   permitirRoles('director', 'admin'), crear);
router.put('/:id', permitirRoles('director', 'admin'), actualizar);

module.exports = router;
