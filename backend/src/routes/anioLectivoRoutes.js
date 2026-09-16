const express = require('express');
const router = express.Router();
const { activo, resumenCierre, ejecutarCierre } = require('../controllers/anioLectivoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.get('/activo',          verificarToken, permitirRoles('director', 'admin'), permitirModulo('cierre_anio_lectivo'), activo);
router.get('/cierre/resumen',  verificarToken, permitirRoles('director', 'admin'), permitirModulo('cierre_anio_lectivo'), resumenCierre);
router.post('/cierre',         verificarToken, permitirRoles('director', 'admin'), permitirModulo('cierre_anio_lectivo'), ejecutarCierre);

module.exports = router;
