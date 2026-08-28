const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reporteController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/alertas/docente/:docente_id',           permitirRoles('admin', 'docente'),           ctrl.alertasDocente);
router.get('/alertas/colegio/:colegio_id',           permitirRoles('admin', 'director'),          ctrl.alertasColegio);
router.get('/docente/:id',                           permitirRoles('admin', 'docente'),           ctrl.reporteDocente);
router.get('/grupo/:grupo_id/materia/:materia_id',   permitirRoles('admin', 'docente'),           ctrl.reporteGrupoMateria);
router.get('/colegio/:colegio_id/resumen',           permitirRoles('admin', 'director'),          ctrl.resumenColegio);
router.get('/colegio/:colegio_id/metricas',          permitirRoles('admin', 'director'),          ctrl.metricasColegio);
router.get('/colegio/:colegio_id/evaluacion-docentes', permitirRoles('admin', 'director'),        ctrl.evaluacionDocentes);
router.get('/colegio/:colegio_id/comparativas',      permitirRoles('admin', 'director'),          ctrl.comparativasPeriodos);
router.get('/colegio/:colegio_id/gemelo',            permitirRoles('admin', 'director'),          ctrl.gemeloDigital);

module.exports = router;
