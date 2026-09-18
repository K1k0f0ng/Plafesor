const express = require('express');
const router = express.Router();
const { verificarToken, permitirRoles } = require('../middlewares/auth');
const {
  cargarContextoBienestar, requiereModuloActivo, requiereAdminOEquipo, requiereEquipo, requiereRemitente,
} = require('../middlewares/bienestarAcceso');
const config = require('../controllers/bienestar/configuracionController');
const remisiones = require('../controllers/bienestar/remisionesController');
const casos = require('../controllers/bienestar/casosController');
const seguimientos = require('../controllers/bienestar/seguimientosController');
const adjuntos = require('../controllers/bienestar/adjuntosController');

// Módulo Bienestar y Orientación — diseño en docs/BIENESTAR_MAPA_FUNCIONAL.md.
// Toda ruta pasa por sesión + contexto (config del colegio y nivel en el equipo).
router.use(verificarToken);
router.use(cargarContextoBienestar);

// Cualquier usuario autenticado: el menú pregunta qué mostrar
router.get('/estado', config.estado);

// Configuración y equipo: solo admin (funciona aunque el módulo esté apagado,
// porque desde aquí se activa)
router.get('/configuracion',  permitirRoles('admin'), config.obtener);
router.put('/configuracion',  permitirRoles('admin'), config.guardar);
router.put('/equipo',         permitirRoles('admin'), config.guardarEquipo);
router.get('/equipo/miembros', requiereModuloActivo, requiereEquipo(), config.miembrosEquipo);

// Catálogos: leerlos lo necesita también quien remite (solo con el módulo
// activo); admin y equipo los ven siempre, para preparar todo antes de activar.
function activoSalvoAdminOEquipo(req, res, next) {
  if (req.usuario.rol === 'admin' || req.bienestar.nivel) return next();
  return requiereModuloActivo(req, res, next);
}
router.get('/catalogos',       permitirRoles('admin', 'orientador', 'docente', 'director'), activoSalvoAdminOEquipo, config.listarCatalogos);
router.post('/catalogos',      requiereAdminOEquipo('lider'), config.crearCatalogo);
router.patch('/catalogos/:id', requiereAdminOEquipo('lider'), config.editarCatalogo);

// Remisiones — quien remite (docente según configuración, director, equipo)
router.get('/remisiones/estudiantes', requiereModuloActivo, requiereRemitente, remisiones.estudiantesDisponibles);
router.post('/remisiones',            requiereModuloActivo, requiereRemitente, remisiones.crear);
router.get('/remisiones/mias',        requiereModuloActivo, permitirRoles('docente', 'director', 'orientador'), remisiones.mias);
// Remisiones — bandeja del equipo de orientación
router.get('/remisiones',                 requiereModuloActivo, requiereEquipo(), remisiones.bandeja);
router.get('/remisiones/:id',             requiereModuloActivo, requiereEquipo(), remisiones.detalle);
router.patch('/remisiones/:id/recibir',   requiereModuloActivo, requiereEquipo(), remisiones.recibir);
router.patch('/remisiones/:id/revision',  requiereModuloActivo, requiereEquipo(), remisiones.enRevision);
router.patch('/remisiones/:id/archivar',  requiereModuloActivo, requiereEquipo(), remisiones.archivar);
router.patch('/remisiones/:id/devolucion', requiereModuloActivo, requiereEquipo(), remisiones.devolucion);
router.post('/remisiones/:id/vincular',   requiereModuloActivo, requiereEquipo(), casos.vincularRemision);
router.post('/remisiones/:id/adjuntos',   requiereModuloActivo, permitirRoles('docente', 'director', 'orientador'), adjuntos.subirARemision);

// Casos — solo equipo de orientación (el acceso fino a cada caso lo decide casoAccesible)
router.get('/casos',                  requiereModuloActivo, requiereEquipo(), casos.listar);
router.post('/casos',                 requiereModuloActivo, requiereEquipo(), casos.abrir);
router.get('/casos/:id',              requiereModuloActivo, requiereEquipo(), casos.detalle);
router.patch('/casos/:id',            requiereModuloActivo, requiereEquipo(), casos.editar);
router.post('/casos/:id/asignar',     requiereModuloActivo, requiereEquipo('lider'), casos.reasignar);
router.post('/casos/:id/cerrar',      requiereModuloActivo, requiereEquipo(), casos.cerrar);
router.post('/casos/:id/reabrir',     requiereModuloActivo, requiereEquipo('lider'), casos.reabrir);
router.post('/casos/:id/seguimientos', requiereModuloActivo, requiereEquipo(), seguimientos.crear);
router.post('/casos/:id/compromisos', requiereModuloActivo, requiereEquipo(), seguimientos.crearCompromiso);
router.post('/casos/:id/adjuntos',    requiereModuloActivo, requiereEquipo(), adjuntos.subirACaso);
router.patch('/seguimientos/:id',     requiereModuloActivo, requiereEquipo(), seguimientos.editar);
router.get('/seguimientos/:id/nota-privada', requiereModuloActivo, requiereEquipo(), seguimientos.notaPrivada);
router.patch('/compromisos/:id',      requiereModuloActivo, requiereEquipo(), seguimientos.editarCompromiso);
router.get('/adjuntos/:id/descargar', requiereModuloActivo, permitirRoles('docente', 'director', 'orientador'), adjuntos.descargar);

// Director: solo el estado de los acompañamientos, sin contenido
router.get('/acompanamientos',        requiereModuloActivo, permitirRoles('director'), casos.estadoParaDirector);

// Bitácora del módulo (sin contenido): admin o líder
router.get('/auditoria',       requiereAdminOEquipo('lider'), config.listarAuditoria);

module.exports = router;
