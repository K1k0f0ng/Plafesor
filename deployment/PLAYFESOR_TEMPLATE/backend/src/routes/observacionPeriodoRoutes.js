const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/observacionPeriodoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.post('/generar',          permitirRoles('admin', 'docente', 'director'), ctrl.generar);
router.put('/',                  permitirRoles('admin', 'docente', 'director'), ctrl.guardar);
router.get('/estudiante/:id',    permitirRoles('admin', 'docente', 'director', 'estudiante', 'padre'), ctrl.listarPorEstudiante);
router.post('/notificar',        permitirRoles('admin', 'docente', 'director'), ctrl.notificar);

module.exports = router;
