const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mensajeMasivoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/destinatarios', permitirRoles('admin', 'docente', 'director'), ctrl.previsualizarDestinatarios);
router.post('/',             permitirRoles('admin', 'docente', 'director'), ctrl.crear);
router.get('/',               permitirRoles('admin', 'docente', 'director'), ctrl.listar);

module.exports = router;
