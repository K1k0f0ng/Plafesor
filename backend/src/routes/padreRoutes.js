const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/padreController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/mis-hijos',          permitirRoles('padre'),              ctrl.misHijos);
router.get('/listar',             permitirRoles('admin'),              ctrl.listar);
router.post('/',                  permitirRoles('admin'),              ctrl.crear);
router.post('/:id/vincular',      permitirRoles('admin'),              ctrl.vincular);
router.delete('/:id',             permitirRoles('admin'),              ctrl.desactivar);

module.exports = router;
