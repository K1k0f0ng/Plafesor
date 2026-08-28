const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../database');
const { enviarEmail } = require('../services/emailService');

async function enviarEmailReset(destinatario, nombre, token) {
  const nombreInstitucion = process.env.INSTITUCION_NOMBRE || 'la institución';
  const dominioInstitucion = process.env.INSTITUCION_DOMINIO || '';
  const colorPrimario = process.env.EMAIL_COLOR_PRIMARIO || '#667eea';
  const colorSecundario = process.env.EMAIL_COLOR_SECUNDARIO || '#764ba2';
  const enlace = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="color:${colorPrimario};margin:0;font-size:24px">${nombreInstitucion}</h2>
        <p style="color:#888;font-size:13px;margin:4px 0 0">Plataforma Educativa</p>
      </div>
      <h3 style="color:#333;font-size:18px">Hola, ${nombre}</h3>
      <p style="color:#555;line-height:1.6">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para continuar:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${enlace}" style="background:linear-gradient(135deg,${colorPrimario},${colorSecundario});color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          Restablecer contraseña
        </a>
      </div>
      <p style="color:#999;font-size:13px;line-height:1.5">
        Este enlace expira en <strong>30 minutos</strong>.<br/>
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:12px;text-align:center;margin:0">${nombreInstitucion}${dominioInstitucion ? ' · ' + dominioInstitucion : ''}</p>
    </div>
  `;

  return enviarEmail({
    destinatario,
    asunto: `Restablecer tu contraseña — ${nombreInstitucion}`,
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
      'SELECT id, nombre, email, password, rol, colegio_id, activo FROM usuarios WHERE email = ?',
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

    const payload = {
      id: usuario.id,
      rol: usuario.rol,
      colegio_id: usuario.colegio_id,
      nombre: usuario.nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        colegio_id: usuario.colegio_id
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
      'SELECT id, nombre, email, rol, colegio_id, activo, creado_en FROM usuarios WHERE id = ?',
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
      'UPDATE usuarios SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?',
      [hash, filas[0].id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en resetear password:', err);
    res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
}

module.exports = { login, me, solicitarReset, resetearPassword };
