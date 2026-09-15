const express = require('express');
const router = express.Router();
const { login, me, subirFotoPerfil, solicitarReset, resetearPassword, cambiarPassword } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

router.post('/login',            login);
router.post('/solicitar-reset',  solicitarReset);
router.post('/resetear-password', resetearPassword);
router.get('/me', verificarToken, me);
router.post('/foto', verificarToken, subirFotoPerfil);
router.put('/cambiar-password', verificarToken, cambiarPassword);

module.exports = router;
