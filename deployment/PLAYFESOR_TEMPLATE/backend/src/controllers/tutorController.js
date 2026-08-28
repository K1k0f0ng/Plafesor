const Anthropic = require('@anthropic-ai/sdk');
const db = require('../database');
const { CLAUDE_MODEL } = require('../config/ia');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/tutor/preguntar
async function preguntar(req, res) {
  const { pregunta, historial } = req.body;
  const estudianteId = req.usuario.id;

  if (!pregunta || pregunta.trim().length < 2) {
    return res.status(400).json({ error: 'La pregunta no puede estar vacía' });
  }

  try {
    const [[estudiante]] = await db.query(`
      SELECT u.nombre, g.grado, g.nombre AS grupo, c.nombre AS colegio
      FROM usuarios u
      LEFT JOIN estudiante_grupos eg ON eg.estudiante_id = u.id
      LEFT JOIN grupos           g  ON g.id  = eg.grupo_id
      LEFT JOIN colegios         c  ON c.id  = g.colegio_id
      WHERE u.id = ?
      LIMIT 1
    `, [estudianteId]);

    const [materias] = await db.query(`
      SELECT DISTINCT m.nombre
      FROM actividades a
      JOIN materias         m  ON m.id  = a.materia_id
      JOIN estudiante_grupos eg ON eg.grupo_id = a.grupo_id
      WHERE eg.estudiante_id = ? AND a.activa = TRUE
    `, [estudianteId]);

    const grado        = estudiante?.grado  || '?';
    const nombre       = estudiante?.nombre || 'Estudiante';
    const colegio      = estudiante?.colegio || '';
    const materiasLista = materias.map(m => m.nombre).join(', ') || 'varias materias';

    // Incluir últimos 3 intercambios del historial para continuidad
    const messages = [];
    if (Array.isArray(historial)) {
      for (const h of historial.slice(-6)) {
        messages.push({ role: h.rol === 'tutor' ? 'assistant' : 'user', content: h.texto });
      }
    }
    messages.push({ role: 'user', content: pregunta.trim() });

    const respuesta = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 550,
      system: `Eres el Tutor IA de ${colegio || 'la institución'}, asistente educativo de ${nombre}, estudiante de grado ${grado}°. Sus materias son: ${materiasLista}.

Tu misión: ayudar al estudiante a ENTENDER, no solo a obtener respuestas. Guíalo para que piense.

CÓMO RESPONDER:
- Español claro y simple, apropiado para grado ${grado}° (escala colombiana MEN)
- Sé amable, paciente y motivador
- Da ejemplos concretos y cotidianos
- Si el estudiante no entiende, intenta con una analogía diferente
- Si pregunta por una tarea o quiz, guíalo paso a paso sin dársela resuelta
- Máximo 160 palabras por respuesta
- Usa emojis con moderación (1-2 máximo por respuesta)
- Si la pregunta no es académica, redirige amablemente`,
      messages,
    });

    res.json({ data: { respuesta: respuesta.content[0].text } });
  } catch (err) {
    console.error('Error en tutor IA:', err);
    res.status(500).json({ error: 'Error al consultar el tutor' });
  }
}

module.exports = { preguntar };
