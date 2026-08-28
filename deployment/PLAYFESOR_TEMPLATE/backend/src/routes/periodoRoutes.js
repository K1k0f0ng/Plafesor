const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/periodoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/colegio/:colegio_id',        permitirRoles('admin', 'director', 'docente'), ctrl.listar);
router.get('/colegio/:colegio_id/activo', permitirRoles('admin', 'director', 'docente', 'estudiante', 'padre'), ctrl.obtenerActivo);
router.post('/',                          permitirRoles('admin'), ctrl.crear);
router.put('/:id',                        permitirRoles('admin'), ctrl.actualizar);
router.put('/:id/activar',               permitirRoles('admin'), ctrl.activar);
router.delete('/:id',                    permitirRoles('admin'), ctrl.eliminar);

module.exports = router;
