const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/docenteController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/',                    permitirRoles('admin', 'director'), ctrl.listar);
router.post('/',                   permitirRoles('admin'), ctrl.crear);
router.post('/asignar',            permitirRoles('admin', 'director'), ctrl.asignar);
router.get('/:id/asignaciones',    permitirRoles('admin', 'director', 'docente'), ctrl.obtenerAsignaciones);
router.put('/:id/grupo-dirigido',  permitirRoles('admin'), ctrl.actualizarGrupoDirigido);
router.delete('/asignacion/:id',   permitirRoles('admin', 'director'), ctrl.eliminarAsignacion);
router.put('/carga-academica/reasignar', permitirRoles('admin', 'director'), ctrl.reasignarCarga);
router.put('/clases/trasladar-masivo',   permitirRoles('admin', 'director'), ctrl.trasladarClases);
router.delete('/:id',              permitirRoles('admin'), ctrl.eliminar);

module.exports = router;
