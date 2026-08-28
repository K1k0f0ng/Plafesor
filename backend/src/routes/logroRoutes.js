const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/logroController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);
router.get('/mis-logros', permitirRoles('estudiante'), ctrl.misLogros);

module.exports = router;
