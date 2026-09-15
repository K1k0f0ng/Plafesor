const express = require('express');
const router = express.Router();
const { activo, resumenCierre, ejecutarCierre } = require('../controllers/anioLectivoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.get('/activo',          verificarToken, permitirRoles('director', 'admin'), activo);
router.get('/cierre/resumen',  verificarToken, permitirRoles('director', 'admin'), resumenCierre);
router.post('/cierre',         verificarToken, permitirRoles('director', 'admin'), ejecutarCierre);

module.exports = router;
