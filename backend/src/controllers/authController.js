const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const db     = require('../database');
const { enviarEmail } = require('../services/emailService');
const { registrarAuditoria } = require('../utils/auditoria');

const uploadsDirUsuarios = path.join(__dirname, '../../uploads/usuarios');
if (!fs.existsSync(uploadsDirUsuarios)) fs.mkdirSync(uploadsDirUsuarios, { recursive: true });

const uploadFotoPerfil = multer({
  storage: multer.diskStorage({
    destination: uploadsDirUsuarios,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `usuario_${req.usuario.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  },
}).single('foto');

async function enviarEmailReset(destinatario, nombre, token) {
  const enlace = `${process.env.FRONTEND_URL || 'https://playfesor.co'}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="color:#667eea;margin:0;font-size:24px">Playfesor</h2>
        <p style="color:#888;font-size:13px;margin:4px 0 0">Plataforma Educativa</p>
      </div>
      <h3 style="color:#333;font-size:18px">Hola, ${nombre}</h3>
      <p style="color:#555;line-height:1.6">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${enlace}" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Restablecer contraseña
        </a>
      </div>
      <p style="color:#999;font-size:13px;line-height:1.5">
        Este enlace expira en <strong>30 minutos</strong>.<br/>
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:12px;text-align:center;margin:0">Playfesor · playfesor.co</p>
    </div>
  `;

  return enviarEmail({
    destinatario,
    asunto: 'Restablecer tu contraseña — Playfesor',
    html,
  });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const [filas] = await db.query(
      `SELECT u.id, u.nombre, u.email, u.password, u.rol, u.colegio_id, u.activo,
              u.grupo_dirigido_id, u.foto_url, u.cargo, u.password_actualizada_en,
              c.dias_rotacion_password
       FROM usuarios u
       LEFT JOIN colegios c ON c.id = u.colegio_id
       WHERE u.email = ?`,
      [email]
    );

    if (filas.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = filas[0];

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Usuario inactivo. Contacta al administrador.' });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Rotación de contraseña: si el colegio la exige y ya venció, se avisa en
    // la respuesta del login — el frontend bloquea la navegación hasta que
    // la cambie, pero la sesión sí queda iniciada (evita un segundo flujo de
    // autenticación solo para esto).
    let debeCambiarPassword = false;
    if (
      ['admin', 'director', 'docente', 'orientador'].includes(usuario.rol) &&
      usuario.dias_rotacion_password && usuario.password_actualizada_en
    ) {
      const limite = new Date(usuario.password_actualizada_en);
      limite.setDate(limite.getDate() + usuario.dias_rotacion_password);
      debeCambiarPassword = limite < new Date();
    }

    const payload = {
      id: usuario.id,
      rol: usuario.rol,
      colegio_id: usuario.colegio_id,
      nombre: usuario.nombre,
      cargo: usuario.cargo || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    // Solo se audita el inicio de sesión de roles con acceso administrativo:
    // registrar cada login de estudiante/docente saturaría la bitácora sin aportar valor.
    if (['director', 'admin', 'orientador'].includes(usuario.rol) && usuario.colegio_id) {
      registrarAuditoria({
        colegio_id: usuario.colegio_id, usuario_id: usuario.id,
        usuario_nombre: usuario.nombre, usuario_rol: usuario.rol,
        accion: 'inicio_sesion', entidad: 'usuario', entidad_id: usuario.id,
      });
    }

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        colegio_id: usuario.colegio_id,
        grupo_dirigido_id: usuario.grupo_dirigido_id,
        foto_url: usuario.foto_url,
        cargo: usuario.cargo || null,
        debe_cambiar_password: debeCambiarPassword,
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// GET /api/auth/me — devuelve los datos del usuario autenticado
async function me(req, res) {
  try {
    const [filas] = await db.query(
      'SELECT id, nombre, email, rol, colegio_id, activo, creado_en, grupo_dirigido_id, foto_url, cargo FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (filas.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ data: filas[0] });
  } catch (err) {
    console.error('Error en me:', err);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
}

// POST /api/auth/foto — el usuario autenticado sube su propia foto de perfil
async function subirFotoPerfil(req, res) {
  uploadFotoPerfil(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    try {
      const [[actual]] = await db.query('SELECT foto_url FROM usuarios WHERE id = ?', [req.usuario.id]);

      if (actual?.foto_url) {
        const anterior = path.join(__dirname, '../..', actual.foto_url);
        if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
      }

      const foto_url = `/uploads/usuarios/${req.file.filename}`;
      await db.query('UPDATE usuarios SET foto_url = ? WHERE id = ?', [foto_url, req.usuario.id]);
      res.json({ data: { foto_url } });
    } catch (dbErr) {
      console.error('Error al guardar la foto de perfil:', dbErr);
      res.status(500).json({ error: 'Error al guardar la foto de perfil' });
    }
  });
}

// POST /api/auth/solicitar-reset — pide enlace de recuperación
async function solicitarReset(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El correo es obligatorio' });

  try {
    const [filas] = await db.query(
      'SELECT id, nombre, activo FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]
    );

    // Respuesta genérica para no revelar si el email existe
    const respuesta = { mensaje: 'Si el correo está registrado recibirás un enlace en los próximos minutos.' };

    if (filas.length === 0 || !filas[0].activo) return res.json(respuesta);

    const usuario = filas[0];
    const token   = crypto.randomBytes(32).toString('hex');
    const expiry  = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.query(
      'UPDATE usuarios SET reset_token = ?, reset_expiry = ? WHERE id = ?',
      [token, expiry, usuario.id]
    );

    await enviarEmailReset(email, usuario.nombre, token);
    res.json(respuesta);
  } catch (err) {
    console.error('Error en solicitar reset:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud. Intenta de nuevo.' });
  }
}

// POST /api/auth/resetear-password — actualiza contraseña con token válido
async function resetearPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const [filas] = await db.query(
      'SELECT id FROM usuarios WHERE reset_token = ? AND reset_expiry > NOW()', [token]
    );

    if (filas.length === 0) {
      return res.status(400).json({ error: 'El enlace no es válido o ya expiró. Solicita uno nuevo.' });
    }

    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE usuarios SET password = ?, reset_token = NULL, reset_expiry = NULL, password_actualizada_en = NOW() WHERE id = ?',
      [hash, filas[0].id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en resetear password:', err);
    res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
}

// PUT /api/auth/cambiar-password — usuario autenticado cambia su propia contraseña
// (usado tanto para el cambio voluntario como para la rotación obligatoria)
async function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;
  if (!password_actual || !password_nueva) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son obligatorias' });
  }
  if (password_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [[usuario]] = await db.query('SELECT password FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordCorrecta = await bcrypt.compare(password_actual, usuario.password);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    const hash = await bcrypt.hash(password_nueva, 12);
    await db.query(
      'UPDATE usuarios SET password = ?, password_actualizada_en = NOW() WHERE id = ?',
      [hash, req.usuario.id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

module.exports = { login, me, subirFotoPerfil, solicitarReset, resetearPassword, cambiarPassword };
