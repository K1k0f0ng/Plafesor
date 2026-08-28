const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/grupoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/',                                   permitirRoles('admin', 'docente'), ctrl.listar);
router.post('/',                                  permitirRoles('admin'), ctrl.crear);
router.get('/:id/estudiantes',                    permitirRoles('admin'), ctrl.listarEstudiantes);
router.delete('/:id/estudiante/:estudianteId',    permitirRoles('admin'), ctrl.quitarEstudiante);
router.delete('/:id',                             permitirRoles('admin'), ctrl.eliminar);

module.exports = router;
