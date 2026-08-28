const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/briefingController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.get('/colegio/:colegio_id', permitirRoles('director', 'admin'), ctrl.obtener);

module.exports = router;
