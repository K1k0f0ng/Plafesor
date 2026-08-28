const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/tutorController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

router.post('/preguntar', permitirRoles('estudiante'), ctrl.preguntar);

module.exports = router;
