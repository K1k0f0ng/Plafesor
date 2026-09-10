const db   = require('../database');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');

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
async function actualizar(req, res) {
  const { nombre, ciudad, lema } = req.body;
  if (parseInt(req.params.id) !== req.usuario.colegio_id) {
    return res.status(403).json({ error: 'No puedes editar otro colegio' });
  }
  try {
    await db.query(
      'UPDATE colegios SET nombre = COALESCE(?, nombre), ciudad = COALESCE(?, ciudad), lema = ? WHERE id = ?',
      [nombre || null, ciudad || null, lema || null, req.usuario.colegio_id]
    );
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
