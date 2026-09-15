const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/planMejoramientoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('planes_mejoramiento'));

router.get('/mis-planes',                  permitirRoles('estudiante'),         ctrl.misPlanes);
router.get('/docente',                     permitirRoles('docente'),            ctrl.planesDocente);
router.get('/colegio/:colegio_id',         permitirRoles('director', 'admin'), ctrl.listarPorColegio);
router.post('/generar',                    permitirRoles('director', 'admin'), ctrl.generarPlan);
router.post('/generar-colegio/:colegio_id',permitirRoles('director', 'admin'), ctrl.generarPlanesColegio);
router.put('/:id/estado',                  permitirRoles('director', 'admin'), ctrl.actualizarEstado);

module.exports = router;
