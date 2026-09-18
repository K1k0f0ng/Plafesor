const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/actividadController');
const { verificarToken, permitirRoles } = require('../middlewares/auth');

router.use(verificarToken);

// Rutas específicas primero (antes de /:id)
router.get('/docente',      permitirRoles('docente'),                         ctrl.listarParaDocente);
router.get('/estudiante',   permitirRoles('estudiante'),                      ctrl.listarParaEstudiante);
router.post('/generar-ia',  permitirRoles('docente'),                         ctrl.generarConIA);
router.get('/mis-materias',      permitirRoles('docente', 'director', 'admin'), ctrl.misMaterias);
router.get('/libro',             permitirRoles('docente', 'director', 'admin'), ctrl.libroCalificaciones);
router.get('/porcentaje-disponible', permitirRoles('docente'),                  ctrl.porcentajeDisponible);
router.get('/componentes',       permitirRoles('docente', 'director', 'admin'), ctrl.getComponentes);
router.post('/componentes',      permitirRoles('docente'),                      ctrl.guardarComponentes);
router.post('/calificar-manual', permitirRoles('docente'),                      ctrl.calificarManual);
router.put('/calificar-manual/:id', permitirRoles('docente'),                   ctrl.editarCalificacionManual);
router.get('/banco',             permitirRoles('docente'),                      ctrl.listarBanco);

router.post('/entregas/:resultadoId/calificar', permitirRoles('docente'),                  ctrl.calificarEntrega);
router.get('/entregas/:resultadoId/archivo',    permitirRoles('docente', 'estudiante'),    ctrl.descargarEntrega);

router.get('/:id/pendientes',         permitirRoles('docente'),                    ctrl.obtenerPendientes);
router.get('/:id/entregas',           permitirRoles('docente'),                    ctrl.listarEntregas);
router.post('/:id/entregar',          permitirRoles('estudiante'),                 ctrl.entregarArchivo);
router.post('/:id/copiar',            permitirRoles('docente'),                    ctrl.copiarDelBanco);
router.post('/:id/generar-recuperacion', permitirRoles('estudiante'),              ctrl.generarRecuperacion);
router.get('/:id',                 permitirRoles('admin', 'docente', 'estudiante'), ctrl.obtener);
router.post('/',                   permitirRoles('docente'), ctrl.crear);
router.put('/:id',                 permitirRoles('docente'), ctrl.actualizar);
router.delete('/:id',              permitirRoles('docente'), ctrl.eliminar);
router.post('/:id/responder',      permitirRoles('estudiante'), ctrl.responder);
router.get('/:id/resultado',       permitirRoles('estudiante'), ctrl.obtenerResultado);

module.exports = router;
