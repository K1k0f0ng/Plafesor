const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/grupoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('institucion_academica'));

router.get('/',                                   permitirRoles('admin', 'docente', 'director'), ctrl.listar);
router.post('/',                                  permitirRoles('admin', 'director'), ctrl.crear);
router.put('/:id',                                permitirRoles('admin', 'director'), ctrl.actualizar);
router.get('/:id/estudiantes',                    permitirRoles('admin', 'director'), ctrl.listarEstudiantes);
router.delete('/:id/estudiante/:estudianteId',    permitirRoles('admin', 'director'), ctrl.quitarEstudiante);
router.delete('/:id',                             permitirRoles('admin', 'director'), ctrl.eliminar);

module.exports = router;
