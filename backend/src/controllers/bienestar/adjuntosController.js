const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../../database');
const { cifrar, descifrar, cifrarBuffer, descifrarBuffer } = require('../../utils/cifrado');
const { registrarBienestar } = require('../../utils/bienestarAuditoria');
const { casoAccesible } = require('../../middlewares/bienestarAcceso');
const { remisionVisible } = require('./remisionesController');
const { ABIERTOS } = require('./casosController');

// Adjuntos privados del módulo Bienestar (remisiones y casos).
// - Se guardan CIFRADOS en uploads_privados/bienestar/<colegio>/ con nombre
//   aleatorio; nunca en /uploads (que se sirve públicamente).
// - El nombre original también va cifrado en la base de datos.
// - Solo se descargan a través de la API, verificando permisos cada vez.

const DIR_BASE = path.join(__dirname, '../../../uploads_privados/bienestar');
const TIPOS_PERMITIDOS = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVOS = 5;

const recibirArchivos = multer({
  storage: multer.memoryStorage(),   // en memoria: se cifra antes de tocar el disco
  limits: { fileSize: MAX_BYTES, files: MAX_ARCHIVOS },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (TIPOS_PERMITIDOS[ext]) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido (PDF, imagen, Word o Excel)'));
  },
}).array('archivos', MAX_ARCHIVOS);

function recibir(req, res) {
  return new Promise((resolve) => {
    recibirArchivos(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Cada archivo puede pesar máximo 5 MB'
          : err.code === 'LIMIT_FILE_COUNT' ? `Máximo ${MAX_ARCHIVOS} archivos por vez` : err.message;
        res.status(400).json({ error: msg });
        return resolve(false);
      }
      if (!req.files?.length) { res.status(400).json({ error: 'No se recibió ningún archivo' }); return resolve(false); }
      resolve(true);
    });
  });
}

async function guardarArchivos(req, { remision_id = null, caso_id = null }) {
  const colegio = req.usuario.colegio_id;
  const dir = path.join(DIR_BASE, String(colegio));
  fs.mkdirSync(dir, { recursive: true });
  const ids = [];
  for (const f of req.files) {
    const ext = path.extname(f.originalname).toLowerCase();
    const nombreDisco = `${crypto.randomBytes(16).toString('hex')}.bin`;
    fs.writeFileSync(path.join(dir, nombreDisco), cifrarBuffer(f.buffer));
    const [ins] = await db.query(
      `INSERT INTO bienestar_adjuntos (colegio_id, remision_id, caso_id, archivo_ruta, nombre_original, tipo_mime, tamano, subido_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [colegio, remision_id, caso_id, `${colegio}/${nombreDisco}`, cifrar(f.originalname.slice(0, 200)), TIPOS_PERMITIDOS[ext], f.size, req.usuario.id]
    );
    ids.push(ins.insertId);
  }
  return ids;
}

function errorComun(res, err, mensaje) {
  if (err.code === 'SIN_CLAVE_CIFRADO') return res.status(503).json({ error: 'El módulo no está listo para guardar información.' });
  console.error(`Bienestar: ${mensaje}:`, err.message);
  return res.status(500).json({ error: mensaje });
}

// POST /api/bienestar/casos/:id/adjuntos — equipo con acceso al caso
async function subirACaso(req, res) {
  const casoId = parseInt(req.params.id);
  try {
    const caso = await casoAccesible(req, casoId);
    if (!caso) { registrarBienestar(req, 'acceso_denegado', 'adjunto', null, casoId); return res.status(404).json({ error: 'Caso no encontrado' }); }
    if (!ABIERTOS.includes(caso.estado)) return res.status(409).json({ error: 'El caso está cerrado' });
    if (!(await recibir(req, res))) return;
    const ids = await guardarArchivos(req, { caso_id: casoId });
    ids.forEach(id => registrarBienestar(req, 'adjunto_subido', 'adjunto', id, casoId));
    res.status(201).json({ mensaje: 'Documentos guardados', data: { ids } });
  } catch (err) {
    errorComun(res, err, 'Error al guardar los documentos');
  }
}

// POST /api/bienestar/remisiones/:id/adjuntos — el propio remitente, mientras esté pendiente
async function subirARemision(req, res) {
  const remisionId = parseInt(req.params.id);
  if (!req.bienestar.config?.adjuntos_remision) {
    return res.status(403).json({ error: 'El colegio no permite adjuntos en las remisiones' });
  }
  try {
    const [[r]] = await db.query(
      'SELECT id, remitente_id, estado FROM bienestar_remisiones WHERE id = ? AND colegio_id = ?',
      [remisionId, req.usuario.colegio_id]
    );
    if (!r || r.remitente_id !== req.usuario.id) return res.status(404).json({ error: 'Remisión no encontrada' });
    if (r.estado !== 'pendiente') return res.status(409).json({ error: 'Solo se pueden adjuntar archivos mientras la remisión está pendiente' });
    if (!(await recibir(req, res))) return;
    const ids = await guardarArchivos(req, { remision_id: remisionId });
    ids.forEach(id => registrarBienestar(req, 'adjunto_subido', 'adjunto', id));
    res.status(201).json({ mensaje: 'Archivos adjuntados', data: { ids } });
  } catch (err) {
    errorComun(res, err, 'Error al adjuntar los archivos');
  }
}

// ¿Puede este usuario descargar el adjunto?
async function adjuntoAccesible(req, adj) {
  const u = req.usuario;
  if (adj.caso_id) return !!(await casoAccesible(req, adj.caso_id));
  if (adj.remision_id) {
    if (u.rol === 'orientador' && req.bienestar.nivel) {
      if (await remisionVisible(req, adj.remision_id)) return true;
      const [[r]] = await db.query('SELECT caso_id FROM bienestar_remisiones WHERE id = ?', [adj.remision_id]);
      return !!(r?.caso_id && (await casoAccesible(req, r.caso_id)));
    }
    return adj.subido_por === u.id;   // el remitente, solo lo que él mismo subió
  }
  return false;
}

// GET /api/bienestar/adjuntos/:id/descargar
async function descargar(req, res) {
  const id = parseInt(req.params.id);
  try {
    const [[adj]] = await db.query('SELECT * FROM bienestar_adjuntos WHERE id = ? AND colegio_id = ?', [id, req.usuario.colegio_id]);
    if (!adj || !(await adjuntoAccesible(req, adj))) {
      registrarBienestar(req, 'acceso_denegado', 'adjunto', id);
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    const ruta = path.join(DIR_BASE, adj.archivo_ruta);
    if (!ruta.startsWith(DIR_BASE) || !fs.existsSync(ruta)) return res.status(404).json({ error: 'El archivo ya no está disponible' });
    const contenido = descifrarBuffer(fs.readFileSync(ruta));
    if (!contenido) return res.status(500).json({ error: 'No se pudo abrir el documento' });

    registrarBienestar(req, 'adjunto_descargado', 'adjunto', id, adj.caso_id);
    const nombre = descifrar(adj.nombre_original) || 'documento';
    res.setHeader('Content-Type', adj.tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.send(contenido);
  } catch (err) {
    errorComun(res, err, 'Error al descargar el documento');
  }
}

module.exports = { subirACaso, subirARemision, descargar, adjuntoAccesible, TIPOS_PERMITIDOS };
