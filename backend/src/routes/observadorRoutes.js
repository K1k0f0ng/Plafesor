const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/observadorController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('observador_academico'));

router.get('/colegio/:colegio_id/grupos-materias', permitirRoles('admin', 'director'), ctrl.listarGruposYMaterias);
router.post('/grupo/:grupo_id/materia/:materia_id', permitirRoles('admin', 'director'), ctrl.generarObservacion);

module.exports = router;
