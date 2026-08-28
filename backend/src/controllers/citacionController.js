const db = require('../database');
const { enviarMensaje } = require('../services/whatsappService');
const { ordenApellido } = require('../utils/ordenNombre');

function formatearFecha(fechaStr) {
  if (!fechaStr) return null;
  const [y, m, d] = String(fechaStr).split('T')[0].split('-');
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

function formatearHora(horaStr) {
  if (!horaStr) return null;
  const [h, min] = String(horaStr).split(':').map(Number);
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

// Citar solo lo puede hacer el director del colegio/admin, o el docente que
// es director de ese grupo puntual — nunca un docente de materia cualquiera,
// porque es una acción institucional (convocar a una reunión), no de aula.
async function tieneAccesoCitacion(usuario, grupo_id) {
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

// GET /api/citaciones/mis-grupos — grupos sobre los que el usuario puede citar
async function getMisGrupos(req, res) {
  const { rol, id: userId, colegio_id } = req.usuario;
  try {
    if (rol === 'docente') {
      const [filas] = await db.query(`
        SELECT g.id, g.nombre, g.grado
        FROM grupos g
        WHERE g.id = (SELECT grupo_dirigido_id FROM usuarios WHERE id = ?)
        ORDER BY g.grado ASC, g.nombre ASC
      `, [userId]);
      return res.json({ data: filas });
    }
    if (rol === 'admin' || rol === 'director') {
      const [filas] = await db.query(`
        SELECT id, nombre, grado FROM grupos
        WHERE colegio_id = ? AND activo = TRUE
        ORDER BY grado ASC, nombre ASC
      `, [colegio_id]);
      return res.json({ data: filas });
    }
    res.json({ data: [] });
  } catch (err) {
    console.error('Error al listar mis grupos (citaciones):', err);
    res.status(500).json({ error: 'Error al obtener los grupos' });
  }
}

// GET /api/citaciones/grupo/:grupo_id/estudiantes — roster para elegir a quién citar
async function estudiantesDelGrupo(req, res) {
  const grupoId = parseInt(req.params.grupo_id);
  try {
    const acceso = await tieneAccesoCitacion(req.usuario, grupoId);
    if (!acceso) return res.status(403).json({ error: 'No tienes acceso a ese grupo' });

    const [estudiantes] = await db.query(`
      SELECT u.id, u.nombre,
             (SELECT COUNT(*) FROM citaciones c WHERE c.estudiante_id = u.id AND c.estado = 'pendiente') AS citaciones_pendientes
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id
      WHERE eg.grupo_id = ? AND u.activo = TRUE
      ORDER BY ${ordenApellido('u.nombre')} ASC
    `, [grupoId]);
    res.json({ data: estudiantes });
  } catch (err) {
    console.error('Error al listar estudiantes del grupo (citaciones):', err);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
}

// POST /api/citaciones — crea la citación y la envía por WhatsApp
async function crear(req, res) {
  const { estudiante_id, grupo_id, motivo, fecha_cita, hora_cita, lugar } = req.body;
  const u = req.usuario;

  if (!estudiante_id || !grupo_id || !motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'Estudiante, grupo y motivo son obligatorios' });
  }

  try {
    const acceso = await tieneAccesoCitacion(u, grupo_id);
    if (!acceso) return res.status(403).json({ error: 'No tienes permiso para citar sobre ese grupo' });

    const [[info]] = await db.query(`
      SELECT est.nombre AS estudiante, est.telefono_padres,
             g.nombre AS grupo_nombre, g.grado, g.colegio_id,
             col.nombre AS colegio
      FROM usuarios est
      JOIN grupos g ON g.id = ?
      JOIN colegios col ON col.id = g.colegio_id
      WHERE est.id = ?
    `, [grupo_id, estudiante_id]);
    if (!info) return res.status(404).json({ error: 'Estudiante o grupo no encontrado' });

    const [[pertenece]] = await db.query(
      'SELECT 1 FROM estudiante_grupos WHERE estudiante_id = ? AND grupo_id = ? LIMIT 1',
      [estudiante_id, grupo_id]
    );
    if (!pertenece) return res.status(400).json({ error: 'Ese estudiante no pertenece a ese grupo' });

    const [result] = await db.query(
      `INSERT INTO citaciones (estudiante_id, grupo_id, colegio_id, citado_por, motivo, fecha_cita, hora_cita, lugar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [estudiante_id, grupo_id, info.colegio_id, u.id, motivo.trim(), fecha_cita || null, hora_cita || null, lugar?.trim() || null]
    );

    let whatsappOk = false;
    if (info.telefono_padres) {
      const fechaTxt = formatearFecha(fecha_cita);
      const horaTxt  = formatearHora(hora_cita);
      const mensaje = [
        `📅 *Playfesor — Citación*`,
        ``,
        `Estimado padre/madre de familia,`,
        ``,
        `La institución *${info.colegio}* solicita su presencia para una reunión sobre *${info.estudiante}* (Grado ${info.grado}° ${info.grupo_nombre}).`,
        ``,
        `*Motivo:* ${motivo.trim()}`,
        fechaTxt ? `*Fecha:* ${fechaTxt}${horaTxt ? ` a las ${horaTxt}` : ''}` : null,
        `*Lugar:* ${lugar?.trim() || 'Por definir — se le contactará'}`,
        ``,
        `Por favor confirme su asistencia comunicándose con la institución.`,
        ``,
        `_${info.colegio}_`,
      ].filter(Boolean).join('\n');

      const resultado = await enviarMensaje(info.telefono_padres, mensaje);
      whatsappOk = resultado.ok;
      if (whatsappOk) {
        await db.query('UPDATE citaciones SET whatsapp_enviado = TRUE WHERE id = ?', [result.insertId]);
      }
    }

    // Notificación in-app para todos los acudientes vinculados (aunque el
    // WhatsApp falle o el estudiante no tenga teléfono registrado)
    const [padres] = await db.query(
      'SELECT padre_id FROM padre_estudiante WHERE estudiante_id = ?',
      [estudiante_id]
    );
    if (padres.length) {
      const fechaTxt = formatearFecha(fecha_cita);
      const valores = padres.map(p => [
        p.padre_id, 'citacion', `citacion_${result.insertId}`,
        `Citación: ${info.estudiante}`,
        `La institución solicita una reunión sobre ${info.estudiante}.${fechaTxt ? ` Fecha propuesta: ${fechaTxt}.` : ''}`,
        JSON.stringify({ citacion_id: result.insertId, estudiante_id }),
      ]);
      await db.query(
        `INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra) VALUES ?`,
        [valores]
      );
    }

    res.status(201).json({ mensaje: 'Citación enviada', data: { id: result.insertId, whatsapp_enviado: whatsappOk } });
  } catch (err) {
    console.error('Error al crear citación:', err);
    res.status(500).json({ error: 'Error al crear la citación' });
  }
}

// GET /api/citaciones/estudiante/:id — historial de citaciones de un estudiante
async function listarPorEstudiante(req, res) {
  const estudianteId = parseInt(req.params.id);
  const u = req.usuario;

  try {
    if (u.rol === 'estudiante' && u.id !== estudianteId) {
      return res.status(403).json({ error: 'Solo puedes ver tus propias citaciones' });
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

    const [citaciones] = await db.query(
      `SELECT c.id, c.motivo, c.fecha_cita, c.hora_cita, c.lugar, c.estado, c.whatsapp_enviado, c.creado_en,
              cu.nombre AS nombre_citador
       FROM citaciones c
       JOIN usuarios cu ON cu.id = c.citado_por
       WHERE c.estudiante_id = ?
       ORDER BY c.creado_en DESC`,
      [estudianteId]
    );
    res.json({ data: citaciones });
  } catch (err) {
    console.error('Error al listar citaciones:', err);
    res.status(500).json({ error: 'Error al obtener las citaciones' });
  }
}

// PATCH /api/citaciones/:id/estado — marcar como realizada o cancelada
async function actualizarEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body;
  const u = req.usuario;

  if (!['realizada', 'cancelada', 'pendiente'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const [[citacion]] = await db.query('SELECT citado_por, colegio_id FROM citaciones WHERE id = ?', [id]);
    if (!citacion) return res.status(404).json({ error: 'Citación no encontrada' });

    const esAutor = u.id === citacion.citado_por;
    const esDireccion = (u.rol === 'admin' || u.rol === 'director') && u.colegio_id === citacion.colegio_id;
    if (!esAutor && !esDireccion) {
      return res.status(403).json({ error: 'No puedes modificar esta citación' });
    }

    await db.query('UPDATE citaciones SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ mensaje: 'Citación actualizada' });
  } catch (err) {
    console.error('Error al actualizar citación:', err);
    res.status(500).json({ error: 'Error al actualizar la citación' });
  }
}

module.exports = { getMisGrupos, estudiantesDelGrupo, crear, listarPorEstudiante, actualizarEstado };
