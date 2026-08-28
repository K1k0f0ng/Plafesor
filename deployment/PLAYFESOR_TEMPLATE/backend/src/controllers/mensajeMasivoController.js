const db = require('../database');
const { enviarMensaje } = require('../services/whatsappService');

const ALCANCES_VALIDOS = ['grupo', 'grado', 'colegio'];

// Alcance 'grupo': admin/director, o el docente director de ese grupo puntual.
// Alcance 'grado' o 'colegio' (varios grupos a la vez): solo admin/director —
// un docente director de grupo no puede convocar fuera de su propio grupo.
async function tieneAccesoAlcance(usuario, alcance, grupo_id) {
  if (alcance === 'grado' || alcance === 'colegio') {
    return usuario.rol === 'admin' || usuario.rol === 'director';
  }
  if (usuario.rol === 'admin' || usuario.rol === 'director') {
    const [[mismoColegio]] = await db.query(
      'SELECT 1 FROM grupos WHERE id = ? AND colegio_id = ? LIMIT 1',
      [grupo_id, usuario.colegio_id]
    );
    return !!mismoColegio;
  }
  if (usuario.rol !== 'docente') return false;

  const [[esDirectorGrupo]] = await db.query(
    'SELECT 1 FROM usuarios WHERE id = ? AND grupo_dirigido_id = ? LIMIT 1',
    [usuario.id, grupo_id]
  );
  return !!esDirectorGrupo;
}

// Estudiantes activos dentro del alcance pedido, con su teléfono de acudientes
async function estudiantesDelAlcance(colegio_id, alcance, grupo_id, grado) {
  if (alcance === 'grupo') {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre, u.telefono_padres
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      WHERE eg.grupo_id = ?
    `, [grupo_id]);
    return filas;
  }
  if (alcance === 'grado') {
    const [filas] = await db.query(`
      SELECT DISTINCT u.id, u.nombre, u.telefono_padres
      FROM estudiante_grupos eg
      JOIN grupos g ON g.id = eg.grupo_id AND g.colegio_id = ? AND g.grado = ?
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
    `, [colegio_id, grado]);
    return filas;
  }
  const [filas] = await db.query(
    `SELECT id, nombre, telefono_padres FROM usuarios WHERE colegio_id = ? AND rol = 'estudiante' AND activo = TRUE`,
    [colegio_id]
  );
  return filas;
}

// GET /api/mensajes-masivos/destinatarios?alcance=&grupo_id=&grado=
// Previsualiza a cuántas familias llegaría, antes de enviar
async function previsualizarDestinatarios(req, res) {
  const { alcance, grupo_id, grado } = req.query;
  const u = req.usuario;

  if (!ALCANCES_VALIDOS.includes(alcance)) {
    return res.status(400).json({ error: 'Alcance inválido' });
  }
  if (alcance === 'grupo' && !grupo_id) return res.status(400).json({ error: 'grupo_id es obligatorio' });
  if (alcance === 'grado' && !grado) return res.status(400).json({ error: 'grado es obligatorio' });

  try {
    const acceso = await tieneAccesoAlcance(u, alcance, grupo_id ? parseInt(grupo_id) : null);
    if (!acceso) return res.status(403).json({ error: 'No tienes permiso para ese alcance' });

    const estudiantes = await estudiantesDelAlcance(u.colegio_id, alcance, grupo_id ? parseInt(grupo_id) : null, grado);
    const sinTelefono = estudiantes.filter(e => !e.telefono_padres).length;
    // Número real de mensajes de WhatsApp que se enviarán: teléfonos distintos
    // entre los estudiantes que sí tienen uno registrado (evita duplicar el
    // envío cuando hay hermanos en el mismo alcance)
    const telefonosUnicos = new Set(estudiantes.filter(e => e.telefono_padres).map(e => e.telefono_padres));

    res.json({
      data: {
        total_estudiantes: estudiantes.length,
        total_con_telefono: estudiantes.length - sinTelefono,
        sin_telefono: sinTelefono,
        total_mensajes_whatsapp: telefonosUnicos.size,
      },
    });
  } catch (err) {
    console.error('Error al previsualizar destinatarios:', err);
    res.status(500).json({ error: 'Error al calcular los destinatarios' });
  }
}

// POST /api/mensajes-masivos — envía el comunicado a todas las familias del alcance
async function crear(req, res) {
  const { alcance, grupo_id, grado, asunto, mensaje } = req.body;
  const u = req.usuario;

  if (!ALCANCES_VALIDOS.includes(alcance)) return res.status(400).json({ error: 'Alcance inválido' });
  if (!asunto || !asunto.trim())            return res.status(400).json({ error: 'El asunto es obligatorio' });
  if (!mensaje || !mensaje.trim())          return res.status(400).json({ error: 'El mensaje es obligatorio' });
  if (alcance === 'grupo' && !grupo_id)     return res.status(400).json({ error: 'grupo_id es obligatorio' });
  if (alcance === 'grado' && !grado)        return res.status(400).json({ error: 'grado es obligatorio' });

  try {
    const grupoIdNum = grupo_id ? parseInt(grupo_id) : null;
    const acceso = await tieneAccesoAlcance(u, alcance, grupoIdNum);
    if (!acceso) return res.status(403).json({ error: 'No tienes permiso para ese alcance' });

    const [[colegio]] = await db.query('SELECT nombre FROM colegios WHERE id = ?', [u.colegio_id]);

    const estudiantes = await estudiantesDelAlcance(u.colegio_id, alcance, grupoIdNum, grado);
    const asuntoTxt = asunto.trim();
    const mensajeTxt = mensaje.trim();

    const textoWhatsapp = [
      `📢 *${colegio?.nombre || 'Institución'} — ${asuntoTxt}*`,
      ``,
      mensajeTxt,
      ``,
      `_${colegio?.nombre || 'Institución'}_`,
    ].join('\n');

    // Un mismo teléfono puede repetirse si hay hermanos en el mismo alcance —
    // se envía una sola vez por número para no duplicar el mensaje
    const telefonosUnicos = [...new Set(estudiantes.filter(e => e.telefono_padres).map(e => e.telefono_padres))];

    let enviados = 0;
    let fallidos = 0;
    for (const telefono of telefonosUnicos) {
      const resultado = await enviarMensaje(telefono, textoWhatsapp);
      if (resultado.ok) enviados++; else fallidos++;
    }
    fallidos += estudiantes.filter(e => !e.telefono_padres).length;

    const [result] = await db.query(
      `INSERT INTO mensajes_masivos
        (colegio_id, enviado_por, alcance, grupo_id, grado, asunto, mensaje, total_destinatarios, total_enviados, total_fallidos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.colegio_id, u.id, alcance, grupoIdNum, grado || null, asuntoTxt, mensajeTxt, telefonosUnicos.length, enviados, fallidos]
    );

    // Notificación in-app para cada acudiente vinculado a un estudiante del alcance
    const estudianteIds = estudiantes.map(e => e.id);
    if (estudianteIds.length) {
      const [padres] = await db.query(
        `SELECT DISTINCT padre_id FROM padre_estudiante WHERE estudiante_id IN (?)`,
        [estudianteIds]
      );
      if (padres.length) {
        const valores = padres.map(p => [
          p.padre_id, 'mensaje_masivo', `masivo_${result.insertId}`,
          asuntoTxt, mensajeTxt,
          JSON.stringify({ mensaje_masivo_id: result.insertId }),
        ]);
        await db.query(
          `INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra) VALUES ?`,
          [valores]
        );
      }
    }

    res.status(201).json({
      mensaje: 'Comunicado enviado',
      data: { id: result.insertId, total_destinatarios: telefonosUnicos.length, total_enviados: enviados, total_fallidos: fallidos },
    });
  } catch (err) {
    console.error('Error al enviar mensaje masivo:', err);
    res.status(500).json({ error: 'Error al enviar el comunicado' });
  }
}

// GET /api/mensajes-masivos — historial de campañas (institución: todo el
// colegio; docente director de grupo: solo las suyas)
async function listar(req, res) {
  const u = req.usuario;
  try {
    let filas;
    if (u.rol === 'admin' || u.rol === 'director') {
      [filas] = await db.query(`
        SELECT mm.*, eu.nombre AS nombre_remitente, g.nombre AS nombre_grupo
        FROM mensajes_masivos mm
        JOIN usuarios eu ON eu.id = mm.enviado_por
        LEFT JOIN grupos g ON g.id = mm.grupo_id
        WHERE mm.colegio_id = ?
        ORDER BY mm.creado_en DESC
        LIMIT 50
      `, [u.colegio_id]);
    } else {
      [filas] = await db.query(`
        SELECT mm.*, eu.nombre AS nombre_remitente, g.nombre AS nombre_grupo
        FROM mensajes_masivos mm
        JOIN usuarios eu ON eu.id = mm.enviado_por
        LEFT JOIN grupos g ON g.id = mm.grupo_id
        WHERE mm.enviado_por = ?
        ORDER BY mm.creado_en DESC
        LIMIT 50
      `, [u.id]);
    }
    res.json({ data: filas });
  } catch (err) {
    console.error('Error al listar mensajes masivos:', err);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
}

module.exports = { previsualizarDestinatarios, crear, listar };
