const db = require('../database');
const { registrarBienestar } = require('../utils/bienestarAuditoria');

// Control de acceso del módulo Bienestar y Orientación.
//
// A diferencia de permitirModulo() (utils/modulos.js), que deja pasar si la
// verificación falla, aquí cualquier duda BLOQUEA: es información sensible de
// menores y un error técnico nunca debe abrir el acceso.
//
// El colegio siempre sale de la sesión (req.usuario.colegio_id), jamás de la
// URL ni del cuerpo de la petición.

async function obtenerConfiguracion(colegio_id) {
  const [[fila]] = await db.query('SELECT * FROM bienestar_configuracion WHERE colegio_id = ?', [colegio_id]);
  return fila || null;
}

async function obtenerNivelEquipo(usuario_id, colegio_id) {
  const [[fila]] = await db.query(
    'SELECT nivel FROM bienestar_equipo WHERE usuario_id = ? AND colegio_id = ? AND activo = TRUE',
    [usuario_id, colegio_id]
  );
  return fila ? fila.nivel : null;
}

// Carga en req.bienestar la configuración del colegio y el nivel del usuario
// en el equipo de orientación (null si no pertenece).
async function cargarContextoBienestar(req, res, next) {
  const u = req.usuario;
  if (!u || !u.colegio_id) return res.status(403).json({ error: 'No tienes acceso a este módulo' });
  try {
    const config = await obtenerConfiguracion(u.colegio_id);
    const nivel = u.rol === 'orientador' ? await obtenerNivelEquipo(u.id, u.colegio_id) : null;
    req.bienestar = { config, activo: !!config?.activo, nivel };
    next();
  } catch (err) {
    console.error('Bienestar: error al cargar contexto de acceso:', err.message);
    res.status(503).json({ error: 'No fue posible verificar tus permisos. Intenta de nuevo.' });
  }
}

function requiereModuloActivo(req, res, next) {
  if (!req.bienestar?.activo) {
    return res.status(403).json({ error: 'El módulo de Bienestar y Orientación no está activo en tu colegio' });
  }
  next();
}

// Solo orientadores que están en el equipo activo del colegio. Con niveles se
// restringe más: requiereEquipo('lider').
function requiereEquipo(...niveles) {
  return function (req, res, next) {
    const nivel = req.bienestar?.nivel;
    const permitido = req.usuario?.rol === 'orientador' && nivel && (niveles.length === 0 || niveles.includes(nivel));
    if (!permitido) {
      registrarBienestar(req, 'acceso_denegado', 'equipo');
      return res.status(403).json({ error: 'Esta sección es solo para el equipo de orientación' });
    }
    next();
  };
}

// Admin del colegio, o bien un orientador del equipo con alguno de los niveles dados.
function requiereAdminOEquipo(...niveles) {
  return function (req, res, next) {
    if (req.usuario?.rol === 'admin') return next();
    return requiereEquipo(...niveles)(req, res, next);
  };
}

// ¿Puede este usuario trabajar sobre el caso? Devuelve la fila del caso o null.
// Líder: cualquier caso de su colegio. Profesional: si es responsable o tiene
// una asignación vigente. Nadie más (ni admin, ni director, ni docente).
async function casoAccesible(req, caso_id) {
  const u = req.usuario;
  const nivel = req.bienestar?.nivel;
  if (u?.rol !== 'orientador' || !nivel) return null;
  const [[caso]] = await db.query(
    'SELECT * FROM bienestar_casos WHERE id = ? AND colegio_id = ?',
    [caso_id, u.colegio_id]
  );
  if (!caso) return null;
  if (nivel === 'lider') return caso;
  if (caso.responsable_id === u.id) return caso;
  const [[asignado]] = await db.query(
    'SELECT 1 FROM bienestar_caso_asignaciones WHERE caso_id = ? AND usuario_id = ? AND hasta IS NULL LIMIT 1',
    [caso_id, u.id]
  );
  return asignado ? caso : null;
}

// ¿Puede este usuario crear remisiones? Director siempre; orientador si está
// en el equipo; docente según la configuración (todos o solo directores de grupo).
async function puedeRemitir(req) {
  const u = req.usuario;
  const b = req.bienestar;
  if (!b?.activo) return false;
  if (u.rol === 'director') return true;
  if (u.rol === 'orientador') return !!b.nivel;
  if (u.rol !== 'docente') return false;
  if (b.config?.remiten !== 'directores_grupo') return true;
  const [[fila]] = await db.query('SELECT grupo_dirigido_id FROM usuarios WHERE id = ?', [u.id]);
  return !!fila?.grupo_dirigido_id;
}

function requiereRemitente(req, res, next) {
  puedeRemitir(req)
    .then(ok => {
      if (ok) return next();
      registrarBienestar(req, 'acceso_denegado', 'remision');
      res.status(403).json({ error: 'No tienes permiso para remitir a orientación' });
    })
    .catch(err => {
      console.error('Bienestar: error al verificar permiso de remisión:', err.message);
      res.status(503).json({ error: 'No fue posible verificar tus permisos. Intenta de nuevo.' });
    });
}

module.exports = {
  cargarContextoBienestar, requiereModuloActivo, requiereEquipo, requiereAdminOEquipo,
  casoAccesible, obtenerConfiguracion, obtenerNivelEquipo, puedeRemitir, requiereRemitente,
};
