const express = require('express');
const router = express.Router();
const { opciones, listar, crear, actualizar, eliminar } = require('../controllers/eventoController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);

router.get('/opciones', permitirRoles('admin', 'director'), permitirModulo('agenda_gestion'), opciones);
router.get('/',         listar);
router.post('/',        permitirRoles('admin', 'director'), permitirModulo('agenda_gestion'), crear);
router.put('/:id',      permitirRoles('admin', 'director'), permitirModulo('agenda_gestion'), actualizar);
router.delete('/:id',   permitirRoles('admin', 'director'), permitirModulo('agenda_gestion'), eliminar);

module.exports = router;
