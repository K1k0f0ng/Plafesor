const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/riesgoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('motor_riesgo'));

router.post('/colegio/:colegio_id/calcular', permitirRoles('admin', 'director'), ctrl.calcularRiesgo);
router.get('/colegio/:colegio_id',           permitirRoles('admin', 'director'), ctrl.obtenerRiesgo);
router.post('/notificar-padre',              permitirRoles('admin', 'director'), ctrl.notificarPadre);
router.post('/generar-pmi',                 permitirRoles('admin', 'director'), ctrl.generarPMI);

module.exports = router;
