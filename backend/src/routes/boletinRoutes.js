const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/boletinController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('boletines'));

router.get('/mis-grupos',                                  permitirRoles('docente', 'director', 'admin'), ctrl.getMisGrupos);
router.get('/grupo/:grupo_id/periodo/:periodo',            permitirRoles('docente', 'director', 'admin'), ctrl.getEstudiantesGrupo);
router.get('/grupo/:grupo_id/periodo/:periodo/masivo',     permitirRoles('docente', 'director', 'admin'), ctrl.getBoletinMasivoGrupo);
router.get('/grupo/:grupo_id/periodo/:periodo/pdf',        permitirRoles('docente', 'director', 'admin'), ctrl.getPDFGrupo);
router.get('/estudiante/:estudiante_id',                   permitirRoles('docente', 'director', 'admin'), ctrl.getBoletinEstudiante);
router.get('/pdf/estudiante/:estudiante_id',               permitirRoles('docente', 'director', 'admin'), ctrl.getPDFEstudiante);

module.exports = router;
