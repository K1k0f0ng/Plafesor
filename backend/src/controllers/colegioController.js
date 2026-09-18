const db   = require('../database');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');
const jwt    = require('jsonwebtoken');
const { registrarAuditoria } = require('../utils/auditoria');

const uploadsDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `colegio_${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp, svg)'));
  },
}).single('logo');

// GET /api/colegios — devuelve solo el colegio del admin autenticado
async function listar(req, res) {
  try {
    const [filas] = await db.query(
      'SELECT * FROM colegios WHERE id = ?',
      [req.usuario.colegio_id]
    );
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al obtener el colegio:', err);
    res.status(500).json({ error: 'Error al obtener el colegio' });
  }
}

// PUT /api/colegios/:id — actualiza solo si es el colegio del admin
const DIAS_ROTACION_VALIDOS = [60, 90, 180, 365];

async function actualizar(req, res) {
  const { nombre, ciudad, lema, dias_rotacion_password } = req.body;
  if (parseInt(req.params.id) !== req.usuario.colegio_id) {
    return res.status(403).json({ error: 'No puedes editar otro colegio' });
  }

  let diasRotacion = null;
  if (dias_rotacion_password !== undefined && dias_rotacion_password !== null && dias_rotacion_password !== '') {
    const n = parseInt(dias_rotacion_password);
    if (!DIAS_ROTACION_VALIDOS.includes(n)) {
      return res.status(400).json({ error: 'Días de rotación de contraseña inválidos' });
    }
    diasRotacion = n;
  }

  try {
    await db.query(
      'UPDATE colegios SET nombre = COALESCE(?, nombre), ciudad = COALESCE(?, ciudad), lema = ?, dias_rotacion_password = ? WHERE id = ?',
      [nombre || null, ciudad || null, lema || null, diasRotacion, req.usuario.colegio_id]
    );

    registrarAuditoria({
      colegio_id: req.usuario.colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'colegio_editado', entidad: 'colegio', entidad_id: req.usuario.colegio_id,
      detalle: { nombre, ciudad, lema },
    });

    res.json({ mensaje: 'Institución actualizada' });
  } catch (err) {
    console.error('Error al actualizar colegio:', err);
    res.status(500).json({ error: 'Error al actualizar la institución' });
  }
}

// POST /api/colegios/:id/logo — sube imagen de logo
async function subirLogo(req, res) {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    if (parseInt(req.params.id) !== req.usuario.colegio_id) {
      return res.status(403).json({ error: 'No puedes editar otro colegio' });
    }

    // Eliminar logo anterior con diferente extensión (si existe)
    const ext = path.extname(req.file.filename).toLowerCase();
    const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    exts.filter(e => e !== ext).forEach(e => {
      const old = path.join(uploadsDir, `colegio_${req.params.id}${e}`);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    });

    const logo_url = `/uploads/logos/${req.file.filename}`;
    try {
      await db.query('UPDATE colegios SET logo_url = ? WHERE id = ?', [logo_url, req.usuario.colegio_id]);
      res.json({ data: { logo_url } });
    } catch (dbErr) {
      console.error('Error al guardar logo:', dbErr);
      res.status(500).json({ error: 'Error al guardar el logo' });
    }
  });
}

// Quién puede crear colegios adicionales: solo los correos de la plataforma
// (variable ADMINS_PLATAFORMA en .env, separados por coma). Un admin normal
// de un colegio cliente no debe poder crear colegios por su cuenta.
function correosPlataforma() {
  return (process.env.ADMINS_PLATAFORMA || 'admin@playfesor.co')
    .split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
}

async function puedeCrearColegios(usuarioId) {
  const [[u]] = await db.query('SELECT email FROM usuarios WHERE id = ?', [usuarioId]);
  return !!u && correosPlataforma().includes(u.email.toLowerCase());
}

// Colegios a los que el admin tiene acceso: el activo + los de usuario_colegios
async function colegiosDelUsuario(usuarioId, colegioActivoId) {
  const [filas] = await db.query(
    `SELECT c.id, c.nombre, c.ciudad, c.logo_url
     FROM colegios c
     WHERE c.id = ? OR c.id IN (SELECT colegio_id FROM usuario_colegios WHERE usuario_id = ?)
     ORDER BY c.nombre`,
    [colegioActivoId, usuarioId]
  );
  return filas;
}

// GET /api/colegios/mis-colegios
async function misColegios(req, res) {
  try {
    const filas = await colegiosDelUsuario(req.usuario.id, req.usuario.colegio_id);
    res.json({
      data: filas.map(c => ({ ...c, actual: c.id === req.usuario.colegio_id })),
      puede_crear: await puedeCrearColegios(req.usuario.id),
    });
  } catch (err) {
    console.error('Error al listar colegios del usuario:', err);
    res.status(500).json({ error: 'Error al obtener tus colegios' });
  }
}

// POST /api/colegios — crea un colegio adicional y da acceso al admin que lo crea
async function crear(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const ciudad = (req.body.ciudad || '').trim();
  const lema   = (req.body.lema || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre del colegio es obligatorio' });
  if (nombre.length > 150) return res.status(400).json({ error: 'El nombre es demasiado largo' });

  try {
    if (!(await puedeCrearColegios(req.usuario.id))) {
      return res.status(403).json({ error: 'Tu cuenta no tiene permiso para crear colegios' });
    }
  } catch (err) {
    console.error('Error al verificar permiso de creación:', err);
    return res.status(500).json({ error: 'Error al crear el colegio' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO colegios (nombre, ciudad, lema) VALUES (?, ?, ?)',
      [nombre, ciudad || null, lema || null]
    );
    // Se registra también el colegio actual para poder volver a él después de cambiar
    const accesos = [[req.usuario.id, r.insertId]];
    if (req.usuario.colegio_id) accesos.push([req.usuario.id, req.usuario.colegio_id]);
    await conn.query('INSERT IGNORE INTO usuario_colegios (usuario_id, colegio_id) VALUES ?', [accesos]);
    await conn.commit();

    registrarAuditoria({
      colegio_id: r.insertId, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'colegio_creado', entidad: 'colegio', entidad_id: r.insertId,
      detalle: { nombre, ciudad, creado_desde_colegio: req.usuario.colegio_id },
    });

    res.status(201).json({ data: { id: r.insertId, nombre, ciudad: ciudad || null } });
  } catch (err) {
    await conn.rollback();
    console.error('Error al crear colegio:', err);
    res.status(500).json({ error: 'Error al crear el colegio' });
  } finally {
    conn.release();
  }
}

// POST /api/colegios/:id/cambiar — el admin pasa a administrar otro de sus colegios.
// Se actualiza usuarios.colegio_id (así el próximo login entra al mismo colegio)
// y se emite un token nuevo, porque todos los módulos leen colegio_id del token.
async function cambiar(req, res) {
  const destinoId = parseInt(req.params.id);
  if (!destinoId) return res.status(400).json({ error: 'Colegio inválido' });

  try {
    const permitidos = await colegiosDelUsuario(req.usuario.id, req.usuario.colegio_id);
    const destino = permitidos.find(c => c.id === destinoId);
    if (!destino) return res.status(403).json({ error: 'No tienes acceso a ese colegio' });

    await db.query('UPDATE usuarios SET colegio_id = ? WHERE id = ?', [destinoId, req.usuario.id]);

    const [[u]] = await db.query(
      'SELECT id, nombre, email, rol, colegio_id, grupo_dirigido_id, foto_url, cargo FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    const token = jwt.sign(
      { id: u.id, rol: u.rol, colegio_id: u.colegio_id, nombre: u.nombre, cargo: u.cargo || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    registrarAuditoria({
      colegio_id: destinoId, usuario_id: u.id,
      usuario_nombre: u.nombre, usuario_rol: u.rol,
      accion: 'colegio_cambiado', entidad: 'colegio', entidad_id: destinoId,
      detalle: { desde_colegio: req.usuario.colegio_id },
    });

    res.json({ token, usuario: { ...u, cargo: u.cargo || null, debe_cambiar_password: false } });
  } catch (err) {
    console.error('Error al cambiar de colegio:', err);
    res.status(500).json({ error: 'Error al cambiar de colegio' });
  }
}

module.exports = { listar, actualizar, subirLogo, misColegios, crear, cambiar };
