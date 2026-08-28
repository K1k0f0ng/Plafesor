const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/horarioController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);
router.use(permitirRoles('docente'));

router.get('/mio',  ctrl.miHorario);
router.get('/hoy',  ctrl.clasesHoy);
router.post('/',    ctrl.guardar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
