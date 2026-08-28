const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/asistenciaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.post('/',                                    permitirRoles('docente', 'admin'),             ctrl.registrar);
router.get('/grupo/:grupo_id',                      permitirRoles('admin', 'docente', 'director'), ctrl.obtenerPorFecha);
router.get('/grupo/:grupo_id/resumen',              permitirRoles('admin', 'docente', 'director'), ctrl.resumenGrupo);
router.get('/alertas/colegio/:colegio_id',          permitirRoles('admin', 'director'),            ctrl.alertasAsistencia);
router.get('/hoy/docente/:docente_id',             permitirRoles('docente', 'admin'),             ctrl.resumenHoyDocente);

module.exports = router;
