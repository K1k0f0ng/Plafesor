const express = require('express');
const router = express.Router();
const { opciones, listar, crear, actualizar, eliminar } = require('../controllers/eventoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/opciones', permitirRoles('admin', 'director'), opciones);
router.get('/',         listar);
router.post('/',        permitirRoles('admin', 'director'), crear);
router.put('/:id',      permitirRoles('admin', 'director'), actualizar);
router.delete('/:id',   permitirRoles('admin', 'director'), eliminar);

module.exports = router;
