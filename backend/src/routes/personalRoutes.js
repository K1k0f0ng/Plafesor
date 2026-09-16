const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/personalController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);
router.use(permitirRoles('admin', 'director'));

router.get('/',          ctrl.listar);
router.post('/',         ctrl.crear);
router.put('/:id',       ctrl.actualizar);
router.delete('/:id',    ctrl.eliminar);
router.post('/:id/foto', ctrl.subirFoto);

module.exports = router;
