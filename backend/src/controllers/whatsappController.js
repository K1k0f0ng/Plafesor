const db = require('../database');
const { enviarMensaje } = require('../services/whatsappService');
const { estudiantesConWhatsappActivo } = require('../utils/preferenciasNotificacion');
const Anthropic = require('@anthropic-ai/sdk');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic();

function formatearFecha(fechaStr) {
  const [y, m, d] = fechaStr.split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

// POST /api/whatsapp/notificar-ausentes
async function notificarAusentes(req, res) {
  const { grupo_id, fecha } = req.body;

  if (!grupo_id || !fecha) {
    return res.status(400).json({ error: 'grupo_id y fecha son obligatorios' });
  }

  try {
    const [ausentes] = await db.query(`
      SELECT
        u.id                AS estudiante_id,
        u.nombre            AS estudiante,
        u.telefono_padres,
        g.nombre            AS grupo,
        g.grado,
        c.nombre            AS colegio
      FROM asistencias a
      JOIN usuarios  u ON u.id  = a.estudiante_id
      JOIN grupos    g ON g.id  = a.grupo_id
      JOIN colegios  c ON c.id  = g.colegio_id
      WHERE a.grupo_id = ? AND a.fecha = ? AND a.estado = 'ausente'
    `, [grupo_id, fecha]);

    if (ausentes.length === 0) {
      return res.json({ data: { enviados: 0, sin_telefono: 0, total_ausentes: 0 } });
    }

    let enviados    = 0;
    let sinTelefono = 0;
    let omitidosPorPreferencia = 0;

    const fechaTexto = formatearFecha(fecha);
    const conWhatsappActivo = new Set(await estudiantesConWhatsappActivo(ausentes.map(e => e.estudiante_id)));

    for (const est of ausentes) {
      if (!conWhatsappActivo.has(est.estudiante_id)) { omitidosPorPreferencia++; continue; }
      if (!est.telefono_padres) { sinTelefono++; continue; }

      const mensaje = [
        `📚 *Playfesor*`,
        ``,
        `Estimado padre/madre de familia,`,
        ``,
        `Le informamos que *${est.estudiante}* fue registrado/a como *ausente* el día *${fechaTexto}* en el grupo Grado ${est.grado}° ${est.grupo}.`,
        ``,
        `Si tiene alguna novedad, comuníquese con la institución.`,
        ``,
        `_${est.colegio}_`,
      ].join('\n');

      const resultado = await enviarMensaje(est.telefono_padres, mensaje);
      if (resultado.ok) enviados++;
      else sinTelefono++;
    }

    res.json({ data: { enviados, sin_telefono: sinTelefono, omitidos_por_preferencia: omitidosPorPreferencia, total_ausentes: ausentes.length } });
  } catch (err) {
    console.error('Error notificarAusentes:', err);
    res.status(500).json({ error: 'Error al enviar las notificaciones' });
  }
}

// POST /api/whatsapp/prueba  — solo admin, para verificar que la conexión funciona
async function enviarPrueba(req, res) {
  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son obligatorios' });
  }

  const resultado = await enviarMensaje(telefono, mensaje);
  if (resultado.ok) {
    res.json({ data: { enviado: true } });
  } else {
    res.status(500).json({ error: `Error: ${resultado.razon}` });
  }
}

// POST /api/whatsapp/webhook  — endpoint público (sin JWT), llamado por UltraMsg
async function recibirWebhook(req, res) {
  // Responder de inmediato para que UltraMsg no reintente
  res.json({ ok: true });

  const { token, data } = req.body || {};

  // Verificar token de seguridad UltraMsg
  if (!token || token !== process.env.ULTRAMSG_TOKEN) return;

  // Solo mensajes de texto entrantes (ignorar salientes, imágenes, grupos, etc.)
  if (!data || data.type !== 'chat' || data.fromMe) return;
  const textoRaw = (data.body || '').trim();
  if (!textoRaw) return;

  // Ignorar mensajes de grupos de WhatsApp
  const fromRaw = (data.from || '');
  if (fromRaw.includes('@g.us')) return;

  // Extraer número limpio (quitar @c.us)
  const telefonoIncoming = fromRaw.replace('@c.us', '').replace(/\D/g, '');
  if (telefonoIncoming.length < 10) return;

  // Últimos 10 dígitos para comparar (funciona sin importar si tiene prefijo 57 o +57)
  const ultimos10 = telefonoIncoming.slice(-10);

  try {
    // Buscar padre por número de teléfono
    const [padres] = await db.query(`
      SELECT id, nombre, telefono_padres, colegio_id
      FROM usuarios
      WHERE rol = 'padre'
        AND activo = TRUE
        AND telefono_padres IS NOT NULL
        AND telefono_padres != ''
        AND RIGHT(REPLACE(REPLACE(REPLACE(telefono_padres, '+', ''), ' ', ''), '-', ''), 10) = ?
      LIMIT 1
    `, [ultimos10]);

    if (!padres.length) {
      await enviarMensaje(telefonoIncoming, `Hola 👋 No encontramos una cuenta de padre/madre asociada a este número en Playfesor. Comunícate con el colegio para activar tu acceso.`);
      return;
    }

    const padre = padres[0];

    // Obtener hijos vinculados
    const [hijos] = await db.query(`
      SELECT u.id, u.nombre,
             g.grado, g.nombre AS grupo,
             c.nombre AS colegio
      FROM padre_estudiante pe
      JOIN usuarios u ON u.id = pe.estudiante_id AND u.activo = TRUE
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos g ON g.id = eg.grupo_id
      LEFT JOIN colegios c ON c.id = g.colegio_id
      WHERE pe.padre_id = ?
    `, [padre.id]);

    if (!hijos.length) {
      await enviarMensaje(telefonoIncoming, `Hola ${padre.nombre} 👋 Tu cuenta no tiene estudiantes vinculados. Comunícate con el colegio.`);
      return;
    }

    // Recopilar datos académicos por hijo (máx. 3 para no exceder tokens)
    const resumenHijos = await Promise.all(hijos.slice(0, 3).map(async (hijo) => {
      const [[prom]] = await db.query(`
        SELECT ROUND(AVG(ra.nota), 1) AS promedio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN estudiante_grupos eg ON eg.estudiante_id = ? AND eg.grupo_id = a.grupo_id
        WHERE ra.estudiante_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
      `, [hijo.id, hijo.id]);

      const [materias] = await db.query(`
        SELECT m.nombre, ROUND(AVG(ra.nota), 1) AS promedio
        FROM resultados_actividades ra
        JOIN actividades a ON a.id = ra.actividad_id AND a.activa = TRUE
        JOIN materias m ON m.id = a.materia_id
        JOIN estudiante_grupos eg ON eg.estudiante_id = ? AND eg.grupo_id = a.grupo_id
        WHERE ra.estudiante_id = ?
          AND ra.id = (
            SELECT ra2.id FROM resultados_actividades ra2
            WHERE ra2.estudiante_id = ra.estudiante_id AND ra2.actividad_id = ra.actividad_id
            ORDER BY ra2.nota DESC, ra2.completada_en DESC LIMIT 1
          )
        GROUP BY m.id, m.nombre
        ORDER BY promedio ASC
        LIMIT 6
      `, [hijo.id, hijo.id]);

      const [[asist]] = await db.query(`
        SELECT ROUND(SUM(estado = 'ausente') * 100.0 / NULLIF(COUNT(*), 0), 0) AS pct_ausente
        FROM asistencias
        WHERE estudiante_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [hijo.id]);

      const [[riesgo]] = await db.query(`
        SELECT nivel, score FROM predicciones_riesgo
        WHERE estudiante_id = ? ORDER BY score DESC LIMIT 1
      `, [hijo.id]);

      const matStr = materias.map(m => `${m.nombre}: ${m.promedio}`).join(', ');
      const lines = [
        `Estudiante: ${hijo.nombre} | Grado ${hijo.grado}° ${hijo.grupo}`,
        `Promedio general: ${prom?.promedio ?? 'sin notas aún'}`,
        matStr ? `Por materia (menor a mayor): ${matStr}` : null,
        `Inasistencia últimos 30 días: ${asist?.pct_ausente ?? 0}%`,
        riesgo ? `Riesgo académico: ${riesgo.nivel} (${riesgo.score} pts)` : null,
      ];
      return lines.filter(Boolean).join('\n');
    }));

    const prompt = `Eres el asistente de Playfesor, un sistema de gestión académica colombiano. Responde de forma amigable, breve y clara al mensaje del padre/madre. Máximo 170 palabras.

Padre/madre: ${padre.nombre}
Mensaje: "${textoRaw}"

Información académica:
${resumenHijos.join('\n\n')}

Escala colombiana MEN: Bajo (<3.5), Básico (3.5-3.9), Alto (4.0-4.5), Superior (4.6-5.0).
Responde en español, tono cálido y profesional. Sin formato markdown (sin **, #, listas con -). Solo texto plano apropiado para WhatsApp.`;

    let respuesta;
    try {
      const msg = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 280,
        messages: [{ role: 'user', content: prompt }],
      });
      respuesta = (msg.content[0]?.text || '').trim();
    } catch (iaErr) {
      console.error('[ChatbotPadres] Error Claude:', iaErr.message);
      respuesta = `Hola ${padre.nombre}, en este momento no puedo procesar tu consulta. Por favor intenta de nuevo en unos minutos o ingresa a la plataforma Playfesor para ver el detalle de tu hijo/a.`;
    }

    await enviarMensaje(telefonoIncoming, respuesta);
  } catch (err) {
    console.error('[ChatbotPadres] Error webhook:', err.message);
  }
}

module.exports = { notificarAusentes, enviarPrueba, recibirWebhook };
