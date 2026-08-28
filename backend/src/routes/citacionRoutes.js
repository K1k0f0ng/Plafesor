const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/citacionController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/mis-grupos',                permitirRoles('admin', 'docente', 'director'), ctrl.getMisGrupos);
router.get('/grupo/:grupo_id/estudiantes', permitirRoles('admin', 'docente', 'director'), ctrl.estudiantesDelGrupo);
router.post('/',                         permitirRoles('admin', 'docente', 'director'), ctrl.crear);
router.get('/estudiante/:id',            permitirRoles('admin', 'docente', 'director', 'estudiante', 'padre'), ctrl.listarPorEstudiante);
router.patch('/:id/estado',              permitirRoles('admin', 'docente', 'director'), ctrl.actualizarEstado);

module.exports = router;
