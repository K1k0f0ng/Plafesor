const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mensajeController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

const ROLES = ['docente', 'director', 'admin', 'padre'];

router.use(verificarToken);
router.use(permitirRoles(...ROLES));

// Rutas específicas primero (antes de /:id)
router.get('/contactos',                 ctrl.listarContactos);
router.get('/no-leidos',                 ctrl.contarNoLeidos);
router.get('/adjuntos/:adjuntoId/archivo', ctrl.descargarAdjunto);

router.get('/',            ctrl.listar);
router.post('/',           ctrl.crear);
router.get('/:id',         ctrl.obtener);
router.put('/:id',         ctrl.actualizarBorrador);
router.delete('/:id',      ctrl.eliminarBorrador);
router.post('/:id/enviar', ctrl.enviarBorrador);
router.put('/:id/carpeta', ctrl.moverCarpeta);

module.exports = router;
