const db = require('../database');
const { materiasEstudiante, nivelMEN } = require('./boletinController');

const PERIODOS_VALIDOS = ['1', '2', '3', '4', 'final'];

function nombrePeriodo(periodo) {
  return periodo === 'final' ? 'Consolidado del año (Final)' : `Período ${periodo}`;
}

// Un docente puede escribir la observación de un estudiante si dicta alguna
// materia en su grupo, o si es el director de ese grupo (aunque no le dicte
// ninguna materia) — mismo criterio para admin/director, sumado al colegio.
async function tieneAccesoEscritura(usuario, estudiante_id, grupo_id) {
  if (usuario.rol === 'admin' || usuario.rol === 'director') {
    const [[mismoColegio]] = await db.query(
      'SELECT 1 FROM grupos WHERE id = ? AND colegio_id = ? LIMIT 1',
      [grupo_id, usuario.colegio_id]
    );
    return !!mismoColegio;
  }
  if (usuario.rol !== 'docente') return false;

  const [[asignado]] = await db.query(
    'SELECT 1 FROM docente_grupos_materias WHERE docente_id = ? AND grupo_id = ? LIMIT 1',
    [usuario.id, grupo_id]
  );
  if (asignado) return true;

  const [[esDirectorGrupo]] = await db.query(
    'SELECT 1 FROM usuarios WHERE id = ? AND grupo_dirigido_id = ? LIMIT 1',
    [usuario.id, grupo_id]
  );
  return !!esDirectorGrupo;
}

// Reúne todo lo que ya existe en la plataforma sobre el estudiante en ese
// período: notas (misma regla de tres del boletín), asistencia, anotaciones,
// la observación del período anterior (para hablar de evolución), el plan de
// mejoramiento activo y el riesgo más reciente si los hay.
async function recopilarContexto(estudiante_id, grupo_id, colegio_id, periodo) {
  const { materias, advertencia } = await materiasEstudiante(estudiante_id, grupo_id, colegio_id, periodo);

  let fechaInicio = null, fechaFin = null;
  if (periodo !== 'final') {
    const [[fechas]] = await db.query(
      `SELECT fecha_inicio, fecha_fin FROM periodos_academicos
       WHERE colegio_id = ? AND numero = ? ORDER BY ano_lectivo DESC LIMIT 1`,
      [colegio_id, periodo]
    );
    fechaInicio = fechas?.fecha_inicio || null;
    fechaFin = fechas?.fecha_fin || null;
  }

  const rangoAsistencia = fechaInicio && fechaFin
    ? { sql: 'AND fecha BETWEEN ? AND ?', params: [fechaInicio, fechaFin] }
    : { sql: 'AND fecha >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)', params: [] };

  const [[asistencia]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(estado = 'ausente')  AS ausencias,
            SUM(estado = 'tardanza') AS tardanzas,
            ROUND(SUM(estado IN ('presente','tardanza')) * 100.0 / NULLIF(COUNT(*), 0), 1) AS tasa
     FROM asistencias
     WHERE estudiante_id = ? ${rangoAsistencia.sql}`,
    [estudiante_id, ...rangoAsistencia.params]
  );

  const rangoAnotaciones = fechaInicio && fechaFin
    ? { sql: 'AND creado_en BETWEEN ? AND ?', params: [fechaInicio, fechaFin] }
    : { sql: '', params: [] };

  const [anotaciones] = await db.query(
    `SELECT tipo, texto, creado_en FROM anotaciones
     WHERE estudiante_id = ? ${rangoAnotaciones.sql}
     ORDER BY creado_en DESC LIMIT 15`,
    [estudiante_id, ...rangoAnotaciones.params]
  );

  let periodoAnteriorTexto = null;
  if (periodo !== 'final' && periodo !== '1') {
    const anteriorNum = String(parseInt(periodo, 10) - 1);
    const [[obs]] = await db.query(
      'SELECT texto FROM observaciones_periodo WHERE estudiante_id = ? AND periodo = ?',
      [estudiante_id, anteriorNum]
    );
    periodoAnteriorTexto = obs?.texto || null;
  }

  const [planes] = await db.query(
    `SELECT m.nombre AS materia, pm.diagnostico
     FROM planes_mejoramiento pm JOIN materias m ON m.id = pm.materia_id
     WHERE pm.estudiante_id = ? AND pm.estado = 'activo'`,
    [estudiante_id]
  );

  const [riesgos] = await db.query(
    `SELECT m.nombre AS materia, pr.score, pr.nivel
     FROM predicciones_riesgo pr JOIN materias m ON m.id = pr.materia_id
     WHERE pr.estudiante_id = ? AND pr.nivel IN ('alto','critico')
     ORDER BY pr.score DESC LIMIT 3`,
    [estudiante_id]
  );

  const anotacionesMejora = anotaciones.filter(a => a.tipo === 'mejora').length;
  const notaMuyBaja = materias.some(m => m.nota_promedio !== null && m.nota_promedio < 3.0);
  const requiereAtencion = riesgos.length > 0 || anotacionesMejora >= 2 || notaMuyBaja;

  return { materias, advertencia, asistencia, anotaciones, periodoAnteriorTexto, planes, riesgos, requiereAtencion };
}

function construirPrompt({ nombre, grado, grupo, periodo, contexto }) {
  const { materias, asistencia, anotaciones, periodoAnteriorTexto, planes, riesgos, requiereAtencion } = contexto;

  const materiasTexto = materias.length === 0
    ? 'Sin actividades calificadas todavía en este período.'
    : materias.map(m => `- ${m.materia_nombre}: ${m.nota_promedio ?? 'sin calificar'} (${nivelMEN(m.nota_promedio)}), ${m.actividades_calificadas}/${m.total_actividades} actividades entregadas`).join('\n');

  const asistenciaTexto = !asistencia || !asistencia.total
    ? 'Sin registros de asistencia en este período.'
    : `${asistencia.tasa ?? 0}% de asistencia (${asistencia.ausencias || 0} ausencias, ${asistencia.tardanzas || 0} tardanzas, de ${asistencia.total} clases registradas)`;

  const anotacionesTexto = anotaciones.length === 0
    ? 'Sin anotaciones registradas en este período.'
    : anotaciones.map(a => `- [${a.tipo}] ${a.texto}`).join('\n');

  const planesTexto = planes.length === 0 ? '' :
    `\nPlan de mejoramiento activo:\n${planes.map(p => `- ${p.materia}: ${p.diagnostico}`).join('\n')}`;

  const riesgosTexto = riesgos.length === 0 ? '' :
    `\nRiesgo académico detectado por el sistema:\n${riesgos.map(r => `- ${r.materia}: nivel ${r.nivel} (${r.score}/100)`).join('\n')}`;

  const evolucionTexto = periodoAnteriorTexto
    ? `\nObservación del período anterior (compara y di si mejoró o desmejoró):\n"${periodoAnteriorTexto}"`
    : '';

  return `Eres un docente colombiano experto en redactar la sección "Observaciones" del boletín académico oficial, siguiendo lineamientos MEN y buenas prácticas pedagógicas.

ENFOQUE DE LA REDACCIÓN (obligatorio):
- Balance positivo: comienza siempre con las fortalezas del estudiante antes de mencionar lo que debe mejorar.
- Tono constructivo: nunca uses palabras desalentadoras; motiva al esfuerzo y al cambio.
- Claridad y sencillez: frases cortas, vocabulario sencillo, que cualquier familia entienda sin confusión.
- Datos objetivos: básate solo en los hechos que te doy abajo — nunca en juicios de valor ni prejuicios. Si falta información sobre algún aspecto, no la inventes: sé breve ahí y concéntrate en lo que sí tiene evidencia.

CONTENIDO QUE DEBE INCLUIR:
1. Rendimiento académico: explica brevemente por qué las notas más bajas o el éxito de las más altas.
2. Aspecto convivencial: actitud frente a las normas, trabajo en equipo y respeto — apóyate en las anotaciones.
3. Hábitos de estudio: responsabilidad, entrega de actividades, atención en clase (infiérelo de las actividades entregadas).
4. Evolución: si hay observación del período anterior, compárala explícitamente.

ORIENTACIÓN Y ALIANZA CON LA FAMILIA:
- Propón 1 o 2 estrategias concretas y aplicables.
- Invita a la familia, de forma amable, a acompañar el proceso en casa.
- ${requiereAtencion ? 'Este caso requiere seguimiento: incluye un llamado explícito a solicitar una cita con la institución.' : 'Si el desempeño es adecuado, no fuerces un llamado a cita — basta con la invitación a seguir acompañando el proceso.'}

PROHIBIDO:
- Frases genéricas o de copiar y pegar — este comentario es solo para este estudiante.
- Errores ortográficos — es un documento oficial institucional.
- Etiquetas negativas como "vago", "irresponsable", "problemático", "incapaz" o similares.

FORMATO: un solo párrafo corrido de 90 a 150 palabras, sin viñetas ni encabezados, listo para pegar en el boletín oficial.

—— DATOS DEL ESTUDIANTE ——
Nombre: ${nombre}
Grado ${grado}° ${grupo} — ${nombrePeriodo(periodo)}

Notas por materia:
${materiasTexto}

Asistencia: ${asistenciaTexto}

Anotaciones del período:
${anotacionesTexto}
${evolucionTexto}${planesTexto}${riesgosTexto}

Redacta ahora la observación del período.`;
}

// POST /api/observaciones/generar — genera un borrador con IA (no lo guarda)
async function generar(req, res) {
  const { estudiante_id, grupo_id, periodo } = req.body;
  const u = req.usuario;

  if (!estudiante_id || !grupo_id || !PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: 'estudiante_id, grupo_id y un período válido son obligatorios' });
  }

  try {
    const tieneAcceso = await tieneAccesoEscritura(u, estudiante_id, grupo_id);
    if (!tieneAcceso) return res.status(403).json({ error: 'No tienes acceso para generar esta observación' });

    const [[info]] = await db.query(
      `SELECT est.nombre, g.grado, g.nombre AS grupo, g.colegio_id
       FROM usuarios est JOIN grupos g ON g.id = ?
       WHERE est.id = ?`,
      [grupo_id, estudiante_id]
    );
    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });

    const contexto = await recopilarContexto(estudiante_id, grupo_id, info.colegio_id, periodo);
    const prompt = construirPrompt({ nombre: info.nombre, grado: info.grado, grupo: info.grupo, periodo, contexto });

    const Anthropic = require('@anthropic-ai/sdk');
    const { CLAUDE_MODEL } = require('../config/ia');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const texto = message.content[0].text.trim();
    res.json({ data: { texto, requiere_atencion: contexto.requiereAtencion, advertencia: contexto.advertencia } });
  } catch (err) {
    console.error('[Observaciones] generar error:', err.message);
    res.status(500).json({ error: 'Error al generar la observación', detalle: err.message });
  }
}

// PUT /api/observaciones — guarda (crea o actualiza) la observación revisada
async function guardar(req, res) {
  const { estudiante_id, grupo_id, periodo, texto } = req.body;
  const u = req.usuario;

  if (!estudiante_id || !grupo_id || !PERIODOS_VALIDOS.includes(periodo) || !texto || !texto.trim()) {
    return res.status(400).json({ error: 'estudiante_id, grupo_id, período y texto son obligatorios' });
  }

  try {
    const tieneAcceso = await tieneAccesoEscritura(u, estudiante_id, grupo_id);
    if (!tieneAcceso) return res.status(403).json({ error: 'No tienes acceso para guardar esta observación' });

    const [[grupoInfo]] = await db.query('SELECT colegio_id FROM grupos WHERE id = ?', [grupo_id]);
    if (!grupoInfo) return res.status(404).json({ error: 'Grupo no encontrado' });

    await db.query(
      `INSERT INTO observaciones_periodo (estudiante_id, grupo_id, colegio_id, periodo, texto, docente_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         texto = VALUES(texto), docente_id = VALUES(docente_id), grupo_id = VALUES(grupo_id)`,
      [estudiante_id, grupo_id, grupoInfo.colegio_id, periodo, texto.trim(), u.id]
    );

    res.json({ mensaje: 'Observación guardada' });
  } catch (err) {
    console.error('[Observaciones] guardar error:', err.message);
    res.status(500).json({ error: 'Error al guardar la observación' });
  }
}

// GET /api/observaciones/estudiante/:id — todas las observaciones de un estudiante
async function listarPorEstudiante(req, res) {
  const estudianteId = parseInt(req.params.id);
  const u = req.usuario;

  try {
    if (u.rol === 'estudiante' && u.id !== estudianteId) {
      return res.status(403).json({ error: 'Solo puedes ver tus propias observaciones' });
    }
    if (u.rol === 'padre') {
      const [[vinculo]] = await db.query(
        'SELECT 1 FROM padre_estudiante WHERE padre_id = ? AND estudiante_id = ? LIMIT 1',
        [u.id, estudianteId]
      );
      if (!vinculo) return res.status(403).json({ error: 'No tienes acceso a este estudiante' });
    }
    if (u.rol === 'admin' || u.rol === 'director') {
      const [[mismoColegio]] = await db.query(
        'SELECT 1 FROM usuarios WHERE id = ? AND colegio_id = ? LIMIT 1',
        [estudianteId, u.colegio_id]
      );
      if (!mismoColegio) return res.status(403).json({ error: 'Ese estudiante no pertenece a tu colegio' });
    }

    const [observaciones] = await db.query(
      `SELECT op.id, op.periodo, op.texto, op.actualizado_en,
              du.nombre AS nombre_docente
       FROM observaciones_periodo op
       LEFT JOIN usuarios du ON du.id = op.docente_id
       WHERE op.estudiante_id = ?
       ORDER BY FIELD(op.periodo, '1','2','3','4','final')`,
      [estudianteId]
    );

    res.json({ data: observaciones });
  } catch (err) {
    console.error('[Observaciones] listarPorEstudiante error:', err.message);
    res.status(500).json({ error: 'Error al obtener las observaciones' });
  }
}

// POST /api/observaciones/notificar — avisa al acudiente por WhatsApp
async function notificar(req, res) {
  const { estudiante_id, periodo } = req.body;
  const u = req.usuario;

  if (!estudiante_id || !PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: 'estudiante_id y un período válido son obligatorios' });
  }

  try {
    const [[obs]] = await db.query(
      `SELECT op.estudiante_id, op.grupo_id, op.periodo,
              est.nombre AS estudiante, est.telefono_padres,
              g.grado, g.nombre AS grupo, c.nombre AS colegio
       FROM observaciones_periodo op
       JOIN usuarios est ON est.id = op.estudiante_id
       JOIN grupos g ON g.id = op.grupo_id
       JOIN colegios c ON c.id = g.colegio_id
       WHERE op.estudiante_id = ? AND op.periodo = ?`,
      [estudiante_id, periodo]
    );
    if (!obs) return res.status(404).json({ error: 'Primero guarda la observación antes de notificar' });

    const tieneAcceso = await tieneAccesoEscritura(u, obs.estudiante_id, obs.grupo_id);
    if (!tieneAcceso) return res.status(403).json({ error: 'No tienes acceso a esta observación' });

    if (!obs.telefono_padres) {
      return res.status(422).json({ error: 'Este estudiante no tiene teléfono de acudiente registrado' });
    }

    const { enviarMensaje } = require('../services/whatsappService');
    const mensaje = [
      `📚 *${obs.colegio} — Boletín de ${obs.estudiante}*`,
      ``,
      `Estimado padre/madre,`,
      ``,
      `Ya está disponible la observación del ${nombrePeriodo(obs.periodo)} de *${obs.estudiante}* (Grado ${obs.grado}° ${obs.grupo}) en el boletín.`,
      ``,
      `Te invitamos a revisarla en el portal y acompañar el proceso desde casa.`,
      ``,
      `_${obs.colegio}_`,
    ].join('\n');

    const resultado = await enviarMensaje(obs.telefono_padres, mensaje);
    if (!resultado.ok) {
      return res.status(500).json({ error: 'No se pudo enviar el mensaje', detalle: resultado.razon });
    }

    res.json({ mensaje: 'Notificación enviada correctamente', data: { telefono: obs.telefono_padres } });
  } catch (err) {
    console.error('[Observaciones] notificar error:', err.message);
    res.status(500).json({ error: 'Error al enviar la notificación' });
  }
}

module.exports = { generar, guardar, listarPorEstudiante, notificar };
