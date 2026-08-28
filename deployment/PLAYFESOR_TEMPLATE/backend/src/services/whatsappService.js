const https    = require('https');
const querystring = require('querystring');

function normalizarTelefono(tel) {
  if (!tel) return null;
  let n = String(tel).replace(/\D/g, '');
  if (n.length === 10) n = '57' + n;
  if (n.length < 11)   return null;
  return '+' + n;
}

function enviarMensaje(telefono, mensaje) {
  return new Promise((resolve) => {
    const to       = normalizarTelefono(telefono);
    if (!to) return resolve({ ok: false, razon: 'telefono_invalido' });

    const instancia = process.env.ULTRAMSG_INSTANCE;
    const token     = process.env.ULTRAMSG_TOKEN;

    if (!instancia || !token) {
      console.warn('WhatsApp no configurado — ULTRAMSG_INSTANCE o ULTRAMSG_TOKEN faltantes');
      return resolve({ ok: false, razon: 'no_configurado' });
    }

    const postData = querystring.stringify({ token, to, body: mensaje });

    const opciones = {
      hostname: 'api.ultramsg.com',
      port:     443,
      path:     `/${instancia}/messages/chat`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(opciones, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try { resolve({ ok: true, data: JSON.parse(data) }); }
        catch { resolve({ ok: true, data }); }
      });
    });

    req.on('error', (err) => {
      console.error('Error UltraMsg:', err.message);
      resolve({ ok: false, razon: err.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { enviarMensaje, normalizarTelefono };
