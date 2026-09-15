const express = require('express');
const router = express.Router();
const { listar, crear, actualizar } = require('../controllers/motivoRetiroController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.get('/',     verificarToken, permitirRoles('director', 'admin'), listar);
router.post('/',    verificarToken, permitirRoles('director', 'admin'), crear);
router.put('/:id',  verificarToken, permitirRoles('director', 'admin'), actualizar);

module.exports = router;
