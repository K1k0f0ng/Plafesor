const express = require('express');
const router  = express.Router();
const { verificarToken } = require('../middlewares/auth');
const { listar, marcarLeida, marcarTodasLeidas } = require('../controllers/notificacionController');

router.get('/',                 verificarToken, listar);
router.patch('/leer-todas',     verificarToken, marcarTodasLeidas);
router.patch('/:id/leer',       verificarToken, marcarLeida);

module.exports = router;
