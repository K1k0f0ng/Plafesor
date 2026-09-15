const express = require('express');
const router = express.Router();
const { listar, activos, actualizar } = require('../controllers/colegioModulosController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/activos', activos);
router.get('/',        permitirRoles('director', 'admin'), listar);
router.put('/',        permitirRoles('director', 'admin'), actualizar);

module.exports = router;
