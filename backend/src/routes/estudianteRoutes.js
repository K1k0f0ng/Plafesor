const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/estudianteController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/',              permitirRoles('admin', 'docente'), ctrl.listar);
router.post('/',             permitirRoles('admin'), ctrl.crear);
router.post('/importar',     permitirRoles('admin'), ctrl.importar);
router.put('/:id',           permitirRoles('admin'), ctrl.actualizar);
router.delete('/:id',        permitirRoles('admin'), ctrl.eliminar);
router.get('/:id/historial', permitirRoles('admin', 'docente', 'director', 'estudiante', 'padre'), ctrl.historial);

module.exports = router;
