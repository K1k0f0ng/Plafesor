const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/docenteController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/',                    permitirRoles('admin'), ctrl.listar);
router.post('/',                   permitirRoles('admin'), ctrl.crear);
router.post('/asignar',            permitirRoles('admin'), ctrl.asignar);
router.get('/:id/asignaciones',    permitirRoles('admin', 'docente'), ctrl.obtenerAsignaciones);
router.put('/:id/grupo-dirigido',  permitirRoles('admin'), ctrl.actualizarGrupoDirigido);
router.delete('/asignacion/:id',   permitirRoles('admin'), ctrl.eliminarAsignacion);
router.delete('/:id',              permitirRoles('admin'), ctrl.eliminar);

module.exports = router;
