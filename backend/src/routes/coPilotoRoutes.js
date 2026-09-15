const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/coPilotoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('copiloto_ia'));

router.post('/colegio/:colegio_id',   permitirRoles('admin', 'director'),        ctrl.preguntar);
router.post('/docente/:docente_id',  permitirRoles('admin', 'docente', 'director'), ctrl.preguntarDocente);

module.exports = router;
