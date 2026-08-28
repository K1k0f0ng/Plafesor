const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/colegioController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);
router.use(permitirRoles('admin'));

router.get('/',           ctrl.listar);
router.put('/:id',        ctrl.actualizar);
router.post('/:id/logo',  ctrl.subirLogo);

module.exports = router;
