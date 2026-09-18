const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/colegioController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);
router.use(permitirRoles('admin'));

router.get('/',              ctrl.listar);
router.get('/mis-colegios',  ctrl.misColegios);
router.post('/',             ctrl.crear);
router.put('/:id',           ctrl.actualizar);
router.post('/:id/logo',     ctrl.subirLogo);
router.post('/:id/cambiar',  ctrl.cambiar);

module.exports = router;
