const express = require('express');
const router = express.Router();
const { listar, actualizar } = require('../controllers/gradoAcademicoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.get('/',     verificarToken, permitirRoles('director', 'admin'), listar);
router.put('/:id',  verificarToken, permitirRoles('director', 'admin'), actualizar);

module.exports = router;
