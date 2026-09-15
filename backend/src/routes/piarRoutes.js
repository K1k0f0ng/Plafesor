const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/piarController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('piar'));

router.get('/colegio/:colegio_id',   permitirRoles('docente', 'director', 'admin'), ctrl.listarPorColegio);
router.get('/estudiante/:estudiante_id', permitirRoles('docente', 'director', 'admin'), ctrl.obtenerPorEstudiante);
router.post('/generar',              permitirRoles('docente', 'director', 'admin'), ctrl.generarBorrador);
router.put('/:id',                   permitirRoles('docente', 'director', 'admin'), ctrl.guardarEdicion);
router.put('/:id/estado',            permitirRoles('director', 'admin'),            ctrl.actualizarEstado);
router.get('/:id/pdf',               permitirRoles('docente', 'director', 'admin'), ctrl.descargarPDF);

module.exports = router;
