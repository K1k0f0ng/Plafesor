const express = require('express');
const router = express.Router();
const { listar, actualizar } = require('../controllers/gradoAcademicoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.get('/',     verificarToken, permitirRoles('director', 'admin'), permitirModulo('institucion_academica'), listar);
router.put('/:id',  verificarToken, permitirRoles('director', 'admin'), permitirModulo('institucion_academica'), actualizar);

module.exports = router;
