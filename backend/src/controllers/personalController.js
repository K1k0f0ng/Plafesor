const bcrypt = require('bcryptjs');
const db = require('../database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { registrarAuditoria } = require('../utils/auditoria');
const { CARGOS_VALIDOS } = require('../utils/cargos');

const uploadsDirPersonal = path.join(__dirname, '../../uploads/personal');
if (!fs.existsSync(uploadsDirPersonal)) fs.mkdirSync(uploadsDirPersonal, { recursive: true });

const uploadFoto = multer({
  storage: multer.diskStorage({
    destination: uploadsDirPersonal,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `personal_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
}).single('foto');

const TIPOS_DOC_VALIDOS = ['CC', 'CE'];
const ROLES_SISTEMA_VALIDOS = ['admin', 'director'];

function normalizarTipoDocumento(v) {
  if (!v) return null;
  const up = String(v).trim().toUpperCase();
  return TIPOS_DOC_VALIDOS.includes(up) ? up : null;
}
function normalizarFecha(v) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? v : null;
}
function normalizarCargo(v) {
  return v && CARGOS_VALIDOS.includes(v) ? v : null;
}

async function guardarDatosPersonal(conn, usuarioId, datos) {
  const {
    fecha_nacimiento, telefono_residencial, direccion_residencial,
    telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
    fecha_ingreso_caja_compensacion, fecha_ingreso_institucion,
  } = datos;

  await conn.query(
    `INSERT INTO personal_datos
       (usuario_id, fecha_nacimiento, telefono_residencial, direccion_residencial,
        telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
        fecha_ingreso_caja_compensacion, fecha_ingreso_institucion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       fecha_nacimiento = VALUES(fecha_nacimiento),
       telefono_residencial = VALUES(telefono_residencial), direccion_residencial = VALUES(direccion_residencial),
       telefono_oficina = VALUES(telefono_oficina), direccion_oficina = VALUES(direccion_oficina),
       telefono_celular = VALUES(telefono_celular), telefono_otro = VALUES(telefono_otro),
       fecha_ingreso_caja_compensacion = VALUES(fecha_ingreso_caja_compensacion),
       fecha_ingreso_institucion = VALUES(fecha_ingreso_institucion)`,
    [
      usuarioId, normalizarFecha(fecha_nacimiento), telefono_residencial || null, direccion_residencial || null,
      telefono_oficina || null, direccion_oficina || null, telefono_celular || null, telefono_otro || null,
      normalizarFecha(fecha_ingreso_caja_compensacion), normalizarFecha(fecha_ingreso_institucion),
    ]
  );
}

// GET /api/personal — personal administrativo/directivo del colegio (no docentes ni estudiantes)
async function listar(req, res) {
  try {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre, u.email, u.rol, u.cargo, u.activo, u.foto_url,
             u.tipo_documento, u.numero_documento,
             pd.fecha_nacimiento, pd.telefono_residencial, pd.direccion_residencial,
             pd.telefono_oficina, pd.direccion_oficina, pd.telefono_celular, pd.telefono_otro,
             pd.fecha_ingreso_caja_compensacion, pd.fecha_ingreso_institucion
      FROM usuarios u
      LEFT JOIN personal_datos pd ON pd.usuario_id = u.id
      WHERE u.colegio_id = ? AND u.rol IN ('admin', 'director')
      ORDER BY u.nombre ASC
    `, [req.usuario.colegio_id]);
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar personal:', err);
    res.status(500).json({ error: 'Error al obtener el personal del colegio' });
  }
}

// POST /api/personal
async function crear(req, res) {
  const {
    nombres, apellidos, email, password, rol, cargo, tipo_documento, numero_documento,
    fecha_nacimiento, telefono_residencial, direccion_residencial,
    telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
    fecha_ingreso_caja_compensacion, fecha_ingreso_institucion,
  } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombres?.trim() || !apellidos?.trim() || !email || !password) {
    return res.status(400).json({ error: 'Nombres, apellidos, correo y contraseña son obligatorios' });
  }
  if (!ROLES_SISTEMA_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'El rol del sistema debe ser Administrador o Director' });
  }

  const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`.trim();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO usuarios (nombre, email, password, rol, colegio_id, cargo, tipo_documento, numero_documento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombreCompleto, email, hash, rol, colegio_id, normalizarCargo(cargo), normalizarTipoDocumento(tipo_documento), numero_documento || null]
    );
    const usuarioId = result.insertId;

    await guardarDatosPersonal(conn, usuarioId, {
      fecha_nacimiento, telefono_residencial, direccion_residencial,
      telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
      fecha_ingreso_caja_compensacion, fecha_ingreso_institucion,
    });

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'personal_creado', entidad: 'usuario', entidad_id: usuarioId,
      detalle: { nombre: nombreCompleto, email, rol, cargo: normalizarCargo(cargo) },
    });

    res.status(201).json({ mensaje: 'Usuario creado', data: { id: usuarioId, nombre: nombreCompleto, email } });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error('Error al crear personal:', err);
    res.status(500).json({ error: 'Error al crear el usuario' });
  } finally {
    conn.release();
  }
}

// PUT /api/personal/:id
async function actualizar(req, res) {
  const { id } = req.params;
  const {
    nombres, apellidos, email, rol, cargo, tipo_documento, numero_documento,
    fecha_nacimiento, telefono_residencial, direccion_residencial,
    telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
    fecha_ingreso_caja_compensacion, fecha_ingreso_institucion,
  } = req.body;
  const colegio_id = req.usuario.colegio_id;

  if (!nombres?.trim() || !apellidos?.trim() || !email) {
    return res.status(400).json({ error: 'Nombres, apellidos y correo son obligatorios' });
  }
  if (!ROLES_SISTEMA_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'El rol del sistema debe ser Administrador o Director' });
  }

  const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`.trim();

  const conn = await db.getConnection();
  try {
    const [[existente]] = await conn.query(
      `SELECT id FROM usuarios WHERE id = ? AND colegio_id = ? AND rol IN ('admin','director')`,
      [id, colegio_id]
    );
    if (!existente) return res.status(404).json({ error: 'Usuario no encontrado' });

    await conn.beginTransaction();

    await conn.query(
      `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, cargo = ?, tipo_documento = ?, numero_documento = ? WHERE id = ?`,
      [nombreCompleto, email, rol, normalizarCargo(cargo), normalizarTipoDocumento(tipo_documento), numero_documento || null, id]
    );

    await guardarDatosPersonal(conn, id, {
      fecha_nacimiento, telefono_residencial, direccion_residencial,
      telefono_oficina, direccion_oficina, telefono_celular, telefono_otro,
      fecha_ingreso_caja_compensacion, fecha_ingreso_institucion,
    });

    await conn.commit();

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'personal_editado', entidad: 'usuario', entidad_id: parseInt(id),
      detalle: { nombre: nombreCompleto, email, rol, cargo: normalizarCargo(cargo) },
    });

    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    console.error('Error al actualizar personal:', err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  } finally {
    conn.release();
  }
}

// DELETE /api/personal/:id (desactiva)
async function eliminar(req, res) {
  const { id } = req.params;
  const colegio_id = req.usuario.colegio_id;
  try {
    const [[usuario]] = await db.query(
      `SELECT id, nombre FROM usuarios WHERE id = ? AND colegio_id = ? AND rol IN ('admin','director')`,
      [id, colegio_id]
    );
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    await db.query('UPDATE usuarios SET activo = FALSE WHERE id = ?', [id]);

    registrarAuditoria({
      colegio_id, usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre, usuario_rol: req.usuario.rol,
      accion: 'personal_desactivado', entidad: 'usuario', entidad_id: parseInt(id),
      detalle: { nombre: usuario.nombre },
    });

    res.json({ mensaje: 'Usuario desactivado' });
  } catch (err) {
    console.error('Error al desactivar personal:', err);
    res.status(500).json({ error: 'Error al desactivar el usuario' });
  }
}

// POST /api/personal/:id/foto
async function subirFoto(req, res) {
  uploadFoto(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const { id } = req.params;
    try {
      const [[usuario]] = await db.query(
        `SELECT id, foto_url FROM usuarios WHERE id = ? AND colegio_id = ? AND rol IN ('admin','director')`,
        [id, req.usuario.colegio_id]
      );
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (usuario.foto_url) {
        const anterior = path.join(__dirname, '../..', usuario.foto_url);
        if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
      }

      const foto_url = `/uploads/personal/${req.file.filename}`;
      await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [foto_url, id]);
      res.json({ data: { foto_url } });
    } catch (dbErr) {
      console.error('Error al guardar la foto:', dbErr);
      res.status(500).json({ error: 'Error al guardar la foto' });
    }
  });
}

module.exports = { listar, crear, actualizar, eliminar, subirFoto };
