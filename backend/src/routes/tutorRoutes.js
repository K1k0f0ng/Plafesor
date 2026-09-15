const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/tutorController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const { permitirModulo } = require('../utils/modulos');

router.use(verificarToken);
router.use(permitirModulo('tutor_ia'));

router.post('/preguntar', permitirRoles('estudiante'), ctrl.preguntar);

module.exports = router;
