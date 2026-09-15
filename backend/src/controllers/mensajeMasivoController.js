const db = require('../database');
const { enviarEmail } = require('../services/emailService');
const { filtrarPorPreferencia } = require('../utils/preferenciasNotificacion');

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

// Estudiantes activos dentro del alcance pedido
async function estudiantesDelAlcance(colegio_id, alcance, grupo_id, grado) {
  if (alcance === 'grupo') {
    const [filas] = await db.query(`
      SELECT u.id, u.nombre
      FROM estudiante_grupos eg
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
      WHERE eg.grupo_id = ?
    `, [grupo_id]);
    return filas;
  }
  if (alcance === 'grado') {
    const [filas] = await db.query(`
      SELECT DISTINCT u.id, u.nombre
      FROM estudiante_grupos eg
      JOIN grupos g ON g.id = eg.grupo_id AND g.colegio_id = ? AND g.grado = ?
      JOIN usuarios u ON u.id = eg.estudiante_id AND u.activo = TRUE
    `, [colegio_id, grado]);
    return filas;
  }
  const [filas] = await db.query(
    `SELECT id, nombre FROM usuarios WHERE colegio_id = ? AND rol = 'estudiante' AND activo = TRUE`,
    [colegio_id]
  );
  return filas;
}

// Padres/acudientes activos vinculados a esos estudiantes (con su correo, que
// es obligatorio para todo usuario) — un mismo acudiente puede repetirse si
// tiene más de un hijo dentro del alcance, por eso se filtra por id único.
async function padresDelAlcance(estudianteIds) {
  if (!estudianteIds.length) return [];
  const [filas] = await db.query(`
    SELECT DISTINCT u.id, u.nombre, u.email, pe.estudiante_id
    FROM padre_estudiante pe
    JOIN usuarios u ON u.id = pe.padre_id AND u.activo = TRUE
    WHERE pe.estudiante_id IN (?)
  `, [estudianteIds]);
  const porId = new Map();
  filas.forEach(f => { if (!porId.has(f.id)) porId.set(f.id, f); });
  return { unicos: [...porId.values()], filas };
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
    const { unicos, filas } = await padresDelAlcance(estudiantes.map(e => e.id));
    const estudiantesConAcudiente = new Set(filas.map(f => f.estudiante_id));
    const sinAcudiente = estudiantes.filter(e => !estudiantesConAcudiente.has(e.id)).length;

    res.json({
      data: {
        total_estudiantes: estudiantes.length,
        total_familias: unicos.length,
        sin_acudiente_vinculado: sinAcudiente,
      },
    });
  } catch (err) {
    console.error('Error al previsualizar destinatarios:', err);
    res.status(500).json({ error: 'Error al calcular los destinatarios' });
  }
}

// POST /api/mensajes-masivos — envía el comunicado a todas las familias del
// alcance por Mensajería interna y por correo electrónico. WhatsApp se
// reserva para alertas puntuales (nota baja, inasistencia) — un envío masivo
// con el mismo texto a muchos números es justo el patrón que hace que Meta
// bloquee la línea, así que este módulo ya no lo usa.
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
    const nombreColegio = colegio?.nombre || 'Institución educativa';

    const estudiantes = await estudiantesDelAlcance(u.colegio_id, alcance, grupoIdNum, grado);
    const asuntoTxt = asunto.trim();
    const mensajeTxt = mensaje.trim();
    const { unicos: padres } = await padresDelAlcance(estudiantes.map(e => e.id));

    // 1. Mensajería interna — un solo mensaje con todas las familias como destinatarias
    const [resultInterno] = await db.query(
      `INSERT INTO mensajes_internos (colegio_id, remitente_id, asunto, cuerpo, estado)
       VALUES (?, ?, ?, ?, 'enviado')`,
      [u.colegio_id, u.id, asuntoTxt, mensajeTxt]
    );
    const mensajeInternoId = resultInterno.insertId;

    if (padres.length) {
      const valoresDestinatarios = padres.map(p => [mensajeInternoId, p.id]);
      await db.query(
        'INSERT IGNORE INTO mensajes_destinatarios (mensaje_id, destinatario_id) VALUES ?',
        [valoresDestinatarios]
      );
    }

    // 2. Correo electrónico a cada acudiente
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff">
        <div style="text-align:center;margin-bottom:24px">
          <h2 style="color:#667eea;margin:0;font-size:24px">Playfesor</h2>
          <p style="color:#888;font-size:13px;margin:4px 0 0">${nombreColegio}</p>
        </div>
        <h3 style="color:#333;font-size:18px">${asuntoTxt}</h3>
        <p style="color:#555;line-height:1.6;white-space:pre-wrap">${mensajeTxt}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#bbb;font-size:12px;text-align:center;margin:0">
          Este comunicado también quedó guardado en tu bandeja de Mensajería dentro de Playfesor.
        </p>
      </div>
    `;

    let enviados = 0;
    let fallidos = 0;
    for (const padre of padres) {
      try {
        await enviarEmail({ destinatario: padre.email, asunto: `${asuntoTxt} — ${nombreColegio}`, html });
        enviados++;
      } catch (e) {
        console.error('Error enviando correo de comunicado a', padre.email, e.message);
        fallidos++;
      }
    }

    const [resultHistorial] = await db.query(
      `INSERT INTO mensajes_masivos
        (colegio_id, enviado_por, alcance, grupo_id, grado, asunto, mensaje, total_destinatarios, total_enviados, total_fallidos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.colegio_id, u.id, alcance, grupoIdNum, grado || null, asuntoTxt, mensajeTxt, padres.length, enviados, fallidos]
    );

    // Notificación in-app (campanita) para cada acudiente
    if (padres.length) {
      const conNotifActiva = await filtrarPorPreferencia(padres.map(p => p.id), 'notif_mensajes');
      if (conNotifActiva.length) {
        const valoresNotif = conNotifActiva.map(id => [
          id, 'mensaje_interno', `mensaje_${mensajeInternoId}`,
          `Comunicado: ${asuntoTxt}`, mensajeTxt.slice(0, 140),
          JSON.stringify({ mensaje_id: mensajeInternoId }),
        ]);
        await db.query(
          'INSERT IGNORE INTO notificaciones (usuario_id, tipo, ref_key, titulo, mensaje, datos_extra) VALUES ?',
          [valoresNotif]
        );
      }
    }

    res.status(201).json({
      mensaje: 'Comunicado enviado',
      data: { id: resultHistorial.insertId, total_destinatarios: padres.length, total_enviados: enviados, total_fallidos: fallidos },
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
