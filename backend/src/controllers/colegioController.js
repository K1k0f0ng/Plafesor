const db   = require('../database');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');
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

module.exports = { listar, actualizar, subirLogo };
