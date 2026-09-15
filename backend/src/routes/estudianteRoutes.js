const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/estudianteController');
const fichaMedicaCtrl = require('../controllers/fichaMedicaController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/',              permitirRoles('admin', 'docente'), ctrl.listar);
router.post('/',             permitirRoles('admin'), ctrl.crear);
router.post('/importar',     permitirRoles('admin'), ctrl.importar);
router.post('/fotos-masivo', permitirRoles('admin'), ctrl.subirFotosMasivo);
router.put('/:id',           permitirRoles('admin'), ctrl.actualizar);
router.delete('/:id',        permitirRoles('admin'), ctrl.eliminar);
router.get('/:id/historial', permitirRoles('admin', 'docente', 'director', 'estudiante', 'padre'), ctrl.historial);
router.get('/:id/ficha',     permitirRoles('admin', 'docente', 'director'), ctrl.ficha);
router.post('/:id/foto',     permitirRoles('admin'), ctrl.subirFoto);
router.get('/:id/ficha-medica', permitirRoles('admin', 'docente', 'director', 'padre'), fichaMedicaCtrl.obtener);
router.put('/:id/ficha-medica', permitirRoles('admin', 'director'), fichaMedicaCtrl.guardar);

module.exports = router;
