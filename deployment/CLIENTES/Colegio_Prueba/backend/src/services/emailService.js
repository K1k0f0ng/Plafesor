'use strict';
const nodemailer = require('nodemailer');

// Cliente SMTP genérico — cada instalación configura su propio proveedor de correo
// (Gmail, Outlook, el hosting de correo del propio colegio, etc.) vía variables de entorno,
// en vez de depender de una cuenta compartida de un proveedor específico.
function crearTransportador() {
  const puerto = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function enviarEmail({ destinatario, asunto, html }) {
  const transportador = crearTransportador();
  await transportador.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destinatario,
    subject: asunto,
    html,
  });
}

module.exports = { enviarEmail };
