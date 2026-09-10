const express = require('express');
const router = express.Router();
const { login, me, subirFotoPerfil, solicitarReset, resetearPassword } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

router.post('/login',            login);
router.post('/solicitar-reset',  solicitarReset);
router.post('/resetear-password', resetearPassword);
router.get('/me', verificarToken, me);
router.post('/foto', verificarToken, subirFotoPerfil);

module.exports = router;
