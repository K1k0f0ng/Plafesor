const express = require('express');
const router = express.Router();
const { listar, actualizar } = require('../controllers/gradoMateriaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/:grado',    permitirRoles('director', 'admin'), listar);
router.put('/:grado',    permitirRoles('director', 'admin'), actualizar);

module.exports = router;
