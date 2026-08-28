const { enviarEmail } = require('../services/emailService');

const DESTINATARIOS_DEMO = 'consultor@playfesor.co, demo@playfesor.co';

// POST /api/contacto/demo — formulario público de la landing (sin login).
// No guarda nada en base de datos: cada solicitud se envía directo por correo
// a comercial, tal como se decidió (canal más simple, sin backend adicional).
async function solicitarDemo(req, res) {
  const { nombre, email, telefono, colegio, cargo, cantidad_estudiantes } = req.body;

  if (!nombre?.trim() || !email?.trim() || !colegio?.trim()) {
    return res.status(400).json({ error: 'Nombre, correo y nombre del colegio son obligatorios' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'El correo no parece válido' });
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="color:#667eea;margin:0;font-size:24px">Playfesor</h2>
        <p style="color:#888;font-size:13px;margin:4px 0 0">Nueva solicitud de demo</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333">
        <tr><td style="padding:8px 0;color:#888;width:160px">Nombre</td><td style="padding:8px 0"><strong>${nombre.trim()}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#888">Correo</td><td style="padding:8px 0">${email.trim()}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Teléfono</td><td style="padding:8px 0">${telefono?.trim() || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Colegio</td><td style="padding:8px 0"><strong>${colegio.trim()}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#888">Cargo</td><td style="padding:8px 0">${cargo?.trim() || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Cantidad de estudiantes</td><td style="padding:8px 0">${cantidad_estudiantes?.trim() || '—'}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:12px;text-align:center;margin:0">Enviado desde el formulario de la landing de playfesor.co</p>
    </div>
  `;

  try {
    await enviarEmail({
      destinatario: DESTINATARIOS_DEMO,
      asunto: `Nueva solicitud de demo — ${colegio.trim()}`,
      html,
    });
    res.json({ mensaje: 'Solicitud enviada. Nos pondremos en contacto pronto.' });
  } catch (err) {
    console.error('Error al enviar solicitud de demo:', err);
    res.status(500).json({ error: 'No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.' });
  }
}

module.exports = { solicitarDemo };
