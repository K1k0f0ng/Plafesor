const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/anotacionController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/grupo/:grupo_id/estudiantes', permitirRoles('docente'), ctrl.estudiantesDelGrupo);
router.post('/',                           permitirRoles('docente'), ctrl.crear);
router.get('/estudiante/:id',              permitirRoles('admin', 'docente', 'director', 'estudiante', 'padre'), ctrl.listarPorEstudiante);
router.delete('/:id',                      permitirRoles('admin', 'docente', 'director'), ctrl.eliminar);

module.exports = router;
